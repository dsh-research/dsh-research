import { afterEach, describe, expect, it } from 'vitest'
import { argvProfile, attachedToTerminal, installSpec, modulePathProfile, normalizeCatalog, pluginArgs, quoteCmdArg, resolveProfile, restartCommand, spawnEnv, trustedRestartRequest } from '../src/index.js'
import { MarketController, PROBE_INTERVAL_MS, filterItems, installCommand, versionNewer } from '../src/client/index.js'
import { failureText, requestInstall, requestRemove } from '../src/client/store.js'
import type { CatalogResponse, InstallResponse, MarketItem, RestartResponse } from '../src/index.js'

const PAGE = {
  schemaVersion: '1.0.0',
  revision: '2026-08-17T00:00:00Z',
  items: [
    {
      id: 'literaf-dsh-ai4scholar',
      summary: 'Academic search over Semantic Scholar, PubMed and more.',
      homepage: 'https://github.com/literaf/dsh-ai4scholar',
      categories: ['literature'],
      package: { registry: 'npm', name: 'dsh-ai4scholar' },
      publisher: { name: 'literaf' },
      license: 'MIT',
      latestVersion: '0.3.3',
      latestVersionAt: '2026-08-18',
      icon: 'data:image/png;base64,iVBORw0KGgo=',
    },
  ],
  page: { hasMore: false },
}

describe('catalog normalization', () => {
  it('keeps a well-formed entry and derives its repository slug', () => {
    const page = normalizeCatalog(PAGE)
    expect(page.items).toHaveLength(1)
    expect(page.items[0]).toMatchObject({ repo: 'literaf/dsh-ai4scholar', npm: 'dsh-ai4scholar', ours: true })
    expect(page.revision).toBe('2026-08-17T00:00:00Z')
  })

  it('drops entries the panel could only render half of', () => {
    const page = normalizeCatalog({
      items: [
        { id: 'a', homepage: 'https://github.com/x/y' },                 // no summary
        { summary: 's', homepage: 'https://github.com/x/y' },            // no id
        { id: 'c', summary: 's' },                                       // no homepage
        'not an object',
      ],
    })
    expect(page.items).toEqual([])
  })

  it('refuses a non-https homepage, because the panel renders it as a link', () => {
    const page = normalizeCatalog({ items: [{ id: 'a', summary: 's', homepage: 'javascript:alert(1)' }] })
    expect(page.items).toEqual([])
  })

  it('omits the package field when the catalog states no npm name', () => {
    // Guessing it would send a user to whatever package holds that name.
    const page = normalizeCatalog({ items: [{ id: 'a', summary: 's', homepage: 'https://github.com/x/y' }] })
    expect(page.items[0]?.npm).toBeUndefined()
    expect(installCommand(page.items[0]!)).toBeUndefined()
  })

  it('rejects a body that is not a provider page', () => {
    expect(() => normalizeCatalog(null)).toThrow(/not an object/)
    expect(() => normalizeCatalog({})).toThrow(/no items array/)
  })
})

describe('process layer', () => {
  it('reads the profile this host booted rather than assuming one', () => {
    expect(argvProfile(['node', 'dsh', '--profile', 'research', 'web'])).toBe('research')
    expect(argvProfile(['node', 'dsh', 'web'])).toBeUndefined()
    // A following flag is not a profile name.
    expect(argvProfile(['node', 'dsh', '--profile', '--verbose'])).toBeUndefined()
  })

  it('forces CI so pnpm fails instead of waiting on a prompt with no TTY', () => {
    expect(spawnEnv()['CI']).toBe('true')
  })

  it('quotes only the cmd.exe tokens that need it', () => {
    expect(quoteCmdArg('dsh-ai4scholar')).toBe('dsh-ai4scholar')
    expect(quoteCmdArg('a b')).toBe('"a b"')
    expect(quoteCmdArg('a"b')).toBe('"a""b"')
    expect(quoteCmdArg('a&b')).toBe('"a&b"')
  })
})

/** A catalog answer with one installable entry. */
function answer(overrides: Partial<CatalogResponse> = {}): CatalogResponse {
  return {
    items: normalizeCatalog(PAGE).items,
    revision: '2026-08-17', installed: [], installedVersions: {}, profile: 'web',
    attached: false, restartCommand: 'dsh web', ...overrides,
  }
}

