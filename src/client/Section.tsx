/**
 * The research market page inside Settings.
 *
 * Laid out the way the shipped settings pages are: a titled header, tabs, then
 * the body. The first cut put a disclosure paragraph in the most valuable
 * space on the page and left the reader scrolling past it on every visit — it
 * now sits under the list, where a footnote belongs, without being any less
 * present.
 *
 * Rows carry Install and Remove rather than a command to paste; what the
 * button actually runs, and why this panel may run it, is in `../index.ts`.
 */

import { useEffect, useState } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { MarketItem } from '../shared/route.js'
import type {} from './locales.js'
import type { MarketState, Store } from './store.js'
import { installCommand } from './store.js'
import { Confirm } from './Confirm.js'
import { cls } from './styles.js'
import type { PluginConfigView } from './plugin-config.js'

/** The registration-side face this plugin's section injects. */
export interface MarketSectionFace {
  hooks: {
    /** Panel snapshot, bound by the renderer as `useMarket`. */
    market: Store<MarketState>
  }
  /** Entries after the current text filter, recomputed per render. */
  visible(): readonly MarketItem[]
  /** Set the filter text. */
  search(query: string): void
  /** Copy one entry's install command. */
  copy(item: MarketItem): void
  /** Install one entry into the running profile. */
  install(item: MarketItem): void
  /** Remove one entry from the running profile. */
  uninstall(item: MarketItem): void
  /** Whether the entry is already a bundle in the profile. */
  isInstalled(item: MarketItem): boolean
  /** Catalog version an installed entry should move to, or undefined when current. */
  updateFor(item: MarketItem): string | undefined
  /** Whether the install and remove buttons are offered at all. */
  canInstall: boolean
  /** Restart the host so pending changes take effect. */
  restartHost(): void
  /** Whether the restart button is offered at all. */
  canRestart: boolean
  /** Load or reload the catalog. */
  refresh(): void
  /** Where the full index lives on the web. */
  siteUrl: string
}

/** Props the slot renderer passes in. */
export type MarketSectionProps = PropsLocale<'settings.researchMarket'>
  & InjectFace<MarketSectionFace>

/** The host owns the native page title; summaries contain inline copy only. */
export function MarketPluginConfig(props: MarketSectionProps & PluginConfigView) {
  return props.view === 'summary' ? <>{props.t('intro')}</> : <MarketSection {...props} />
}

/** Which list the reader is looking at. */
type Tab = 'discover' | 'installed'

/** A mutation waiting for the reader to agree to it. */
type Pending =
  | { readonly kind: 'install' | 'update' | 'remove'; readonly item: MarketItem }
  | { readonly kind: 'restart' }

/**
 * Locale keys for the categories this index uses. A category the panel does
 * not know is shown as the catalog spelled it, rather than hidden — a new
 * category should appear the day the catalog carries it.
 */
const CATEGORY_KEY: Readonly<Record<string, 'catLiterature' | 'catReference' | 'catWriting' | 'catWorkbench' | 'catPacks'>> = {
  literature: 'catLiterature',
  'reference-management': 'catReference',
  writing: 'catWriting',
  workbench: 'catWorkbench',
  'skill-pack': 'catPacks',
}

