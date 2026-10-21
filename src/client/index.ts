/**
 * dsh-research, browser half. Contributes the curated research plugin market
 * to its native plugin detail page and to the Settings sidebar.
 *
 * The catalog is read from the Node half's route rather than from the network
 * directly, so the page has no third-party origin of its own and a slow
 * catalog cannot stall settings.
 * @module dsh-research/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the locale runtime's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the settings shell's SlotMap merge declaring `settings.section`.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { MarketController } from './store.js'
import type { MarketState, Store } from './store.js'
import { MarketPluginConfig, MarketSection } from './Section.js'
import type { MarketSectionFace } from './Section.js'
import { NS, en, zh } from './locales.js'
import { installStyles } from './styles.js'
import { pluginConfigSlots } from './plugin-config.js'

export { DOWN_BUDGET_MS, MarketController, PROBE_INTERVAL_MS, UP_BUDGET_MS, createStore, filterItems, installCommand, fetchCatalogRoute, probeHost, versionNewer } from './store.js'
export type { CatalogFetch, MarketState, RestartPhase, Store } from './store.js'
export { MarketSection } from './Section.js'
export type { MarketSectionFace, MarketSectionProps } from './Section.js'
export { NS, en, zh } from './locales.js'

/** Where the same index is published for reading in a browser. */
const SITE_URL = 'https://dsh-research.com/plugins/'

/** Cordis plugin name used by client-side loader diagnostics. */
export const name = 'research-market-client'

/**
 * Services this half reaches through `ctx.<name>`.
 *
 * Cordis refuses an undeclared property access — `ctx.locale` without this
 * line fails the whole loader entry with "cannot get property locale without
 * inject", which blanks the settings dialog rather than degrading. Both are
 * mandatory in every web composition, so requiring them costs nothing.
 */
export const inject = ['slots', 'locale']

/**
 * Register the settings page.
 * @param ctx - client context with slots, locale and store hooks.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => installStyles(), 'dsh-research: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-research: dictionaries')

  const controller = new MarketController()

  // The catalog is two feeds; the panel reads the one its interface speaks,
  // and follows the reader when they switch languages rather than keeping the
  // list they first happened to load.
  const applyLocale = (): void => {
    const before = controller.language()
    controller.setLanguage(ctx.locale.getLocale().active)
    if (controller.language() !== before && controller.state().items.length > 0) void controller.refresh()
  }
  applyLocale()
  ctx.effect(() => ctx.locale.subscribe(applyLocale))
  ctx.effect(() => () => controller.dispose())

  const face = (): MarketSectionFace => ({
    hooks: { market: controller.store as Store<MarketState> },
    visible: () => controller.visible(),
    search: (query) => controller.search(query),
    copy: (item) => { void controller.copy(item) },
    install: (item) => { void controller.install(item) },
    uninstall: (item) => { void controller.uninstall(item) },
    restartHost: () => { void controller.restartHost() },
    canRestart: true,
    isInstalled: (item) => controller.isInstalled(item),
    updateFor: (item) => controller.updateFor(item),
    canInstall: true,
    refresh: () => { void controller.refresh() },
    siteUrl: SITE_URL,
  })

  // The package listed under Plugins → Installed opens this market directly.
  // Lazy slot injection keeps the same bundle loadable on pre-manager hosts.
  const configSlots = pluginConfigSlots(ctx.slots)
  configSlots.inject('plugins.bundle.config', () => configSlots.register({
    name: 'plugins.bundle.config', key: 'dsh-research', locale: NS, inject: face,
  }, MarketPluginConfig))
  configSlots.inject('plugins.row.config', () => configSlots.register({
    name: 'plugins.row.config', key: 'dsh-research#research-market', locale: NS, inject: face,
  }, MarketPluginConfig))

  // Order 200: after the shipped sections, so this page never displaces a
  // built-in one for a user who installed it for one plugin.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'research-market',
    order: 200,
    label: () => ctx.locale.bind(NS)('nav'),
    locale: NS,
    inject: face,
  }, MarketSection))
}