describe('install flow', () => {
  it('records the install and asks for a restart', async () => {
    const calls: string[] = []
    const controller = new MarketController(
      () => Promise.resolve(answer()),
      (npm) => { calls.push(npm); return Promise.resolve({ ok: true, npm } satisfies InstallResponse) },
    )
    await controller.refresh()
    const item = controller.state().items[0]!
    expect(controller.isInstalled(item)).toBe(false)

    await controller.install(item)
    expect(calls).toEqual(['dsh-ai4scholar'])
    expect(controller.isInstalled(item)).toBe(true)
    expect(controller.state().pendingRestart).toEqual(['dsh-ai4scholar'])
    expect(controller.state().installing).toBeUndefined()
  })

  it('keeps a failure against its own row and leaves it installable', async () => {
    const controller = new MarketController(
      () => Promise.resolve(answer()),
      (npm) => Promise.resolve({ ok: false, npm, error: 'exited 1', output: 'pnpm said no' }),
    )
    await controller.refresh()
    const item = controller.state().items[0]!
    await controller.install(item)
    expect(controller.isInstalled(item)).toBe(false)
    expect(controller.state().failures['dsh-ai4scholar']).toContain('exited 1')
    expect(controller.state().failures['dsh-ai4scholar']).toContain('pnpm said no')
  })

  it('refuses a second install while one is running', async () => {
    let started = 0
    let release: (value: InstallResponse) => void = () => undefined
    const controller = new MarketController(
      () => Promise.resolve(answer()),
      (npm) => { started += 1; return new Promise<InstallResponse>((r) => { release = r }) },
    )
    await controller.refresh()
    const item = controller.state().items[0]!
    const first = controller.install(item)
    await controller.install(item)
    expect(started).toBe(1)
    release({ ok: true, npm: 'dsh-ai4scholar' })
    await first
  })

  it('marks an entry the profile already carries as installed', async () => {
    const controller = new MarketController(() => Promise.resolve(answer({ installed: ['dsh-ai4scholar'] })))
    await controller.refresh()
    expect(controller.isInstalled(controller.state().items[0]!)).toBe(true)
  })

  it('surfaces a catalog failure instead of rendering an empty list as success', async () => {
    const controller = new MarketController(() => Promise.reject(new Error('offline')))
    await controller.refresh()
    expect(controller.state().error).toBe('offline')
    expect(controller.state().loading).toBe(false)
  })
})

describe('who maintains an entry', () => {
  it('marks ours by publisher and by repository owner alike', () => {
    const mine = normalizeCatalog({ items: [{ id: 'a', summary: 's', homepage: 'https://github.com/literaf/x', publisher: { name: 'literaf' } }] })
    expect(mine.items[0]?.ours).toBe(true)
    expect(mine.items[0]?.publisher).toBe('literaf')
  })

  it('marks the dsh-research org as ours, same as the founding account', () => {
    const moved = {
      ...PAGE,
      items: [{
        ...PAGE.items[0]!,
        id: 'dsh-research-dsh-research',
        homepage: 'https://github.com/dsh-research/dsh-research',
        publisher: { name: 'dsh-research' },
      }],
    }
    expect(normalizeCatalog(moved).items[0]!.ours).toBe(true)
  })

  it('does not claim someone else\'s plugin as ours', () => {
    // The confirmation names the publisher when it is not us, so getting this
    // wrong would tell a reader we stand behind code we do not maintain.
    const theirs = normalizeCatalog({
      items: [{ id: 'b', summary: 's', homepage: 'https://github.com/STARDUSTLC666/dsh-cite', publisher: { name: 'STARDUSTLC666' } }],
    })
    expect(theirs.items[0]?.ours).toBe(false)
    expect(theirs.items[0]?.publisher).toBe('STARDUSTLC666')
  })

  it('keeps a declared licence distinguishable from a LICENSE file', () => {
    const declared = normalizeCatalog({ items: [{ id: 'c', summary: 's', homepage: 'https://github.com/x/y', license: 'MIT (declared)' }] })
    expect(declared.items[0]?.license).toBe('MIT (declared)')
  })
})

