/**
 * The panel's state: one catalog load, a text filter, and which row's command
 * was just copied.
 *
 * A plain snapshot store rather than a framework: the panel has one async
 * source and three fields, and the renderer only needs `getSnapshot` and
 * `subscribe`.
 * @module dsh-research/client/store
 */

import { CATALOG_ROUTE, INSTALL_ROUTE, REMOVE_ROUTE, RESTART_ROUTE } from '../shared/route.js'
import type { CatalogResponse, InstallResponse, MarketItem, RestartResponse } from '../shared/route.js'

/** What the panel renders. */
export interface MarketState {
  /** Whether the first load is still in flight. */
  readonly loading: boolean
  /** Entries from the catalog, in catalog order. */
  readonly items: readonly MarketItem[]
  /** Catalog revision, shown so a reader can judge freshness. */
  readonly revision: string
  /** Set when the snapshot is a cached one served after a failed refresh. */
  readonly stale: boolean
  /** Load failure, if the catalog could not be read at all. */
  readonly error?: string
  /** Current filter text. */
  readonly query: string
  /** Id of the row whose command was copied most recently. */
  readonly copied?: string
  /** Bundles already in the profile, so installed rows say so. */
  readonly installed: readonly string[]
  /** On-disk version per installed npm name, for comparing with the catalog. */
  readonly installedVersions: Readonly<Record<string, string>>
  /** Profile an install mutates, named in the panel so it is never a surprise. */
  readonly profile: string
  /** npm name currently installing, if any. */
  readonly installing?: string
  /** When the current mutation started, so the row can show how long it has run. */
  readonly startedAt?: number
  /** Per-package failure text from the last attempt. */
  readonly failures: Readonly<Record<string, string>>
  /** npm names changed during this session, which need a restart to take effect. */
  readonly pendingRestart: readonly string[]
  /** How far a requested restart has got, once one has been asked for. */
  readonly restartPhase?: RestartPhase
  /** Where the replacement's output went, for a boot that fails. */
  readonly restartLog?: string
  /** Whether a terminal owns the host, so only the person there can restart it. */
  readonly attached: boolean
  /** The command that starts the host again, shown when that person is the reader. */
  readonly restartCommand: string
}

/**
 * Where a requested restart got to.
 *
 * The phases exist because "restarting…" on its own was a lie by omission: the
 * host went down, came back detached, and the panel sat on that word forever
 * while the person watched a terminal that never printed anything again. Each
 * phase below is something the panel can say that is actually true.
 */
export type RestartPhase =
  /** Asked, and waiting to see the host go away and come back. */
  | 'waiting'
  /** Confirmed back, and answering on this route again. */
  | 'back'
  /** It went down and did not come back within the budget. */
  | 'lost'
  /** It never went down, so nothing changed. */
  | 'stayed'
  /** Only the person at the terminal can restart it; nothing was done. */
  | 'manual'

/** How often the panel probes the host while waiting for it to come back. */
export const PROBE_INTERVAL_MS = 700

/** How long the host has to actually exit before the panel says it did not. */
export const DOWN_BUDGET_MS = 15_000

/** How long the replacement has to answer before the panel says it never did. */
export const UP_BUDGET_MS = 90_000

/** Minimal snapshot store shape the renderer binds as a hook. */
export interface Store<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/** Same-origin fetch of the Node half's catalog route; injectable for tests. */
export type CatalogFetch = (lang: string, signal?: AbortSignal) => Promise<CatalogResponse>

/** POST to the Node half's install route; injectable for tests. */
export type InstallRequest = (npm: string) => Promise<InstallResponse>

/** POST one package name to a mutation route. */
async function postPackage(route: string, npm: string): Promise<InstallResponse> {
  const res = await fetch(route, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ npm }),
  })
  const body = await res.json() as InstallResponse & { error?: string }
  // A failed mutation answers 500 with both `error` and `output`. Keeping only
  // `error` here is what reduced every failure on the card to a bare
  // "dsh plugin add exited 1": the pnpm diagnosis that says *why* — an
  // unreachable registry, a version the mirror has not synced, a package not in
  // the profile — was collected by the host, sent over the wire, and dropped on
  // arrival. `output` is forwarded so the card can show what actually broke.
  if (!res.ok) {
    return {
      ok: false,
      npm,
      error: body.error ?? `route answered ${res.status}`,
      ...(body.output === undefined ? {} : { output: body.output }),
    }
  }
  return body
}

