<p align="center"><strong>dsh-research</strong></p>

# Research plugins, from the Plugins page

English | [中文](README_CN.md)

[![npm](https://img.shields.io/npm/v/dsh-research?label=npm)](https://www.npmjs.com/package/dsh-research) [![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-blue)](https://github.com/topics/dsh-plugin) ![license](https://img.shields.io/badge/license-MIT-green)

A curated market for literature search, reference management, writing and review plugins. Open **Plugins → Installed → dsh-research**, or use **Settings → Research plugins**. Each Install button adds the selected plugin to the profile you are running.

```sh
dsh plugin --profile web add dsh-research
```

Restart DSH Desktop or `dsh web`, then open **Plugins → Installed → dsh-research**. **Settings → Research plugins** remains available, including on older Harness versions.

## dsh-research.com

The catalog behind the panel lives at **[dsh-research.com](https://dsh-research.com)** — the same list, in a browser, at [/plugins](https://dsh-research.com/plugins/). Each entry says what the plugin does and where it stops, and there is a walkthrough that goes from an empty machine to a finished talk. The site is generated from one JSON file; the panel fetches that same file, so the two can never drift apart.

## Why this exists

The official market already installs anything in the community registry, and does it well. What it cannot do is tell a researcher which of its eleven hundred plugins are theirs. That is the part this does.

## What an install actually does

The panel runs `dsh plugin --profile <your profile> add <package>` for you — the same command you would type. Four things fence it:

| | |
|---|---|
| **Allowlist** | The browser may ask for any package name; only a package this catalog lists is ever spawned. The catalog is a static file we publish. |
| **Same-origin** | A state-changing route reachable from any page would let a site you visited install into your profile. |
| **One at a time** | Two concurrent `dsh plugin add` runs race on one `package.json` and can leave a profile half-written. |
| **Your profile, not a guess** | The target comes from the `--profile` this host booted, so running a test profile never mutates your real one. |

Set `allowInstall: false` to keep the panel read-only.

## Configuration

The bundle inserts one row (`id: research-market`). Override it from your profile's `cordis.patch.yml` (a patch replaces the whole `config`, so restate every key you keep):

```yaml
- id: research-market
  config:
    catalogUrl: https://dsh-research.com/v1/market.json
    profile: web            # defaults to the profile this host booted
    allowInstall: true
    cacheSeconds: 900
    timeoutMs: 8000
```

`catalogUrl` accepts any endpoint answering the [DSH Community Market provider contract](https://github.com/anywhere-labs/deepseek-harness-desktop/blob/master/dsh-community-market/docs/catalog-provider-contract.md). Point it at your own and the panel lists yours instead.

## Notes

- The panel's list and the one at [dsh-research.com/plugins](https://dsh-research.com/plugins/) are the same list, built from the same `market.json`. Nothing reaches it unread: installing someone else's package from a button we drew makes us the first place their bug gets reported.
- The process layer is adapted from [dsh-market](https://github.com/dsh-market/dsh-market) (MIT), which worked out that `ctx.shell` cannot write to a profile, that a macOS app launched from the Dock has no Homebrew on PATH, that pnpm v10 hangs without a TTY unless `CI` is set, and that Windows `dsh` is a `.cmd` shim.
- A newly installed plugin needs a restart before it loads; the row says so.

## License

MIT
