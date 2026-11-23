/**
 * Turn a market provider page into the panel's own model.
 *
 * The catalog is remote and untrusted — that is the contract's own wording,
 * and it holds even when we publish the catalog ourselves, because a user may
 * point this plugin at any endpoint. So nothing here trusts a field's
 * presence or type: every entry is checked, and an entry that fails is
 * dropped rather than rendered half-empty.
 * @module dsh-research/catalog
 */

import type { CatalogPage, MarketItem } from './shared/route.js'

/** Read a string property, or `undefined` when it is absent or not a string. */
function str(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key]
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/** Read a record property, or `undefined`. */
function obj(source: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = source[key]
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** Derive `owner/repo` from a GitHub URL, or `undefined` for anything else. */
export function repoFromUrl(url: string): string | undefined {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/#?]+)/.exec(url)
  return match?.[1]
}

/** Convert one catalog item, or `undefined` when it lacks what the panel shows. */
function item(raw: unknown): MarketItem | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const source = raw as Record<string, unknown>
  const homepage = str(source, 'homepage') ?? str(obj(source, 'repository') ?? {}, 'url')
  const summary = str(source, 'summary')
  const id = str(source, 'id')
  if (homepage === undefined || summary === undefined || id === undefined) return undefined
  // Only https: a catalog is remote data, and a rendered link is a click away
  // from wherever it points.
  if (!homepage.startsWith('https://')) return undefined

  const categories = source['categories']
  const category = Array.isArray(categories) && typeof categories[0] === 'string' ? categories[0] : 'other'
  const publisher = str(obj(source, 'publisher') ?? {}, 'name')
  const stars = typeof source['stars'] === 'number' && Number.isFinite(source['stars'])
    ? source['stars'] as number
    : undefined

  const npm = str(obj(source, 'package') ?? {}, 'name')
  const detail = str(source, 'description')
  const version = str(source, 'latestVersion')
  const versionAt = str(source, 'latestVersionAt')
  const license = str(source, 'license')
  // Only inline images. A remote URL here would make every card render a
  // request to wherever the catalog points, and the panel's privacy property
  // is that it performs exactly one network request — this catalog fetch.
  const iconRaw = str(source, 'icon')
  const icon = iconRaw !== undefined && iconRaw.startsWith('data:image/') && iconRaw.length <= 60_000
    ? iconRaw
    : undefined
  return {
    id,
    // npm-only entries use an internal `npm-…` id, not a display title.
    repo: repoFromUrl(homepage) ?? str(source, 'displayName') ?? npm ?? str(source, 'name') ?? id,
    summary,
    category,
    homepage,
    ...(npm === undefined ? {} : { npm }),
    ...(stars === undefined ? {} : { stars }),
    ...(detail === undefined ? {} : { detail }),
    ...(version === undefined ? {} : { version }),
    ...(versionAt === undefined ? {} : { versionAt }),
    ...(icon === undefined ? {} : { icon }),
    ...(license === undefined ? {} : { license }),
    ...(publisher === undefined ? {} : { publisher }),
    // Our own entries are the ones we can support; the panel says which.
    // Both names are ours: literaf is the founding personal account, the
    // dsh-research org is where the repositories live from 2026-08-18 on.
    ours: publisher === 'literaf' || publisher === 'dsh-research'
      || (repoFromUrl(homepage)?.startsWith('literaf/') ?? false)
      || (repoFromUrl(homepage)?.startsWith('dsh-research/') ?? false),
  }
}

/**
 * Normalize a provider page.
 * @param raw - the parsed JSON body.
 * @returns our entries first, retaining catalog order within each group.
 * @throws Error when the body is not a provider page at all.
 */
export function normalizeCatalog(raw: unknown): CatalogPage {
  if (typeof raw !== 'object' || raw === null) throw new Error('catalog body is not an object')
  const source = raw as Record<string, unknown>
  const items = source['items']
  if (!Array.isArray(items)) throw new Error('catalog body has no items array')
  return {
    items: items.map(item)
      .filter((entry): entry is MarketItem => entry !== undefined)
      .sort((a, b) => Number(b.ours) - Number(a.ours)),
    revision: str(source, 'revision') ?? str(source, 'generatedAt') ?? '',
  }
}
