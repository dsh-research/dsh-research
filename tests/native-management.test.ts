import { describe, expect, it, vi } from 'vitest'
import { applyNativeManagement, managementAnswer } from '../src/native-management.js'
import type { NativeManager, NativeRoute } from '../src/native-management.js'
import { NATIVE_INSTALL_ROUTE, NATIVE_REMOVE_ROUTE } from '../src/shared/route.js'
import { MarketController, requestInstall, requestRemove } from '../src/client/store.js'
import type { CatalogResponse, MarketItem } from '../src/shared/route.js'

const item: MarketItem = { id: 'test', npm: 'dsh-test', repo: 'test/dsh-test', summary: 'fixture', category: 'literature', homepage: 'https://example.com', ours: true, version: '1.2.3' }
const catalog: CatalogResponse = { items: [item], revision: 'test', installed: [], installedVersions: {}, profile: 'desktop', attached: false, restartCommand: '', nativeManagement: true }
function mount(config = {}) {
  const routes = new Map<string, NativeRoute>()
  const dispose: (() => void)[] = []
  const manager = {
    listBundles: vi.fn<NativeManager['listBundles']>().mockResolvedValue([]),
    installBundle: vi.fn<NativeManager['installBundle']>().mockResolvedValue({ application: 'applied', version: '1.2.3' }),
    updateBundle: vi.fn<NativeManager['updateBundle']>().mockResolvedValue({ result: { application: 'restart-required' } }),
    removeBundle: vi.fn<NativeManager['removeBundle']>().mockResolvedValue({ application: 'applied' }),
  }
  const connection = { fetch: { register: (route: NativeRoute) => routes.set(route.path, route) } }
  const child = { get: (name: string) => name === 'connection' ? connection : manager, effect: (f: () => () => void) => { dispose.push(f()) } }
  const ctx = { inject: (deps: string[], f: (child: unknown) => void) => { expect(deps).toEqual(['connection', 'pluginManager']); f(child) } }
  const state = applyNativeManagement(ctx as never, { allowInstall: true, profileMatches: true, items: () => [item], ...config })
  const call = (path = NATIVE_INSTALL_ROUTE, body = JSON.stringify({ npm: item.npm })) => routes.get(path)!.fetch(new Request(`http://localhost${path}`, { method: 'POST', body }))
  return { routes, manager, call, dispose, state }
}