describe('catalog language', () => {
  it('asks for the feed matching the interface', async () => {
    const asked: string[] = []
    const controller = new MarketController((lang) => { asked.push(lang); return Promise.resolve(answer()) })
    await controller.refresh()
    expect(asked).toEqual(['en'])

    controller.setLanguage('zh-CN')
    await controller.refresh()
    // The contract fixes the item shape, so a bilingual catalog is two feeds.
    expect(asked).toEqual(['en', 'zh'])
  })

  it('treats anything that is not Chinese as the English feed', () => {
    const controller = new MarketController(() => Promise.resolve(answer()))
    for (const tag of ['en', 'en-GB', 'ja', 'fr-CA']) {
      controller.setLanguage(tag)
      expect(controller.language()).toBe('en')
    }
    for (const tag of ['zh', 'zh-CN', 'zh-Hant-TW', 'ZH']) {
      controller.setLanguage(tag)
      expect(controller.language()).toBe('zh')
    }
  })
})

describe('filtering', () => {
  const items = normalizeCatalog(PAGE).items as readonly MarketItem[]

  it('matches the fields a reader would search, case-insensitively', () => {
    expect(filterItems(items, 'PUBMED')).toHaveLength(1)
    expect(filterItems(items, 'literature')).toHaveLength(1)
    expect(filterItems(items, 'dsh-ai4scholar')).toHaveLength(1)
    expect(filterItems(items, 'nothing here')).toHaveLength(0)
    expect(filterItems(items, '   ')).toHaveLength(1)
  })
})

describe('removal and restart', () => {
  it('takes the entry back out and still asks for a restart', async () => {
    const removed: string[] = []
    const controller = new MarketController(
      () => Promise.resolve(answer({ installed: ['dsh-ai4scholar'] })),
      () => Promise.resolve({ ok: true, npm: 'dsh-ai4scholar' }),
      (npm) => { removed.push(npm); return Promise.resolve({ ok: true, npm }) },
    )
    await controller.refresh()
    const item = controller.state().items[0]!
    expect(controller.isInstalled(item)).toBe(true)

    await controller.uninstall(item)
    expect(removed).toEqual(['dsh-ai4scholar'])
    expect(controller.isInstalled(item)).toBe(false)
    // Removing needs a restart just as much as installing does.
    expect(controller.state().pendingRestart).toEqual(['dsh-ai4scholar'])
  })

  it('keeps the row installed when removal fails', async () => {
    const controller = new MarketController(
      () => Promise.resolve(answer({ installed: ['dsh-ai4scholar'] })),
      () => Promise.resolve({ ok: true, npm: 'dsh-ai4scholar' }),
      (npm) => Promise.resolve({ ok: false, npm, error: 'exited 1' }),
    )
    await controller.refresh()
    await controller.uninstall(controller.state().items[0]!)
    expect(controller.isInstalled(controller.state().items[0]!)).toBe(true)
    expect(controller.state().failures['dsh-ai4scholar']).toContain('exited 1')
  })

  it('shows the CLI diagnosis when removal fails, not just the exit code', async () => {
    // The remove path used to keep only `error`, so an uninstall that failed
    // because the package was not in the profile reported "exited 1" and
    // nothing a user could act on.
    const controller = new MarketController(
      () => Promise.resolve(answer({ installed: ['dsh-ai4scholar'] })),
      () => Promise.resolve({ ok: true, npm: 'dsh-ai4scholar' }),
      (npm) => Promise.resolve({
        ok: false, npm, error: 'dsh plugin remove exited 1',
        output: "ERR_PNPM_CANNOT_REMOVE_MISSING_DEPS  Cannot remove 'dsh-ai4scholar': project has no dependencies of any kind",
      }),
    )
    await controller.refresh()
    await controller.uninstall(controller.state().items[0]!)
    const shown = controller.state().failures['dsh-ai4scholar'] ?? ''
    expect(shown).toContain('dsh plugin remove exited 1')
    expect(shown).toContain('ERR_PNPM_CANNOT_REMOVE_MISSING_DEPS')
  })

  it('does not offer a second restart while one is under way', async () => {
    let calls = 0
    // A probe that never settles holds the controller in `waiting`, which is
    // the state the second press has to be refused in.
    const controller = new MarketController(
      () => Promise.resolve(answer()),
      (npm) => Promise.resolve({ ok: true, npm }),
      (npm) => Promise.resolve({ ok: true, npm }),
      () => { calls += 1; return Promise.resolve({ ok: true, mode: 'relaunch' } satisfies RestartResponse) },
      () => new Promise<boolean>(() => undefined),
    )
    void controller.restartHost()
    await controller.restartHost()
    expect(calls).toBe(1)
    expect(controller.state().restartPhase).toBe('waiting')
  })

  it('re-enables the button when the host refuses to restart', async () => {
    const controller = new MarketController(
      () => Promise.resolve(answer()),
      (npm) => Promise.resolve({ ok: true, npm }),
      (npm) => Promise.resolve({ ok: true, npm }),
      () => Promise.resolve({ ok: false, error: 'self-restart is disabled' }),
    )
    await controller.restartHost()
    expect(controller.state().restartPhase).toBeUndefined()
    expect(controller.state().error).toBe('self-restart is disabled')
  })
})

