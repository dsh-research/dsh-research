import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readSnapshot, snapshotPath, writeSnapshot } from '../src/snapshot.js'

describe('the catalog snapshot kept on disk', () => {
  const FEED = 'https://dsh-research.com/v1/market.json'
  const PAGE = { schemaVersion: '1.0.0', items: [{ id: 'literaf-dsh-ai4scholar' }], page: { hasMore: false } }
  let home = ''

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'dsh-research-snapshot-'))
    process.env['DSH_HOME'] = home
  })
  afterEach(() => {
    delete process.env['DSH_HOME']
    rmSync(home, { recursive: true, force: true })
  })

  it('lives under the DSH home with the other plugins’ state, one file per feed', () => {
    expect(snapshotPath('en')).toBe(join(home, 'data', 'dsh-research', 'catalog-en.json'))
    expect(snapshotPath('zh')).toBe(join(home, 'data', 'dsh-research', 'catalog-zh.json'))
  })

  it('reads back what was kept', () => {
    const kept = { url: FEED, at: 1_700_000_000_000, body: PAGE }
    writeSnapshot(snapshotPath('en'), kept)
    expect(readSnapshot(snapshotPath('en'))).toEqual(kept)
  })

  it('replaces the previous snapshot', () => {
    const path = snapshotPath('en')
    writeSnapshot(path, { url: FEED, at: 1, body: { items: [] } })
    writeSnapshot(path, { url: FEED, at: 2, body: PAGE })
    expect(readSnapshot(path)?.at).toBe(2)
    // Written beside the target and renamed over it, so no half-file is left
    // behind under another name.
    expect(readdirSync(join(home, 'data', 'dsh-research'))).toEqual(['catalog-en.json'])
  })

  it('returns nothing for a feed that was never kept', () => {
    expect(readSnapshot(snapshotPath('en'))).toBeUndefined()
  })

  it('returns nothing for a file that is not a snapshot', () => {
    const path = snapshotPath('en')
    // Written straight to the file: the cases include bodies `writeSnapshot`
    // would never produce.
    mkdirSync(dirname(path), { recursive: true })
    const notSnapshots = [
      'not json',
      '[]',
      JSON.stringify({ url: FEED, at: 1 }),
      JSON.stringify({ url: '', at: 1, body: PAGE }),
      JSON.stringify({ url: FEED, at: '1', body: PAGE }),
      JSON.stringify({ url: FEED, at: -1, body: PAGE }),
      JSON.stringify({ at: 1, body: PAGE }),
    ]
    for (const text of notSnapshots) {
      writeFileSync(path, text)
      expect(readSnapshot(path), text).toBeUndefined()
    }
  })

  it('never fails the request when it cannot write', () => {
    // The snapshot is the fallback; a disk that cannot take it must not turn
    // a catalog that was just read into a failed one.
    const blocked = join(home, 'file')
    writeFileSync(blocked, 'not a directory')
    expect(() => writeSnapshot(join(blocked, 'catalog-en.json'), { url: FEED, at: 1, body: PAGE })).not.toThrow()
    expect(readdirSync(home)).toEqual(['file'])
  })
})