/**
 * The text a failed mutation shows: the headline, then the CLI tail beneath it.
 *
 * Both mutation paths build it here so neither can quietly drop the diagnosis.
 * The remove path used to take only `error`, which is why an uninstall that
 * failed because the package was not in the profile reported nothing but
 * "dsh plugin remove exited 1".
 * @param answer - the host's reply.
 * @param fallback - headline for a reply that carries no error string.
 * @returns headline, and the output after a blank line when there is any.
 */
export function failureText(answer: InstallResponse, fallback: string): string {
  const headline = answer.error ?? fallback
  const tail = answer.output?.trim()
  return tail === undefined || tail === '' ? headline : `${headline}\n${tail}`
}

/** Default installer: `POST /research-market/install` on the page origin. */
export const requestInstall: InstallRequest = (npm) => postPackage(INSTALL_ROUTE, npm)

/** Default remover: `POST /research-market/remove` on the page origin. */
export const requestRemove: InstallRequest = (npm) => postPackage(REMOVE_ROUTE, npm)

/** Ask the host to restart itself. */
export const requestRestart = async (): Promise<RestartResponse> => {
  const res = await fetch(RESTART_ROUTE, { method: 'POST', credentials: 'same-origin' })
  const body = await res.json() as RestartResponse & { error?: string }
  // A `manual` answer is a complete answer, not a failure to be reported as
  // one: the host declined to end itself and said who can.
  if (body.mode === 'manual') return body
  return res.ok ? body : { ok: false, error: body.error ?? `restart route answered ${res.status}` }
}

/**
 * Whether the host is answering this plugin's own route.
 *
 * The catalog route rather than the page root, because it answers the question
 * that matters: a replacement that booted without this plugin is not a
 * replacement the panel should call "back".
 * @param lang - which feed to ask for; any answer counts, including an error.
 * @returns whether the host answered at all.
 */
export const probeHost = async (lang: string): Promise<boolean> => {
  try {
    const res = await fetch(`${CATALOG_ROUTE}?lang=${encodeURIComponent(lang)}`, {
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
    })
    // Any HTTP status means a process is listening and this route is mounted;
    // a 502 from an unreachable catalog still proves the host is up.
    return res.status > 0
  } catch {
    return false
  }
}

/** Default fetcher: `GET /research-market/catalog` on the page origin. */
export const fetchCatalogRoute: CatalogFetch = async (lang, signal) => {
  const res = await fetch(`${CATALOG_ROUTE}?lang=${encodeURIComponent(lang)}`, {
    method: 'GET', credentials: 'same-origin', cache: 'no-store',
    ...(signal !== undefined ? { signal } : {}),
  })
  const body = await res.json() as Record<string, unknown>
  if (!res.ok) throw new Error(typeof body['error'] === 'string' ? body['error'] : `catalog route answered ${res.status}`)
  return body as unknown as CatalogResponse
}

/** Create a snapshot store over a mutable value. */
export function createStore<T>(initial: T): Store<T> & { set(next: T): void } {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(next) {
      snapshot = next
      for (const listener of listeners) listener()
    },
  }
}

/**
 * True when `candidate` is a strictly newer release than `current`.
 * Dotted numeric segments compared left to right; a non-numeric segment
 * (prerelease tags and the like) compares as 0, erring toward silence —
 * a missing offer costs a day, a wrong downgrade button costs trust.
 */
export function versionNewer(candidate: string, current: string): boolean {
  const parse = (v: string): number[] => v.split(/[.-]/).map((part) => {
    const n = Number(part)
    return Number.isFinite(n) ? n : 0
  })
  const a = parse(candidate)
  const b = parse(current)
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0)
    if (delta !== 0) return delta > 0
  }
  return false
}

/** The install command for one entry, or `undefined` when npm name is unknown. */
export function installCommand(item: MarketItem): string | undefined {
  if (item.npm === undefined) return undefined
  // Same pin as the host applies (see installSpec): the reviewed version,
  // immune to pnpm 11 serving yesterday's release.
  return `dsh plugin --profile web add ${item.npm}${item.version === undefined ? '' : `@${item.version}`}`
}

/** Case-insensitive filter over the fields a reader would search. */
export function filterItems(items: readonly MarketItem[], query: string): readonly MarketItem[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return items
  return items.filter((item) =>
    `${item.repo} ${item.summary} ${item.category} ${item.npm ?? ''}`.toLowerCase().includes(needle))
}