/**
 * A scripted liveness sequence and a clock that only moves when the controller
 * sleeps, so a ninety-second wait runs instantly and deterministically.
 * @param liveness - what each successive probe answers; the last value repeats.
 * @returns the three injectables plus a count of probes made.
 */
function watcher(liveness: readonly boolean[]): {
  probe: () => Promise<boolean>
  sleep: () => Promise<void>
  now: () => number
  probes: () => number
} {
  let index = 0
  let clock = 0
  return {
    probe: () => Promise.resolve(liveness[Math.min(index++, liveness.length - 1)] ?? false),
    sleep: () => { clock += PROBE_INTERVAL_MS; return Promise.resolve() },
    now: () => clock,
    probes: () => index,
  }
}

/** Build a controller whose restart answer and probe sequence are scripted. */
function restarting(response: RestartResponse, liveness: readonly boolean[]): {
  controller: MarketController
  probes: () => number
} {
  const watch = watcher(liveness)
  return {
    controller: new MarketController(
      () => Promise.resolve(answer()),
      (npm) => Promise.resolve({ ok: true, npm }),
      (npm) => Promise.resolve({ ok: true, npm }),
      () => Promise.resolve(response),
      watch.probe, watch.sleep, watch.now,
    ),
    probes: watch.probes,
  }
}

/*
 * These four cases are the whole reason the restart flow was rewritten. The
 * panel used to set one flag and assume the page was "about to go away", so
 * whatever happened next it kept saying "restarting…". In the failure a person
 * actually hit, the host did come back — detached, invisible, still holding the
 * port — and the panel had no way to say so.
 */
describe('waiting for the host to come back', () => {
  it('reports it back only after seeing it go away first', async () => {
    // Probing for "up" first would find the process that is still serving its
    // last half-second and call the restart done before it happened.
    const { controller, probes } = restarting({ ok: true, mode: 'relaunch' }, [true, false, false, true])
    await controller.restartHost()
    expect(controller.state().restartPhase).toBe('back')
    expect(probes()).toBe(4)
  })

  it('says the host never exited rather than claiming success', async () => {
    const { controller } = restarting({ ok: true, mode: 'relaunch' }, [true])
    await controller.restartHost()
    expect(controller.state().restartPhase).toBe('stayed')
  })

  it('names the log when the replacement never answers', async () => {
    const { controller } = restarting({ ok: true, mode: 'relaunch', log: '/tmp/restart.log' }, [false])
    await controller.restartHost()
    expect(controller.state().restartPhase).toBe('lost')
    expect(controller.state().restartLog).toBe('/tmp/restart.log')
  })

  it('hands back the command for a terminal-owned host and probes nothing', async () => {
    const { controller, probes } = restarting(
      { ok: false, mode: 'manual', command: 'dsh --profile web web' },
      [false, true],
    )
    await controller.restartHost()
    expect(controller.state().restartPhase).toBe('manual')
    expect(controller.state().restartCommand).toBe('dsh --profile web web')
    // Nothing was killed, so there is nothing to wait for.
    expect(probes()).toBe(0)
    expect(controller.state().error).toBeUndefined()
  })

  it('carries the host\'s own answer about who restarts it into the panel', async () => {
    const controller = new MarketController(
      () => Promise.resolve(answer({ attached: true, restartCommand: 'dsh web --port 8080' })),
    )
    await controller.refresh()
    expect(controller.state().attached).toBe(true)
    expect(controller.state().restartCommand).toBe('dsh web --port 8080')
  })
})