/** A magnifier that inherits the input's colour, so no icon package is needed. */
function SearchIcon(): JSX.Element {
  return (
    <svg className={cls.searchIcon} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.2 9.2 12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** The page's own mark, matching the sidebar entry. */
function TitleIcon(): JSX.Element {
  return (
    <svg className={cls.titleIcon} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 2.5h7l3 3v8h-10z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9.5 2.5v3.5h3.5M5.5 8.5h5M5.5 11h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The command a pending mutation will run, for the dialog to show verbatim.
 *
 * The profile is substituted, not left as a placeholder: a confirmation that
 * shows `--profile <profile>` has told the reader nothing about which
 * composition is about to change, which is half of what it is for.
 */
function commandFor(pending: Pending, profile: string): string | undefined {
  if (pending.kind === 'restart' || pending.item.npm === undefined) return undefined
  if (pending.kind === 'remove') return `dsh plugin --profile ${profile} remove ${pending.item.npm}`
  // Install and update run the same pinned add; showing the exact spec is the
  // point of this dialog.
  const spec = pending.item.version === undefined ? pending.item.npm : `${pending.item.npm}@${pending.item.version}`
  return `dsh plugin --profile ${profile} add ${spec}`
}

/**
 * Render the panel.
 * @param props - runtime hooks, locale binding, and the injected face.
 * @returns the settings page content.
 */
export function MarketSection(props: MarketSectionProps): JSX.Element {
  const {
    t, visible, search, copy, install, uninstall, isInstalled, updateFor,
    canInstall, restartHost, canRestart, refresh, siteUrl,
  } = props
  const state = props.useMarket((snapshot) => snapshot)
  const categoryLabel = (name: string): string => {
    const key = CATEGORY_KEY[name]
    return key === undefined ? name : t(key)
  }
  const [tab, setTab] = useState<Tab>('discover')
  const [category, setCategory] = useState<string>('')
  const [pending, setPending] = useState<Pending | undefined>(undefined)
  const [opened, setOpened] = useState<string | undefined>(undefined)
  // Re-render once a second while something runs, so the elapsed counter moves
  // and a minutes-long install does not look like a hang.
  const [, tick] = useState(0)
  useEffect(() => {
    if (state.installing === undefined) return
    const timer = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [state.installing])

  const waiting = state.restartPhase === 'waiting'
  // A host with a terminal is restarted by the person at that terminal, so the
  // dialog for it is instructions plus the command, not a confirmation.
  const byHand = state.attached

  const commit = (): void => {
    if (pending === undefined) return
    if (pending.kind === 'install' || pending.kind === 'update') install(pending.item)
    else if (pending.kind === 'remove') uninstall(pending.item)
    else {
      // Copy first, then ask anyway: the host is the authority on whether it
      // has a terminal, and asking is what puts the instruction on screen.
      if (byHand) void globalThis.navigator?.clipboard?.writeText(state.restartCommand)
      restartHost()
    }
    setPending(undefined)
  }

  /** What the strip says about the restart, in the only terms that are true. */
  const restartStatus = (): string => {
    switch (state.restartPhase) {
      case 'waiting': return t('restartWaiting')
      case 'back': return t('restartBack')
      case 'manual': return t('restartManualHint').replace('{command}', state.restartCommand)
      case 'stayed': return t('restartStayed')
      case 'lost': return t('restartLost')
        .replace('{command}', state.restartCommand)
        .replace('{log}', state.restartLog ?? '')
      default: return t('restartHint').replace('{n}', String(state.pendingRestart.length))
    }
  }

  useEffect(() => {
    // One load when the page first mounts; the store keeps it afterwards.
    if (state.items.length === 0 && state.error === undefined) refresh()
  }, [])

  const installedCount = state.items.filter((item) => isInstalled(item)).length
  // Categories come from the catalog, so a new one appears without a release.
  const categories = [...new Set(state.items.map((item) => item.category))].sort()
  const rows = visible()
    .filter((item) => tab === 'discover' || isInstalled(item))
    .filter((item) => category === '' || item.category === category)

  return (
    <div className={cls.root}>
      <div className={cls.head}>
        <h2 className={cls.title}><TitleIcon />{t('title')}</h2>
        <p className={cls.sub}>
          <span>{t('intro')}</span>
          <span className={cls.headAction}>
            <a className={cls.link} href={siteUrl} target="_blank" rel="noreferrer noopener">{t('site')}</a>
            {/* Always reachable: wanting to restart is not the same as having
                just changed something, and the banner below only appears for
                the second case. */}
            {canRestart && (
              <button
                type="button" className={cls.ghost} disabled={waiting}
                onClick={() => setPending({ kind: 'restart' })} title={t('restartTitle')}
              >{waiting ? t('restarting') : t('restartNow')}</button>
            )}
          </span>
        </p>
      </div>

      <div className={cls.tabs} role="tablist">
        <button
          type="button" role="tab" aria-selected={tab === 'discover'}
          className={`${cls.tab}${tab === 'discover' ? ` ${cls.tabOn}` : ''}`}
          onClick={() => setTab('discover')}
        >{t('tabDiscover')}</button>
        <button
          type="button" role="tab" aria-selected={tab === 'installed'}
          className={`${cls.tab}${tab === 'installed' ? ` ${cls.tabOn}` : ''}`}
          onClick={() => setTab('installed')}
        >{`${t('tabInstalled')} (${installedCount})`}</button>
      </div>

      <div className={cls.body}>
        {state.error !== undefined && (
          <p className={cls.warn}>
            {t('error')}{state.error}{' '}
            <button type="button" className={cls.ghost} onClick={() => refresh()}>{t('retry')}</button>
          </p>
        )}
        {state.stale && <p className={cls.warn}>{t('stale')}</p>}

        {canRestart && (state.pendingRestart.length > 0 || state.restartPhase !== undefined) && (
          <div className={cls.bar}>
            <span>{restartStatus()}</span>
            {state.restartPhase === 'back'
              ? (
                <button
                  type="button" className={cls.primary}
                  onClick={() => { globalThis.location?.reload() }}
                >{t('reload')}</button>
                )
              : state.restartPhase === undefined && (
                <button
                  type="button" className={cls.primary}
                  onClick={() => setPending({ kind: 'restart' })}
                >{t('restartNow')}</button>
              )}
          </div>
        )}

        <div className={cls.searchWrap}>
          <SearchIcon />
          <input
            className={cls.search} type="search" value={state.query}
            placeholder={t('search')} aria-label={t('search')}
            onChange={(event) => search(event.target.value)}
          />
        </div>

        {categories.length > 1 && (
          <div className={cls.chips}>
            <button
              type="button"
              className={`${cls.chip}${category === '' ? ` ${cls.chipOn}` : ''}`}
              onClick={() => setCategory('')}
            >{t('allCategories')}</button>
            {categories.map((name) => (
              <button
                key={name} type="button"
                className={`${cls.chip}${category === name ? ` ${cls.chipOn}` : ''}`}
                onClick={() => setCategory(name)}
              >{categoryLabel(name)}</button>
            ))}
          </div>
        )}

        {state.loading && state.items.length === 0
          ? <p className={cls.note}>{t('loading')}</p>
          : rows.length === 0
            ? <p className={cls.empty}>{tab === 'installed' ? t('emptyInstalled') : t('empty')}</p>
            : (
              <ul className={cls.list}>
                {rows.map((item: MarketItem) => {
                  const command = installCommand(item)
                  const done = isInstalled(item)
                  const update = updateFor(item)
                  const busy = state.installing === item.npm
                  const pending = item.npm !== undefined && state.pendingRestart.includes(item.npm)
                  const failure = state.failures[item.npm ?? '']
                  return (
                    <li key={item.id} className={cls.card}>
                      <div className={cls.cardHead}>
                        {item.icon !== undefined && (
                          // Inline data URI from the catalog — never a remote
                          // URL (the parser enforces it), so no request leaves
                          // the machine for this pixel.
                          <img className={cls.avatar} src={item.icon} alt="" aria-hidden="true" />
                        )}
                        <a className={cls.name} href={item.homepage} target="_blank" rel="noreferrer noopener">
                          {item.repo}
                        </a>
                        {item.ours && <span className={cls.badge}>{t('ours')}</span>}
                      </div>
                      <p className={cls.meta}>
                        {item.npm ?? t('noNpm')}
                        {item.version !== undefined ? ` v${item.version}` : ''}
                        {item.versionAt !== undefined ? ` · ${t('publishedOn').replace('{d}', item.versionAt)}` : ''}
                        {item.license !== undefined ? ` · ${item.license}` : ''}
                        {item.stars !== undefined ? ` · ★ ${item.stars}` : ''}
                        {done ? ` · ${pending ? t('restart') : t('installed')}` : ''}
                        {done && update !== undefined
                          ? ` · ${t('installedVersion').replace('{v}', state.installedVersions[item.npm ?? ''] ?? '?')}`
                          : ''}
                      </p>
                      <p className={cls.summary}>{item.summary}</p>
                      {item.detail !== undefined && (
                        opened === item.id
                          ? <p className={cls.detail}>{item.detail}</p>
                          : <button type="button" className={cls.more} onClick={() => setOpened(item.id)}>{t('more')}</button>
                      )}
                      {failure !== undefined && (() => {
                        // Headline inline, CLI tail in its own block: the tail is
                        // multi-line pnpm output, and collapsing it into the
                        // sentence is what made a failure unreadable even once
                        // the text reached the card.
                        const split = failure.indexOf('\n')
                        const headline = split === -1 ? failure : failure.slice(0, split)
                        const tail = split === -1 ? undefined : failure.slice(split + 1)
                        return (
                          <>
                            <p className={cls.warn}>{t('failed')}: {headline}</p>
                            {tail !== undefined && <pre className={cls.warnOutput}>{tail}</pre>}
                          </>
                        )
                      })()}
                      {busy && (
                        <div className={cls.progress}>
                          <p className={cls.progressText}>
                            {done ? t('progressRemove') : t('progressInstall')}
                            {state.startedAt !== undefined
                              && ` · ${t('progressElapsed').replace('{n}', String(Math.max(0, Math.round((Date.now() - state.startedAt) / 1000))))}`}
                          </p>
                          <div className={cls.progressTrack} role="progressbar" aria-label={t('installing')} />
                        </div>
                      )}
                      <div className={cls.cardFoot}>
                        <span className={cls.tag}>{categoryLabel(item.category)}</span>
                        <span className={cls.actions}>
                          <button
                            type="button" className={cls.ghost} title={command ?? ''}
                            disabled={command === undefined} onClick={() => copy(item)}
                          >
                            {state.copied === item.id ? t('copied') : t('copy')}
                          </button>
                          {canInstall && done && update !== undefined && (
                            <button
                              type="button" className={cls.primary}
                              disabled={state.installing !== undefined}
                              onClick={() => setPending({ kind: 'update', item })}
                            >{busy ? t('installing') : t('update').replace('{v}', update)}</button>
                          )}
                          {canInstall && (done
                            ? (
                              <button
                                type="button" className={cls.ghost}
                                disabled={state.installing !== undefined} onClick={() => setPending({ kind: 'remove', item })}
                              >{busy ? t('uninstalling') : t('uninstall')}</button>
                            )
                            : (
                              <button
                                type="button" className={cls.primary}
                                disabled={command === undefined || state.installing !== undefined}
                                onClick={() => setPending({ kind: 'install', item })}
                              >{busy ? t('installing') : t('install')}</button>
                            ))}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

        {pending !== undefined && (
          <Confirm
            title={pending.kind === 'restart'
              ? t(byHand ? 'restartManualTitle' : 'confirmRestartTitle')
              : t(pending.kind === 'install' ? 'confirmInstallTitle' : pending.kind === 'update' ? 'confirmUpdateTitle' : 'confirmRemoveTitle').replace('{name}', pending.item.repo)}
            command={pending.kind === 'restart'
              ? (byHand ? state.restartCommand : undefined)
              : commandFor(pending, state.profile)}
            confirmLabel={t(pending.kind === 'restart' && byHand ? 'copy' : 'confirmYes')}
            cancelLabel={t('confirmNo')}
            closeLabel={t('confirmClose')}
            onConfirm={commit}
            onCancel={() => setPending(undefined)}
          >
            {pending.kind === 'restart'
              ? <span>{t(byHand ? 'restartManualBody' : 'confirmRestartBody')}</span>
              : (
                <>
                  <span>{pending.item.summary}</span>
                  <span>{pending.kind === 'remove'
                    ? t('confirmRemoveBody')
                    : pending.kind === 'update'
                      ? t('confirmUpdateBody')
                        .replace('{from}', state.installedVersions[pending.item.npm ?? ''] ?? '?')
                        .replace('{to}', pending.item.version ?? '?')
                      : pending.item.ours
                        ? t('confirmOurs')
                        : t('confirmThird').replace('{publisher}', pending.item.publisher ?? pending.item.repo.split('/')[0] ?? '')}</span>
                  <span>{t('confirmProfile')}<b>{state.profile}</b>.</span>
                  <span>{t('confirmWillRun')}</span>
                </>
              )}
          </Confirm>
        )}

        <p className={cls.disclosure}>
          {t('disclosure')}
          {state.profile !== '' ? ` ${t('profileNote')}${state.profile}.` : ''}
          {state.revision !== '' ? ` ${t('revision')}${state.revision.slice(0, 10)}.` : ''}
        </p>
      </div>
    </div>
  )
}
