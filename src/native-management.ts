import type { Context } from '@deepseek-ai/cordis'
import type { InstallResponse, MarketItem } from './shared/route.js'
import { NATIVE_INSTALL_ROUTE, NATIVE_REMOVE_ROUTE } from './shared/route.js'
import { installSpec } from './install.js'

/** Additive host contracts; the build SDK predates the native manager. */
export interface ManagementResult {
  application: 'applied' | 'restart-required' | 'failed' | 'cancelled' | 'overridden'
  version?: string
  error?: { code: string; diagnostic?: string }
  packageResult?: { output: string }
}
export interface NativeManager {
  listBundles(): Promise<readonly { name: string; installed: boolean; enabled: boolean; version?: string }[]>
  installBundle(spec: string, options: { enabled: boolean; saveExact: boolean }): Promise<ManagementResult>
  updateBundle(name: string, version: string): Promise<{ result: ManagementResult }>
  removeBundle(name: string): Promise<ManagementResult>
}
export interface NativeRoute {
  path: string
  methods: readonly string[]
  requestBody: 'buffered'
  fetch(request: Request): Promise<Response>
}
interface Connection { fetch?: { register(route: NativeRoute): unknown } }

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
})

/** Keep the host's failure and actual activation result, including package diagnostics. */
export function managementAnswer(npm: string, result: ManagementResult): InstallResponse {
  const ok = result.application === 'applied' || result.application === 'restart-required'
  return {
    ok, npm, restartRequired: result.application === 'restart-required',
    ...(result.version === undefined ? {} : { version: result.version }),
    ...(ok ? {} : { error: result.error?.diagnostic || result.error?.code || result.application }),
    ...(!ok && result.packageResult?.output ? { output: result.packageResult.output.slice(-2000) } : {}),
  }
}

/**
 * Owner-authenticated fetch routes use the same manager as the native Plugins page.
 * The connection registry owns authentication, CSRF checks and route disposal.
 * Never relax the legacy public route's Origin check for Desktop's proxy.
 */
export function applyNativeManagement(ctx: Context, options: {
  allowInstall: boolean
  profileMatches: boolean
  items: () => readonly MarketItem[] | Promise<readonly MarketItem[]>
}): { manager: NativeManager | undefined } {
  const state: { manager: NativeManager | undefined } = { manager: undefined }
  ctx.inject(['connection', 'pluginManager'], child => {
    const bridge = (child.get('connection') as Connection | undefined)?.fetch
    const manager = child.get('pluginManager') as NativeManager | undefined
    if (!bridge?.register || !manager) return
    child.effect(() => {
      state.manager = manager
      return () => { state.manager = undefined }
    })
    let busy = false
    for (const [path, remove] of [[NATIVE_INSTALL_ROUTE, false], [NATIVE_REMOVE_ROUTE, true]] as const) {
      bridge.register({
        path, methods: ['POST'], requestBody: 'buffered',
        async fetch(request) {
          if (request.method !== 'POST') return json({ error: 'POST required' }, 405)
          if (!options.allowInstall) return json({ error: 'installation is disabled' }, 403)
          if (!options.profileMatches) return json({ error: 'Native plugin management only supports the running profile; remove the profile override.' }, 409)
          if (busy) return json({ error: 'another plugin operation is running' }, 409)
          let npm: string
          try {
            const text = await request.text()
            if (text.length > 64 * 1024) throw new Error('too large')
            const body = JSON.parse(text) as { npm?: unknown }
            npm = typeof body.npm === 'string' ? body.npm : ''
          } catch { return json({ error: 'malformed request body' }, 400) }
          let items: readonly MarketItem[]
          try { items = await options.items() }
          catch (cause) { return json({ error: `catalog unavailable: ${cause instanceof Error ? cause.message : String(cause)}` }, 502) }
          const item = items.find(item => item.npm === npm)
          if (!npm || !item) return json({ error: 'package is not in this catalog' }, 400)
          if (busy) return json({ error: 'another plugin operation is running' }, 409)
          busy = true
          try {
            let result: ManagementResult
            if (remove) result = await manager.removeBundle(npm)
            else {
              const installed = (await manager.listBundles()).find(bundle => bundle.name === npm && bundle.installed)
              if (installed) {
                if (!item.version) return json({ error: 'catalog version required for updates' }, 400)
                result = (await manager.updateBundle(npm, item.version)).result
              } else result = await manager.installBundle(installSpec(npm, item.version), { enabled: true, saveExact: true })
            }
            const answer = managementAnswer(npm, result)
            return json(answer, answer.ok ? 200 : 500)
          } catch (cause) {
            return json({ ok: false, npm, error: cause instanceof Error ? cause.message : String(cause) }, 500)
          } finally { busy = false }
        },
      })
    }
  })
  return state
}