describe('who may restart this host', () => {
  it('treats either standard stream being a terminal as attached', () => {
    expect(attachedToTerminal({ stdout: { isTTY: true }, stdin: { isTTY: false } })).toBe(true)
    expect(attachedToTerminal({ stdout: { isTTY: false }, stdin: { isTTY: true } })).toBe(true)
    expect(attachedToTerminal({ stdout: { isTTY: false }, stdin: { isTTY: false } })).toBe(false)
    // A Dock launch has no streams at all, which is the case a relaunch is for.
    expect(attachedToTerminal({})).toBe(false)
  })

  it('reproduces the launch rather than assuming `dsh web`', () => {
    expect(restartCommand(['/usr/bin/node', '/opt/homebrew/bin/dsh', 'web'])).toBe('dsh web')
    expect(restartCommand(['/usr/bin/node', '/opt/homebrew/bin/dsh', '--profile', 'test', 'web', '--port', '8080']))
      .toBe('dsh --profile test web --port 8080')
  })

  it('falls back to the node invocation for a source launch', () => {
    expect(restartCommand(['/usr/bin/node', 'lib/bin.js', 'web'], '/usr/bin/node')).toBe('node lib/bin.js web')
  })
})

describe('process-control guard', () => {
  const base = { socket: { remoteAddress: '127.0.0.1' }, headers: { origin: 'http://127.0.0.1:3080', host: '127.0.0.1:3080' } }

  it('accepts a same-origin loopback request', () => {
    expect(trustedRestartRequest(base)).toBe(true)
  })

  it('refuses a non-loopback peer', () => {
    expect(trustedRestartRequest({ ...base, socket: { remoteAddress: '192.168.1.20' } })).toBe(false)
  })

  it('refuses a forwarded request, because that peer is a proxy not the user', () => {
    for (const header of ['forwarded', 'x-forwarded-for', 'x-real-ip']) {
      expect(trustedRestartRequest({ ...base, headers: { ...base.headers, [header]: 'anything' } })).toBe(false)
    }
  })

  it('refuses a cross-origin or headerless request', () => {
    expect(trustedRestartRequest({ ...base, headers: { ...base.headers, origin: 'http://evil.test' } })).toBe(false)
    expect(trustedRestartRequest({ ...base, headers: { host: '127.0.0.1:3080' } })).toBe(false)
  })
})

describe('pnpm workspace compatibility', () => {
  it('leaves the arguments alone for a profile that is not a workspace', () => {
    // The scratch profile name below has no pnpm-workspace.yaml.
    expect(pluginArgs('definitely-not-a-profile', ['add', 'dsh-ai4scholar']))
      .toEqual(['add', 'dsh-ai4scholar'])
  })

  it('passes through a subcommand pnpm does not gate', () => {
    expect(pluginArgs('definitely-not-a-profile', ['list'])).toEqual(['list'])
  })
})

describe('updates', () => {
  it('pins the install spec to the catalog version when one is stated', () => {
    expect(installSpec('dsh-ai4scholar', '0.3.3')).toBe('dsh-ai4scholar@0.3.3')
    // A catalog with no version falls back to the bare name rather than
    // inventing a pin.
    expect(installSpec('dsh-ai4scholar')).toBe('dsh-ai4scholar')
  })

  it('pins the copyable command the same way the host pins the install', () => {
    const [item] = normalizeCatalog(PAGE).items
    expect(installCommand(item!)).toBe('dsh plugin --profile web add dsh-ai4scholar@0.3.3')
  })

  it('offers an update only when the on-disk version differs from the catalog', async () => {
    const controller = new MarketController(() => Promise.resolve(answer({
      installed: ['dsh-ai4scholar'],
      installedVersions: { 'dsh-ai4scholar': '0.3.1' },
    })))
    await controller.refresh()
    const [item] = controller.state().items
    expect(controller.updateFor(item!)).toBe('0.3.3')
  })

  it('stays quiet when on disk already matches, and for entries not installed', async () => {
    const current = new MarketController(() => Promise.resolve(answer({
      installed: ['dsh-ai4scholar'],
      installedVersions: { 'dsh-ai4scholar': '0.3.3' },
    })))
    await current.refresh()
    expect(current.updateFor(current.state().items[0]!)).toBeUndefined()

    const absent = new MarketController(() => Promise.resolve(answer({})))
    await absent.refresh()
    expect(absent.updateFor(absent.state().items[0]!)).toBeUndefined()
  })

  it('never offers a downgrade when the disk is ahead of the catalog', async () => {
    // A linked developer checkout, or the minutes between an npm publish and
    // the feed adopting it: catalog 0.3.3, disk 0.4.1. The old inequality
    // check rendered an "update to v0.3.3" button here — a downgrade.
    const controller = new MarketController(() => Promise.resolve(answer({
      installed: ['dsh-ai4scholar'],
      installedVersions: { 'dsh-ai4scholar': '0.4.1' },
    })))
    await controller.refresh()
    expect(controller.updateFor(controller.state().items[0]!)).toBeUndefined()
  })

  it('orders versions numerically, not lexically', () => {
    expect(versionNewer('0.10.0', '0.9.9')).toBe(true)
    expect(versionNewer('0.9.9', '0.10.0')).toBe(false)
    expect(versionNewer('1.0.0', '1.0.0')).toBe(false)
    expect(versionNewer('1.0.1', '1.0.0')).toBe(true)
  })

  it('records the pinned version after a successful install, clearing the offer', async () => {
    let calls = 0
    const controller = new MarketController(
      () => Promise.resolve(answer({ installed: ['dsh-ai4scholar'], installedVersions: { 'dsh-ai4scholar': '0.3.1' } })),
      () => { calls += 1; return Promise.resolve({ ok: true, npm: 'dsh-ai4scholar' } as InstallResponse) },
    )
    await controller.refresh()
    const [item] = controller.state().items
    expect(controller.updateFor(item!)).toBe('0.3.3')
    await controller.install(item!)
    expect(calls).toBe(1)
    expect(controller.state().installedVersions['dsh-ai4scholar']).toBe('0.3.3')
    expect(controller.updateFor(item!)).toBeUndefined()
    // The change still needs a restart to take effect, same as a fresh install.
    expect(controller.state().pendingRestart).toContain('dsh-ai4scholar')
  })
})