describe('authenticated native management bridge', () => {
  it('uses the owner fetch registry for Origin-less Desktop forwarding, pins and activates the reviewed version', async () => {
    const { call, manager, routes } = mount()
    expect([...routes.keys()]).toEqual([NATIVE_INSTALL_ROUTE, NATIVE_REMOVE_ROUTE])
    const response = await call()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, restartRequired: false, version: '1.2.3' })
    expect(manager.installBundle).toHaveBeenCalledWith('dsh-test@1.2.3', { enabled: true, saveExact: true })
  })
  it('updates installed bundles through the rollback-capable native update path', async () => {
    const { call, manager } = mount()
    manager.listBundles.mockResolvedValue([{ name: 'dsh-test', installed: true, enabled: false }])
    expect(await (await call()).json()).toMatchObject({ ok: true, restartRequired: true })
    expect(manager.updateBundle).toHaveBeenCalledWith('dsh-test', '1.2.3')
    expect(manager.installBundle).not.toHaveBeenCalled()
  })
  it('removes through the native manager', async () => {
    const { call, manager } = mount()
    expect((await call(NATIVE_REMOVE_ROUTE)).status).toBe(200)
    expect(manager.removeBundle).toHaveBeenCalledWith('dsh-test')
  })
  it.each([{ allowInstall: false }, { profileMatches: false }])('honors local policy %j', async options => {
    const { call, manager } = mount(options)
    expect((await call()).status).toBeGreaterThanOrEqual(400)
    expect(manager.installBundle).not.toHaveBeenCalled()
  })
  it.each(['{}', '{"npm":"not-listed"}', 'null', '{broken', 'x'.repeat(65537)])('refuses invalid or unlisted requests', async body => {
    const { call, manager } = mount()
    expect((await call(NATIVE_INSTALL_ROUTE, body)).status).toBe(400)
    expect(manager.installBundle).not.toHaveBeenCalled()
  })
  it('serializes mutations and unlocks after a rejected operation', async () => {
    const { call, manager } = mount()
    let reject!: (error: Error) => void
    manager.installBundle.mockReturnValueOnce(new Promise((_resolve, r) => { reject = r }))
    const first = call()
    await vi.waitFor(() => expect(manager.installBundle).toHaveBeenCalledTimes(1))
    expect((await call(NATIVE_REMOVE_ROUTE)).status).toBe(409)
    reject(new Error('native manager unavailable'))
    expect(await (await first).json()).toMatchObject({ ok: false, error: 'native manager unavailable' })
    expect((await call()).status).toBe(200)
  })
  it('loads a fresh allowlist after remount and serializes simultaneous body reads', async () => {
    const items = vi.fn().mockResolvedValue([item])
    const { call, manager } = mount({ items })
    let finish!: (value: { application: 'applied' }) => void
    manager.installBundle.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const first = call()
    const second = call()
    await vi.waitFor(() => expect(manager.installBundle).toHaveBeenCalledTimes(1))
    finish({ application: 'applied' })
    const responses = await Promise.all([first, second])
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    expect(items).toHaveBeenCalled()
  })
  it('fails closed when a remounted allowlist cannot be restored', async () => {
    const { call, manager } = mount({ items: async () => { throw new Error('offline') } })
    expect((await call()).status).toBe(502)
    expect(manager.installBundle).not.toHaveBeenCalled()
  })
  it('clears availability when its service fiber is disposed', () => {
    const { state, dispose } = mount()
    expect(state.manager).toBeDefined()
    dispose.forEach(f => f())
    expect(state.manager).toBeUndefined()
  })
  it.each(['failed', 'cancelled', 'overridden'] as const)('does not present %s as an installed plugin', application => {
    expect(managementAnswer('dsh-test', { application })).toMatchObject({ ok: false, error: application })
  })
  it('retains the actionable native package failure', () => {
    expect(managementAnswer('dsh-test', { application: 'failed', error: { code: 'operation-error', diagnostic: 'registry unavailable' }, packageResult: { output: 'ERR_PNPM_FETCH_404' } })).toMatchObject({ ok: false, error: 'registry unavailable', output: 'ERR_PNPM_FETCH_404' })
  })
})

describe('market client with a native host', () => {
  it('uses authenticated native routes and retains activation fields', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, npm: 'dsh-test', restartRequired: false, version: '1.2.3' })))
    try {
      expect(await requestInstall('dsh-test', true)).toMatchObject({ restartRequired: false })
      expect(fetch.mock.calls[0]![0]).toBe(NATIVE_INSTALL_ROUTE)
      fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, npm: 'dsh-test', restartRequired: false })))
      await requestRemove('dsh-test', true)
      expect(fetch.mock.calls[1]![0]).toBe(NATIVE_REMOVE_ROUTE)
    } finally { fetch.mockRestore() }
  })
  it('does not ask for restart after an applied install or removal', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, npm: item.npm, restartRequired: false, version: '1.2.3' })
    const restart = vi.fn()
    const c = new MarketController(async () => catalog, request, request, restart)
    await c.refresh(); await c.install(item)
    expect(request).toHaveBeenCalledWith('dsh-test', true)
    expect(c.state().installed).toContain('dsh-test')
    expect(c.state().pendingRestart).toEqual([])
    await c.uninstall(item)
    expect(c.state().installed).not.toContain('dsh-test')
    expect(c.state().pendingRestart).toEqual([])
    await c.restartHost()
    expect(restart).not.toHaveBeenCalled()
  })
  it('shows restart-required without invoking the legacy Desktop relaunch', async () => {
    const c = new MarketController(async () => catalog, async () => ({ ok: true, npm: 'dsh-test', restartRequired: true }))
    await c.refresh(); await c.install(item)
    expect(c.state().pendingRestart).toEqual(['dsh-test'])
  })
  it('clears busy state on network failure so retry is possible', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('connection lost')).mockResolvedValue({ ok: true, npm: item.npm, restartRequired: false })
    const c = new MarketController(async () => catalog, request)
    await c.refresh(); await c.install(item)
    expect(c.state().installing).toBeUndefined()
    expect(c.state().failures['dsh-test']).toBe('connection lost')
    await c.install(item)
    expect(c.state().failures).toEqual({})
    expect(c.isInstalled(item)).toBe(true)
  })
})