/** Owns the panel's state and the one request behind it. */
export class MarketController {
  readonly store = createStore<MarketState>({
    loading: true, items: [], revision: '', stale: false, query: '',
    installed: [], installedVersions: {}, profile: '', failures: {}, pendingRestart: [],
    attached: false, restartCommand: 'dsh web',
  })

  private copyTimer: ReturnType<typeof setTimeout> | undefined

  /**
   * @param load - catalog fetcher; defaults to the same-origin route.
   * @param request - installer; defaults to the same-origin route.
   * @param remove - remover; defaults to the same-origin route.
   * @param restart - restart requester; defaults to the same-origin route.
   * @param probe - host liveness probe; injectable so the restart wait is testable.
   * @param sleep - delay between probes; injectable so tests do not wait.
   * @param now - clock, for the probe budgets.
   */
  constructor(
    private readonly load: CatalogFetch = fetchCatalogRoute,
    private readonly request: InstallRequest = requestInstall,
    private readonly remove: InstallRequest = requestRemove,
    private readonly restart: () => Promise<RestartResponse> = requestRestart,
    private readonly probe: (lang: string) => Promise<boolean> = probeHost,
    private readonly sleep: (ms: number) => Promise<void> =
      (ms) => new Promise((done) => setTimeout(done, ms)),
    private readonly now: () => number = Date.now,
  ) {}

  /** Whether this entry is already a bundle in the profile. */
  isInstalled(item: MarketItem): boolean {
    return item.npm !== undefined && this.state().installed.includes(item.npm)
  }

  /**
   * Install one entry. The Node half re-checks the name against the catalog,
   * so a caller cannot widen what this reaches.
   * @param item - the catalog entry to install.
   */
  async install(item: MarketItem): Promise<void> {
    const npm = item.npm
    if (npm === undefined || this.state().installing !== undefined) return
    const { failures, ...before } = this.state()
    const { [npm]: previous, ...keptFailures } = failures
    void previous
    this.store.set({ ...before, failures: keptFailures, installing: npm, startedAt: Date.now() })
    const answer = await this.request(npm)
    const { installing, startedAt, ...after } = this.state()
    void installing
    void startedAt
    this.store.set(answer.ok
      ? {
          ...after,
          installed: after.installed.includes(npm) ? after.installed : [...after.installed, npm],
          // The host pinned the catalog version, so record it: the update
          // offer clears without waiting for a refetch.
          installedVersions: item.version === undefined
            ? after.installedVersions
            : { ...after.installedVersions, [npm]: item.version },
          pendingRestart: after.pendingRestart.includes(npm) ? after.pendingRestart : [...after.pendingRestart, npm],
        }
      : {
          ...after,
          failures: { ...after.failures, [npm]: failureText(answer, 'install failed') },
        })
  }

  /**
   * The catalog version an installed entry should move to, or undefined when
   * it is current, ahead, not installed, or either side has no version.
   * Strictly newer, not merely different: a disk version ahead of the catalog
   * happens to developers running a linked checkout and to anyone in the
   * minutes between an npm publish and the feed adopting it — and both were
   * being shown a "downgrade" button. Converging those cases back to the
   * catalog helps nobody; the feed catches up on its own within minutes.
   */
  updateFor(item: MarketItem): string | undefined {
    const npm = item.npm
    if (npm === undefined || item.version === undefined) return undefined
    const onDisk = this.state().installedVersions[npm]
    return onDisk !== undefined && versionNewer(item.version, onDisk) ? item.version : undefined
  }

  /** Current snapshot. */
  state(): MarketState {
    return this.store.getSnapshot()
  }

  /** Entries after the current filter. */
  visible(): readonly MarketItem[] {
    const state = this.state()
    return filterItems(state.items, state.query)
  }

  /** Interface language, so the panel reads the catalog feed that matches it. */
  private lang = 'en'

  /**
   * Point later loads at a language's feed.
   * @param lang - `zh` or anything else, which means English.
   */
  setLanguage(lang: string): void {
    this.lang = lang.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  }

  /** Which feed later loads read. */
  language(): string {
    return this.lang
  }