describe('card imagery and dates', () => {
  it('accepts an inline icon and the publish date', () => {
    const [item] = normalizeCatalog(PAGE).items
    expect(item!.icon).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(item!.versionAt).toBe('2026-08-18')
  })

  it('refuses a remote icon URL — every pixel must ride the feed itself', () => {
    const remote = {
      ...PAGE,
      items: [{ ...PAGE.items[0]!, icon: 'https://github.com/literaf.png' }],
    }
    expect(normalizeCatalog(remote).items[0]!.icon).toBeUndefined()
  })

  it('refuses an oversized data URI rather than bloating every render', () => {
    const huge = {
      ...PAGE,
      items: [{ ...PAGE.items[0]!, icon: `data:image/png;base64,${'A'.repeat(70_000)}` }],
    }
    expect(normalizeCatalog(huge).items[0]!.icon).toBeUndefined()
  })
})

describe('which profile the panel decides it is running in', () => {
  const url = (p: string) => `file://${p}`

  it('reads the profile out of the path it was loaded from', () => {
    expect(modulePathProfile(url('/Users/x/.dsh/profiles/desktop/node_modules/dsh-research/lib/index.js')))
      .toBe('desktop')
    expect(modulePathProfile(url('/Users/x/.dsh/profiles/web/node_modules/dsh-research/lib/index.js')))
      .toBe('web')
  })

  it('covers the case argv cannot: DSH Desktop boots its host with no --profile', () => {
    // The app's own argv is literally just the binary, so argvProfile has
    // nothing to read and the old `?? 'web'` fallback pointed the panel at the
    // wrong profile entirely — reading web's installed versions and installing
    // into web while the app ran desktop.
    expect(argvProfile(['/Applications/DSH Desktop.app/Contents/MacOS/DSH Desktop'])).toBeUndefined()
    expect(modulePathProfile(url('/Users/x/.dsh/profiles/desktop/node_modules/dsh-research/lib/index.js')))
      .toBe('desktop')
  })

  it('takes the rightmost node_modules, so a nested copy still names the profile', () => {
    expect(modulePathProfile(url('/x/.dsh/profiles/desktop/node_modules/a/node_modules/dsh-research/lib/index.js')))
      .toBe('desktop')
  })

  it('declines to guess outside a profile, so the caller can fall back', () => {
    // A linked checkout, which is a real way this plugin runs. Guessing here
    // would mutate a profile the developer is not looking at.
    expect(modulePathProfile(url('/Users/x/ai4s/dsh-research/lib/index.js'))).toBeUndefined()
    // node_modules, but not under a profiles/<name> parent.
    expect(modulePathProfile(url('/Users/x/app/node_modules/dsh-research/lib/index.js'))).toBeUndefined()
    expect(modulePathProfile('not-a-url')).toBeUndefined()
  })
})

