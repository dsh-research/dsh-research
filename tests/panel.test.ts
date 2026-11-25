/**
 * What the panel renders, as opposed to what its store holds.
 *
 * The store tests could not have caught the panel offering a Web-only restart
 * button on Desktop: the store was right in every state they gave it, and what
 * went wrong was what the panel did with a state it had never been handed — a
 * catalog that could not be read.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { MarketController, MarketSection } from '../src/client/index.js'
import type { MarketSectionProps, MarketState } from '../src/client/index.js'
import { en } from '../src/client/locales.js'
import type { MarketLocaleKey } from '../src/client/locales.js'

/** Render the panel over a controller's state, with the English copy. */
function render(controller: MarketController): string {
  const state = controller.state()
  const props = {
    t: (key: MarketLocaleKey) => en[key],
    useMarket: (select: (snapshot: MarketState) => MarketState) => select(state),
    hooks: { market: controller.store },
    visible: () => controller.visible(),
    search: (query: string) => controller.search(query),
    copy: () => undefined,
    install: () => undefined,
    uninstall: () => undefined,
    restartHost: () => undefined,
    isInstalled: controller.isInstalled.bind(controller),
    updateFor: controller.updateFor.bind(controller),
    canInstall: true,
    canRestart: true,
    refresh: () => undefined,
    siteUrl: 'https://dsh-research.com/plugins/',
  } as unknown as MarketSectionProps
  return renderToStaticMarkup(createElement(MarketSection, props))
}

describe('the panel while the catalog cannot be read', () => {
  const realFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = realFetch })

  /** Answer the catalog route the way the host does when the feed is unreachable. */
  function catalogFails(host: Record<string, unknown>): Promise<MarketController> {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      error: 'catalog unavailable: no answer from dsh-research.com within 8 s', installed: [], installedVersions: {}, ...host,
    }), { status: 502, headers: { 'content-type': 'application/json' } })) as typeof globalThis.fetch
    const controller = new MarketController()
    return controller.refresh().then(() => controller)
  }

  it('shows the reason, and no restart button, on Desktop', async () => {
    // Desktop applies plugins through its own manager and is not restarted
    // from this panel. A Web host's button there does nothing but fail.
    const html = render(await catalogFails({ nativeManagement: true, profile: 'desktop', allowRestart: true }))
    expect(html).toContain(en.error)
    expect(html).toContain('catalog unavailable: no answer from dsh-research.com within 8 s')
    expect(html).toContain(en.retry)
    expect(html).not.toContain(en.restartNow)
  })

  it('still offers the restart button on a Web host, where it is the panel\'s to offer', async () => {
    const html = render(await catalogFails({ nativeManagement: false, profile: 'web', allowRestart: true }))
    expect(html).toContain(en.restartNow)
  })

  it('says a list is a cached snapshot when only the refresh failed', async () => {
    const controller = new MarketController(async () => ({
      items: [], revision: 'r', stale: true, installed: [], installedVersions: {}, profile: 'web', attached: false, restartCommand: 'dsh web',
    }))
    await controller.refresh()
    expect(render(controller)).toContain(en.stale)
  })
})
