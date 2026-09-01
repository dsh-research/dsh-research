/**
 * dsh-research: the curated research plugin index, inside Settings.
 *
 * The panel exists because the alternative is a long command. Installing five
 * packages by hand means reading a website, selecting a line, and trusting it
 * — this plugin turns that into a list you scroll and a button you press.
 *
 * It deliberately does NOT install anything, and the reason is not that
 * installing is unsafe. `dsh-market` already installs from a curated registry
 * with a same-origin check, a mutation lock, duplicate-alias guards, retry of
 * dependencies left by a failed install, and Windows shim handling — months
 * of edge cases. Reimplementing that to save a paste would be reimplementing
 * it badly. What is missing from that market is not installation but
 * curation: which fifteen of eleven hundred plugins a researcher wants. So
 * this panel does the part nobody else does, and hands over the command.
 * @module dsh-research
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
// Type-only: the Context merge declaring `ctx.webServer`.
import type {} from '@deepseek-ai/dsh-host-webserver'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { CATALOG_ROUTE, CATALOG_URL, CATALOG_URL_ZH, INSTALL_ROUTE, REMOVE_ROUTE, RESTART_ROUTE } from './shared/route.js'
import type { CatalogPage, CatalogResponse, InstallResponse, MarketItem, RestartResponse } from './shared/route.js'
import { attachedToTerminal, installPackage, installSpec, removePackage, resolveProfile, restartCommand, scheduleRestart, trustedRestartRequest } from './install.js'

export { CATALOG_ROUTE, CATALOG_URL, CATALOG_URL_ZH, INSTALL_ROUTE, REMOVE_ROUTE, RESTART_ROUTE } from './shared/route.js'
export type { CatalogPage, CatalogResponse, InstallResponse, MarketItem, RestartResponse } from './shared/route.js'
export { normalizeCatalog } from './catalog.js'
export { argvProfile, attachedToTerminal, dshArgv, installPackage, installSpec, modulePathProfile, pluginArgs, profileDir, quoteCmdArg, removePackage, resolveProfile, restartCommand, scheduleRestart, spawnEnv, trustedRestartRequest } from './install.js'
export type { DshInvocation, InstallOutcome, RestartOutcome } from './install.js'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'research-market'

/** Services required before `apply` runs; `webServer` is injected lazily. */
export const inject: string[] = []

/** Plugin configuration. */
export interface Config {
  /** Catalog endpoint implementing the market provider contract. */
  catalogUrl?: string
  /** Chinese-language catalog endpoint. */
  catalogUrlZh?: string
  /** Profile an install mutates; defaults to the one this host booted. */
  profile?: string
  /** Offer the install and remove buttons. */
  allowInstall?: boolean
  /** Offer the restart button. */
  allowRestart?: boolean
  /** Seconds a fetched snapshot is reused before refetching. */
  cacheSeconds?: number
  /** Milliseconds to wait for the catalog before falling back to cache. */
  timeoutMs?: number
}

export const Config: Schema<Config> = Schema.object({
  catalogUrl: Schema.string().default(CATALOG_URL).description('Catalog endpoint implementing the market provider contract.'),
  catalogUrlZh: Schema.string().default(CATALOG_URL_ZH).description('Chinese-language catalog endpoint. The contract fixes the item shape, so a bilingual catalog is two feeds rather than one with two summaries.'),
  profile: Schema.string().description('Profile an install mutates; defaults to the one this host booted.'),
  allowInstall: Schema.boolean().default(true).description('Offer the install and remove buttons. Turn off to leave the panel read-only.'),
  allowRestart: Schema.boolean().default(true).description('Offer the restart button. Turn off where this host is managed by something else.'),
  cacheSeconds: Schema.number().default(900).description('Seconds a snapshot is reused before refetching.'),
  timeoutMs: Schema.number().default(8000).description('Milliseconds to wait for the catalog.'),
})

/** Complete config after schemastery applies every default. */
type ResolvedConfig = Required<Omit<Config, 'profile'>> & { profile?: string }

/** A snapshot and when it was taken, so a failed refresh can still answer. */
interface Cached {
  readonly at: number
  readonly value: CatalogPage
}

