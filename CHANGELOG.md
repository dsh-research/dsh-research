# Changelog

All notable changes to `dsh-research` are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [0.4.6] - 2026-11-10

### Added
- Add a native **Curated research plugins / 精选科研插件** entry to the main sidebar, opening the catalog directly. It shares search and installation state with the existing Settings and plugin detail pages, and follows the host's locale and theme.

### Changed
- Use the website header's six-block grid-and-list logo in the sidebar and catalog heading, preserving its proportions, orange selected entry, and colors that follow the app's light or dark theme.

## [0.4.5] - 2026-11-10

### Fixed
- Fix every Desktop install failing with `untrusted origin`: current hosts use the authenticated owner-only fetch registry and native plugin manager instead of the legacy Origin-gated CLI route.
- Install and activate the exact catalog version; update installed bundles through the host's update/rollback flow, and remove them through its manager. Electron-owned Desktop profiles are never modified or relaunched through the legacy CLI path.
- Show restart instructions only when the native manager reports `restart-required`; applied changes are immediately marked installed. Preserve host diagnostics and clear busy state after connection failures so retries remain possible.
- Restore the catalog allowlist after a host hot reload, so installing one plugin does not make the next install or removal fail.
- Honor `allowInstall` and `allowRestart` in the panel. On Desktop, copy a versioned package name for the native Add plugin dialog instead of a command targeting Web.

### Compatibility
- Older Web hosts retain the same-origin, catalog-limited CLI path. Native operations require the running profile; an override targeting a different profile is rejected.
- Dependency build-script approval remains in the host's plugin manager. The research panel does not grant build permissions automatically.

## [0.4.4] - 2026-10-21

### Added
- Open the research market directly from Plugins → Installed → dsh-research on current Harness hosts, including the bundle row’s configure action. Settings → Research plugins remains available, and both entrances share the same catalog and operation state.

### Fixed
- Dispose the client stylesheet with the plugin so unloading its pages leaves no orphaned styles.

## [0.4.3] - 2026-09-01

### Fixed
- The panel's four routes now leave with the fiber that registered them. The web server owns one route table and rejects a duplicate `(kind, path)`; `register()` returns the disposer that removes the route, and all four sites discarded it, so a hot remount would have collided with the dead fiber's routes. Every route now goes through one helper that hands the disposer to the fiber. (Found while fixing the same defect in dsh-ai4scholar, where it was already crashing the plugin on remount.)
- The panel now acts on the profile it is actually running in. DSH Desktop boots its plugin host in-process and passes no `--profile`, so the old fallback resolved to `web` while the app was running `desktop`: the cards read one composition's installed versions and installed into a different one. The profile is now also derived from the path this plugin was loaded out of — `<DSH_HOME>/profiles/<name>/node_modules/…` names it — which needs no cooperation from the app or the CLI. A linked checkout is deliberately not matched, so a developer's working copy still falls back rather than guessing.
- A failed install or removal now shows the CLI's own diagnosis, not just its exit code. The host was already collecting pnpm's explanation and sending it with its 500; the client threw it away on arrival, so every failure on a card read `dsh plugin add exited 1` with nothing a person could act on — an unreachable registry, a version the mirror had not synced yet, and a package missing from the profile all looked identical. Two independent drop points are closed: the `!res.ok` branch rebuilt the answer from `error` alone, and the removal path never read `output` at all. Both paths now share one text builder so neither can drop it again.

### Changed
- The CLI tail renders in its own monospace block under the headline rather than being folded into the sentence, height-capped and scrollable so a long pnpm dump cannot push the card's buttons off screen.

## [0.4.2] - 2026-08-18

### Changed
- The repository moved to the dsh-research GitHub organization: `dsh-research/dsh-research`. Old links redirect. The panel's "AI4Scholar 维护" badge now recognizes both the org and the founding account as ours.

### Fixed
- The update button only appears when the catalog version is strictly newer than the one on disk. A linked checkout — or anyone in the minutes between an npm publish and the feed adopting it — was being offered a downgrade dressed as an update.

## [0.4.1] - 2026-08-18

### Added
- Cards show the owner's avatar and the pinned version's npm publish date. Avatars arrive inside the catalog as data URIs and the parser refuses anything else (remote URLs, oversized payloads) — the panel still performs exactly one network request.

### Changed
- Cards sit on `--dsw-alias-bg-base`, one step deeper than the settings surface in dark mode, so they read as cards the way the ecosystem's other markets do.

## [0.4.0] - 2026-08-18

### Added
- Update detection: the catalog reports each installed bundle's on-disk version, and a card whose catalog version differs shows 更新到 vX / Update to vX. Updating runs the same confirmed install; a restart note follows, as with a fresh install. dsh-research itself is a catalog entry, so the panel offers its own updates too.

### Changed
- Installs are pinned to the catalog's version (`name@version`) instead of the bare name — the review behind a listing was done against that version, and pnpm 11's minimumReleaseAge gate resolves bare names to day-old releases, which during a hotfix serves exactly the version the fix replaces. The copyable command carries the same pin.

## [0.3.0] - 2026-08-17

`dsh-research` is now **the research plugin market** — a page in the Settings sidebar listing a curated index of research plugins, each installable with one click.

This replaces the skill pack that carried the name through 0.1 and 0.2. The pack was four markdown procedures and a prompt section: real content, but nothing another author could not write, and it was competing for the name that should carry the thing this project is actually about. The name now holds the entry point; the skills remain published at [ai4scholar-skill-hub](https://github.com/literaf/ai4scholar-skill-hub) and are a better fit inside `dsh-ai4scholar`, whose tools they depend on to mean anything.

`^0.2.0` does not match `0.3.0` under 0.x semver, so nobody on the old pack is moved onto a different plugin by an update.

### Added
- A **Research plugins** page in the Settings sidebar: the curated catalog with search, category filters, and Discover / Installed tabs.
- One-click install and removal, fenced four ways: an allowlist (the browser may name any package, only a catalogued one is ever spawned), a same-origin check, a single-flight lock, and a profile read from the argv this host booted.
- A restart action, guarded harder than install because ending the process is a stronger act: loopback peers only, and any forwarding header disqualifies the request.
- A confirmation before every mutation, naming the plugin, the profile, and the exact command that will run.
- Progress feedback with an elapsed counter, because a dependency resolve can run for minutes and a silent button reads as a hang.
- Bilingual catalog: the provider contract fixes the item shape, so the two languages are two feeds and the panel reads the one its interface speaks.

### Removed
- The four bundled skills and the workflow prompt section (see above).

## [0.2.0] - 2026-08-17

The skill pack's last release. See the repository history for its changelog.