describe('the order the profile sources are trusted in', () => {
  const desktop = 'file:///Users/x/.dsh/profiles/desktop/node_modules/dsh-research/lib/index.js'

  it('lets an explicit config beat everything', () => {
    expect(resolveProfile('mine', 'booted', modulePathProfile(desktop))).toBe('mine')
  })

  it('prefers the booted profile over the load path', () => {
    // The CLI does pass `--profile`, and a linked plugin can be loaded from a
    // path that names some other profile. The running one wins.
    expect(resolveProfile(undefined, 'booted', modulePathProfile(desktop))).toBe('booted')
  })

  it('falls back to the load path, which is all DSH Desktop gives us', () => {
    // This is the wiring the bug lived in: the app boots its host in-process
    // with no argv, so without the load path the chain fell through to `web`
    // and the panel read and mutated a profile the app was not running.
    expect(resolveProfile(undefined, argvProfile(['/Applications/DSH Desktop.app/Contents/MacOS/DSH Desktop']), modulePathProfile(desktop)))
      .toBe('desktop')
  })

  it('lands on web only when no source knows', () => {
    expect(resolveProfile(undefined, undefined, undefined)).toBe('web')
  })
})

describe('what a failed mutation carries back over the wire', () => {
  const realFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = realFetch })

  /** Answer a mutation route the way the host does when the CLI exits non-zero. */
  function hostFails(payload: Record<string, unknown>, status = 500): string[] {
    const seen: string[] = []
    globalThis.fetch = ((input: string) => {
      seen.push(String(input))
      return Promise.resolve(new Response(JSON.stringify(payload), {
        status, headers: { 'content-type': 'application/json' },
      }))
    }) as typeof globalThis.fetch
    return seen
  }

  it('keeps the pnpm output the host sent with its 500', async () => {
    // The `!res.ok` branch used to rebuild the answer from `error` alone. That
    // is the single bug that reduced every failure on the card to a bare
    // "dsh plugin add exited 1" — the host collected the diagnosis and the
    // client threw it away on arrival.
    const seen = hostFails({
      ok: false, npm: 'dsh-ai4scholar',
      error: 'dsh plugin add exited 1',
      output: 'ERR_PNPM_FETCH_404  GET https://registry.npmmirror.com/dsh-ai4scholar: Not Found',
    })
    const answer = await requestInstall('dsh-ai4scholar')
    expect(seen).toEqual(['/research-market/install'])
    expect(answer.ok).toBe(false)
    expect(answer.error).toBe('dsh plugin add exited 1')
    expect(answer.output).toContain('ERR_PNPM_FETCH_404')
    expect(failureText(answer, 'install failed')).toContain('ERR_PNPM_FETCH_404')
  })

  it('keeps it on the remove route too', async () => {
    const seen = hostFails({
      ok: false, npm: 'dsh-ai4scholar',
      error: 'dsh plugin remove exited 1',
      output: "ERR_PNPM_CANNOT_REMOVE_MISSING_DEPS  Cannot remove 'dsh-ai4scholar'",
    })
    const answer = await requestRemove('dsh-ai4scholar')
    expect(seen).toEqual(['/research-market/remove'])
    expect(answer.output).toContain('ERR_PNPM_CANNOT_REMOVE_MISSING_DEPS')
  })

  it('names the status when the host answers 500 with no error string', async () => {
    hostFails({ ok: false, npm: 'dsh-ai4scholar' }, 502)
    const answer = await requestInstall('dsh-ai4scholar')
    expect(answer.error).toBe('route answered 502')
    expect(answer.output).toBeUndefined()
  })
})

describe('failure text', () => {
  it('puts the CLI tail on its own line under the headline', () => {
    expect(failureText({ ok: false, npm: 'p', error: 'exited 1', output: 'why\nit broke' }, 'fallback'))
      .toBe('exited 1\nwhy\nit broke')
  })

  it('falls back to a headline when the host sent no error', () => {
    expect(failureText({ ok: false, npm: 'p' }, 'install failed')).toBe('install failed')
  })

  it('does not leave a dangling newline for blank output', () => {
    expect(failureText({ ok: false, npm: 'p', error: 'exited 1', output: '   \n ' }, 'x')).toBe('exited 1')
  })
})
