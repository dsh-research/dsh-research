/**
 * The last catalog page that loaded, kept on disk.
 *
 * The route's cache used to live in memory alone, so its own rule — a stale
 * list still lets someone install; an error page does not — held only until
 * the host restarted. Hosts restart often: every Web install asks for one,
 * and Desktop restarts on update. The first panel opened after that had
 * nothing to fall back to, so a bad minute for the route to the catalog was
 * an empty panel.
 *
 * What is kept is the provider's body rather than the normalized page, so a
 * snapshot goes back through `normalizeCatalog` and is checked by the same
 * rules as a fresh answer.
 * @module dsh-research/snapshot
 */

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** A provider body, the feed it came from, and when it was read. */
export interface Snapshot {
  /** Feed the body was read from. A snapshot of another feed is not this feed's stale copy. */
  readonly url: string
  /** When it was read, in milliseconds since the epoch. */
  readonly at: number
  /** The parsed provider body, as it was received. */
  readonly body: unknown
}

/** Where snapshots live: under the DSH home's `data/`, where plugins keep their own state. */
export function snapshotDir(): string {
  return join(process.env['DSH_HOME'] ?? join(homedir(), '.dsh'), 'data', 'dsh-research')
}

/** File one feed's snapshot lives in. */
export function snapshotPath(lang: string): string {
  return join(snapshotDir(), `catalog-${lang}.json`)
}

/**
 * Read one feed's snapshot.
 * @param path - a file {@link writeSnapshot} wrote.
 * @returns the snapshot, or `undefined` when there is none, it is unreadable, or it is not one.
 */
export function readSnapshot(path: string): Snapshot | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch {
    // Never written, or unreadable: there is nothing to fall back on.
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
  const { url, at, body } = parsed as Record<string, unknown>
  if (typeof url !== 'string' || url === '') return undefined
  if (typeof at !== 'number' || !Number.isFinite(at) || at < 0) return undefined
  if (!('body' in parsed)) return undefined
  return { url, at, body }
}

/**
 * Keep one feed's snapshot, replacing the previous one whole or not at all.
 *
 * Best effort by design. The snapshot is the fallback, so a disk that cannot
 * take it costs the next cold start its fallback — it must not fail the
 * request that just succeeded.
 * @param path - the file {@link snapshotPath} names.
 * @param snapshot - what to keep.
 */
export function writeSnapshot(path: string, snapshot: Snapshot): void {
  // Written beside the target and renamed over it: a crash mid-write leaves
  // the previous snapshot, never half of the new one.
  const partial = `${path}.${String(process.pid)}.tmp`
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    writeFileSync(partial, JSON.stringify(snapshot), { mode: 0o600 })
    renameSync(partial, path)
  } catch {
    try {
      rmSync(partial, { force: true })
    } catch {
      // Nothing was written, so there is nothing to remove.
    }
  }
}