/**
 * Register the catalog route.
 *
 * The route is the plugin's whole Node surface: it fetches, normalizes and
 * caches, so the panel never talks to a third-party host itself and a slow
 * catalog cannot make the settings page hang.
 * @param ctx - plugin context; `webServer` arrives through injection.
 * @param config - schemastery-validated config with defaults applied.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  if (resolved.cacheSeconds < 0) throw new Error('research-market: cacheSeconds must not be negative')
  if (resolved.timeoutMs <= 0) throw new Error('research-market: timeoutMs must be positive')

  // One snapshot per language: the two feeds are different documents.
  const cached = new Map<string, Cached>()
  // One mutation at a time: two concurrent `dsh plugin add` runs race on the
  // same package.json and can leave the profile half-written.
  let installing: string | undefined
  const profile = resolveProfile(resolved.profile)

  ctx.inject(['webServer'], (webCtx) => {
    webCtx.webServer.register({
      kind: 'exact',
      path: CATALOG_ROUTE,
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        const now = Date.now()
        const lang = new URL(request.url ?? '/', 'http://localhost').searchParams.get('lang') === 'zh' ? 'zh' : 'en'
        const url = lang === 'zh' ? resolved.catalogUrlZh : resolved.catalogUrl
        const answer = async (): Promise<CatalogPage> => {
          const hit = cached.get(lang)
          if (hit !== undefined && now - hit.at < resolved.cacheSeconds * 1000) return hit.value
          try {
            const fresh = await fetchCatalog(url, resolved.timeoutMs)
            cached.set(lang, { at: now, value: fresh })
            return fresh
          } catch (cause) {
            // A stale list still lets someone install; an error page does not.
            if (hit !== undefined) return { ...hit.value, stale: true }
            throw cause
          }
        }
        try {
          const value = await answer()
          sendJson(response, 200, {
            ...value,
            installed: installedBundles(profile),
            installedVersions: installedVersionsOf(profile),
            profile,
            attached: attachedToTerminal(),
            restartCommand: restartCommand(),
          })
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause)
          sendJson(response, 502, { error: `catalog unavailable: ${message}` })
        }
      },
    })

    if (!resolved.allowInstall) return
    webCtx.webServer.register({
      kind: 'exact',
      path: INSTALL_ROUTE,
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' })
          response.end()
          return
        }
        // A state-changing route reachable from any page would let a visited
        // site install packages into this profile.
        if (!sameOrigin(request)) {
          sendJson(response, 403, { error: 'untrusted origin' })
          return
        }
        if (installing !== undefined) {
          sendJson(response, 409, { error: `already installing ${installing}` })
          return
        }
        let npm: string
        try {
          const body = await readJsonBody(request) as { npm?: unknown }
          npm = typeof body.npm === 'string' ? body.npm : ''
        } catch {
          sendJson(response, 400, { error: 'malformed request body' })
          return
        }
        // The allowlist IS the safety property: the client may ask for any
        // string, and only a package this catalog lists can ever be spawned.
        // Any language's snapshot is the same allowlist; an entry exists in
        // both feeds or neither.
        const known = [...cached.values()].some((page) => page.value.items.some((item) => item.npm === npm))
        if (npm === '' || !known) {
          sendJson(response, 400, { error: 'package is not in this catalog' })
          return
        }
        installing = npm
        try {
          // Pin to the catalog's version: it is the version the review was
          // done against, and an exact spec is immune to pnpm 11's
          // release-age gate serving yesterday's package the day of a fix.
          const catalogVersion = [...cached.values()]
            .flatMap((page) => page.value.items)
            .find((item) => item.npm === npm)?.version
          const outcome = await installPackage(profile, installSpec(npm, catalogVersion))
          const answer: InstallResponse = outcome.ok
            ? { ok: true, npm }
            : {
                ok: false,
                npm,
                error: outcome.timedOut ? 'install timed out' : `dsh plugin add exited ${String(outcome.exitCode)}`,
                output: outcome.output.slice(-2000),
              }
          sendJson(response, outcome.ok ? 200 : 500, answer)
        } finally {
          installing = undefined
        }
      },
    })

    webCtx.webServer.register({
      kind: 'exact',
      path: REMOVE_ROUTE,
      handler: async (request: IncomingMessage, response: ServerResponse) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' })
          response.end()
          return
        }
        if (!sameOrigin(request)) {
          sendJson(response, 403, { error: 'untrusted origin' })
          return
        }
        if (installing !== undefined) {
          sendJson(response, 409, { error: `busy with ${installing}` })
          return
        }
        let npm: string
        try {
          const body = await readJsonBody(request) as { npm?: unknown }
          npm = typeof body.npm === 'string' ? body.npm : ''
        } catch {
          sendJson(response, 400, { error: 'malformed request body' })
          return
        }
        // Same allowlist as install: this route may only touch what we listed.
        const known = [...cached.values()].some((page) => page.value.items.some((item) => item.npm === npm))
        if (npm === '' || !known) {
          sendJson(response, 400, { error: 'package is not in this catalog' })
          return
        }
        installing = npm
        try {
          const outcome = await removePackage(profile, npm)
          const answer: InstallResponse = outcome.ok
            ? { ok: true, npm }
            : { ok: false, npm, error: `dsh plugin remove exited ${String(outcome.exitCode)}`, output: outcome.output.slice(-2000) }
          sendJson(response, outcome.ok ? 200 : 500, answer)
        } finally {
          installing = undefined
        }
      },
    })

    if (!resolved.allowRestart) return
    webCtx.webServer.register({
      kind: 'exact',
      path: RESTART_ROUTE,
      handler: (request: IncomingMessage, response: ServerResponse) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' })
          response.end()
          return
        }
        // Process control gets the stricter check: same-origin is not enough
        // when the act is ending this process.
        if (!trustedRestartRequest(request)) {
          sendJson(response, 403, { error: 'restart is limited to same-origin loopback requests' })
          return
        }
        if (installing !== undefined) {
          sendJson(response, 409, { error: `cannot restart while installing ${installing}` })
          return
        }
        try {
          const outcome = scheduleRestart(profile)
          // A terminal-owned host is not restarted from here: `ok: false` with
          // the command is the honest answer, and 200 rather than an error
          // status because the request was understood and answered — the panel
          // has to render this, not retry it.
          const answer: RestartResponse = outcome.mode === 'manual'
            ? { ok: false, mode: 'manual', command: outcome.command }
            : { ok: true, mode: 'relaunch', log: outcome.log }
          sendJson(response, outcome.mode === 'manual' ? 200 : 202, answer)
        } catch (cause) {
          sendJson(response, 500, { error: cause instanceof Error ? cause.message : String(cause) })
        }
      },
    })
  })
}

/** Bundles already listed in the profile, so the panel can mark installed rows. */
function installedBundles(profile: string): readonly string[] {
  const home = process.env['DSH_HOME'] ?? join(homedir(), '.dsh')
  try {
    const manifest = JSON.parse(readFileSync(join(home, 'profiles', profile, 'package.json'), 'utf8')) as {
      dsh?: { profile?: { bundles?: unknown } }
    }
    const bundles = manifest.dsh?.profile?.bundles
    return Array.isArray(bundles) ? bundles.filter((name): name is string => typeof name === 'string') : []
  } catch {
    // No profile manifest yet, or unreadable: nothing is known to be installed.
    return []
  }
}

