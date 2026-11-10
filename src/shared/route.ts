/**
 * The host route the browser half reads the catalog through.
 *
 * The catalog is public and already sends `Access-Control-Allow-Origin: *`,
 * so the browser could fetch it directly. It goes through the host anyway:
 * the Node half caches it, one slow network is not five slow panels, and a
 * plugin that never makes the page talk to a third-party host is a plugin
 * whose network behaviour a user can reason about from one place.
 * @module dsh-research/shared/route
 */

/*
 * The route prefix and the plugin id stay `research-market` while the package
 * is `dsh-research`: the package name says who it is for, the id says what it
 * is. A bare `/research/` prefix is also the kind of name a second research
 * plugin would reasonably want, and route collisions are silent.
 */

/** Host route serving the cached catalog snapshot. */
export const CATALOG_ROUTE = '/research-market/catalog'

/** Host route that installs one catalog entry. POST only, same-origin only. */
export const NATIVE_INSTALL_ROUTE = '/api/research-market/install'
export const NATIVE_REMOVE_ROUTE = '/api/research-market/remove'

export const INSTALL_ROUTE = '/research-market/install'

/** Host route that removes one catalog entry. POST only, same-origin only. */
export const REMOVE_ROUTE = '/research-market/remove'

/**
 * Host route that restarts this dsh host. POST only, and loopback only —
 * ending the process is a stronger act than adding a package.
 */
export const RESTART_ROUTE = '/research-market/restart'

/** Where the curated index is published, in English. */
export const CATALOG_URL = 'https://dsh-research.com/v1/market.json'

/**
 * The same index in Chinese.
 *
 * The provider contract fixes the item shape with `additionalProperties:
 * false`, so one entry cannot carry two summaries. A bilingual catalog is
 * therefore two feeds, each valid on its own, and the reader asks for the one
 * matching its interface.
 */
export const CATALOG_URL_ZH = 'https://dsh-research.com/v1/market.zh.json'

/** One plugin as the browser half consumes it. */
export interface MarketItem {
  /** Stable id from the catalog. */
  readonly id: string
  /** Repository slug, shown as the entry's name. */
  readonly repo: string
  /** One-line summary. */
  readonly summary: string
  /** Category label from the catalog. */
  readonly category: string
  /** Repository URL. */
  readonly homepage: string
  /** npm package name, when the catalog states one. */
  readonly npm?: string
  /** Star count, when known. */
  readonly stars?: number
  /** The longer text, shown when the reader opens a row. */
  readonly detail?: string
  /** Published version, when the catalog states one. */
  readonly version?: string
  /** npm publish date (YYYY-MM-DD) of that version, when the catalog states it. */
  readonly versionAt?: string
  /** Owner avatar as an inline data URI; never a remote URL. */
  readonly icon?: string
  /** SPDX licence, when known. */
  readonly license?: string
  /** Whether AI4Scholar maintains this entry. */
  readonly ours: boolean
  /** Who publishes it, named in the confirmation when it is not us. */
  readonly publisher?: string
}

/**
 * A normalized catalog page: what the remote endpoint said, and nothing about
 * this machine. Keeping it separate from {@link CatalogResponse} is what stops
 * local state (which profile, what is installed) from being something a remote
 * catalog could claim.
 */
export interface CatalogPage {
  /** The entries, in catalog order. */
  readonly items: readonly MarketItem[]
  /** Catalog revision, so the panel can show how fresh it is. */
  readonly revision: string
  /** Set when the snapshot came from cache after a failed refresh. */
  readonly stale?: boolean
}

/** What {@link CATALOG_ROUTE} answers: the page plus this machine's state. */
export interface CatalogResponse extends CatalogPage {
  readonly nativeManagement?: boolean
  readonly allowInstall?: boolean
  readonly allowRestart?: boolean
  /** Bundles already present in the active profile, so installed rows say so. */
  readonly installed: readonly string[]
  /**
   * Actual versions on disk, keyed by npm name. The panel compares these with
   * each entry's catalog `version` to offer an update; separate from
   * `installed` because a bundle can be listed in the manifest before its
   * package has materialized on disk.
   */
  readonly installedVersions: Readonly<Record<string, string>>
  /** The profile an install would mutate. */
  readonly profile: string
  /**
   * Whether a terminal owns this host, in which case only the person at that
   * terminal can restart it. Sent with the catalog rather than discovered when
   * the button is pressed, so the panel can say who has to do what *before*
   * anything is clicked.
   */
  readonly attached: boolean
  /** The command that starts this host again, for when that person is you. */
  readonly restartCommand: string
}

/** What {@link RESTART_ROUTE} answers. */
export interface RestartResponse {
  /** Whether a replacement was scheduled. */
  readonly ok: boolean
  /** Why not, when it was refused. */
  readonly error?: string
  /**
   * What the host did. `relaunch` means it is exiting and a replacement is on
   * its way; `manual` means it did nothing and {@link command} is yours to run.
   */
  readonly mode?: 'relaunch' | 'manual'
  /** Where the replacement's output goes, for a boot that fails. */
  readonly log?: string
  /** The command to run yourself, when `mode` is `manual`. */
  readonly command?: string
}

/** What {@link INSTALL_ROUTE} and {@link REMOVE_ROUTE} answer. */
export interface InstallResponse {
  /** Native manager activation status; omitted by legacy CLI hosts. */
  readonly restartRequired?: boolean
  readonly version?: string
  /** Whether the plugin is now in the profile. */
  readonly ok: boolean
  /** Package that was added. */
  readonly npm: string
  /** Human-readable failure, when `ok` is false. */
  readonly error?: string
  /** Tail of the CLI output, for a failure a user can act on. */
  readonly output?: string
}