  /** Load the catalog once. Safe to call again; the last answer wins. */
  async refresh(): Promise<void> {
    this.store.set({ ...this.state(), loading: true })
    try {
      const answer = await this.load(this.lang)
      const { error, ...rest } = this.state()
      void error
      this.store.set({
        ...rest, loading: false, items: answer.items,
        revision: answer.revision, stale: answer.stale === true,
        installed: answer.installed, installedVersions: answer.installedVersions, profile: answer.profile,
        attached: answer.attached === true,
        // An older host does not send this; `dsh web` is the launch it is
        // overwhelmingly likely to have had, and the panel only ever shows the
        // command as something to check, never runs it.
        restartCommand: answer.restartCommand ?? 'dsh web',
      })
    } catch (cause) {
      this.store.set({
        ...this.state(), loading: false,
        error: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  /** Set the filter text. */
  search(query: string): void {
    this.store.set({ ...this.state(), query })
  }

  /** Copy one entry's install command and flag the row briefly. */
  async copy(item: MarketItem): Promise<void> {
    const command = installCommand(item)
    if (command === undefined) return
    await navigator.clipboard.writeText(command)
    const { copied, ...rest } = this.state()
    void copied
    this.store.set({ ...rest, copied: item.id })
    if (this.copyTimer !== undefined) clearTimeout(this.copyTimer)
    this.copyTimer = setTimeout(() => {
      const { copied: previous, ...current } = this.state()
      void previous
      this.store.set(current)
    }, 1600)
  }

  /**
   * Remove one entry from the profile.
   * @param item - the catalog entry to remove.
   */
  async uninstall(item: MarketItem): Promise<void> {
    const npm = item.npm
    if (npm === undefined || this.state().installing !== undefined) return
    const { failures, ...before } = this.state()
    const { [npm]: previous, ...keptFailures } = failures
    void previous
    this.store.set({ ...before, failures: keptFailures, installing: npm, startedAt: Date.now() })
    const answer = await this.remove(npm)
    const { installing, startedAt, ...after } = this.state()
    void installing
    void startedAt
    this.store.set(answer.ok
      ? {
          ...after,
          installed: after.installed.filter((name) => name !== npm),
          pendingRestart: [...after.pendingRestart.filter((name) => name !== npm), npm],
        }
      : { ...after, failures: { ...after.failures, [npm]: failureText(answer, 'remove failed') } })
  }

  /**
   * Ask the host to restart, so the changes made here take effect, and then
   * watch until the answer is known.
   *
   * The watching is the point. Nothing reloads this page when the host is
   * replaced — the earlier version set a flag and assumed the page was "about
   * to go away", which it never was, so the panel showed "restarting…"
   * indefinitely whatever actually happened. The phases below are each
   * something the panel can state without guessing.
   */
  async restartHost(): Promise<void> {
    if (this.state().restartPhase === 'waiting') return
    const { error, restartLog, ...clean } = this.state()
    void error
    void restartLog
    this.store.set({ ...clean, restartPhase: 'waiting' })
    const answer = await this.restart()
    if (answer.mode === 'manual') {
      this.store.set({ ...this.state(), restartPhase: 'manual', ...(answer.command === undefined ? {} : { restartCommand: answer.command }) })
      return
    }
    if (!answer.ok) {
      const { restartPhase, ...rest } = this.state()
      void restartPhase
      this.store.set({ ...rest, error: answer.error ?? 'restart refused' })
      return
    }
    const phase = await this.awaitReturn()
    this.store.set({ ...this.state(), restartPhase: phase, ...(answer.log === undefined ? {} : { restartLog: answer.log }) })
  }

  /**
   * Wait for the host to go away and come back.
   *
   * Down first, then up — and in that order for a reason. Probing for "up"
   * straight away would find the process we just asked to exit, still serving
   * for its last half-second, and report a restart that has not happened yet.
   * @returns which of the three things happened.
   */
  private async awaitReturn(): Promise<'back' | 'lost' | 'stayed'> {
    if (!(await this.until(false, DOWN_BUDGET_MS))) return 'stayed'
    return (await this.until(true, UP_BUDGET_MS)) ? 'back' : 'lost'
  }

  /**
   * Probe until the host's liveness matches `want`, or the budget runs out.
   * @param want - the liveness being waited for.
   * @param budgetMs - how long to keep asking.
   * @returns whether it happened inside the budget.
   */
  private async until(want: boolean, budgetMs: number): Promise<boolean> {
    const deadline = this.now() + budgetMs
    for (;;) {
      if (await this.probe(this.lang) === want) return true
      if (this.now() >= deadline) return false
      await this.sleep(PROBE_INTERVAL_MS)
    }
  }

  /** Stop the pending copy reset; called when the section unmounts. */
  dispose(): void {
    if (this.copyTimer !== undefined) clearTimeout(this.copyTimer)
  }
}