/**
 * Actual on-disk version of each installed bundle, so the panel can compare
 * with the catalog and offer updates. Reads each package's own manifest under
 * the profile's node_modules; a bundle listed but not yet materialized simply
 * has no entry.
 */
function installedVersionsOf(profile: string): Record<string, string> {
  const home = process.env['DSH_HOME'] ?? join(homedir(), '.dsh')
  const versions: Record<string, string> = {}
  for (const name of installedBundles(profile)) {
    try {
      const manifest = JSON.parse(
        readFileSync(join(home, 'profiles', profile, 'node_modules', name, 'package.json'), 'utf8'),
      ) as { version?: unknown }
      if (typeof manifest.version === 'string') versions[name] = manifest.version
    } catch {
      // Listed but not installed on disk yet; nothing to compare.
    }
  }
  return versions
}

/** True when the request's Origin matches its Host — required on every POST. */
function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin
  const host = request.headers.host
  if (typeof origin !== 'string' || typeof host !== 'string') return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** Read a JSON request body, bounded so a large POST cannot exhaust memory. */
async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > 64 * 1024) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Answer one request with JSON, uncached by the browser. */
function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(payload))
}

/** Fetch and normalize one catalog page. */
async function fetchCatalog(url: string, timeoutMs: number): Promise<CatalogPage> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`${url} answered ${res.status}`)
    const { normalizeCatalog } = await import('./catalog.js')
    return normalizeCatalog(await res.json() as unknown)
  } finally {
    clearTimeout(timer)
  }
}

export type { MarketItem as CatalogItem }
