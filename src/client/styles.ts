/**
 * The panel's stylesheet, injected as one plugin-owned `<style>` tag so the
 * bundle needs no CSS pipeline.
 *
 * Colours come from the shell's own alias tokens — `--dsw-alias-label-*`,
 * `bg-layer-*`, `border-l2`, `brand-primary` — which is the set the built-in
 * settings pages use. Inventing token names produces a panel that silently
 * falls back to hardcoded colours and stops following the theme.
 *
 * Filled buttons must pair `button-primary-fill` with `label-primary-foreground`,
 * the way the shell's own buttons do. `brand-primary` inverts between themes
 * (near-black in light, near-white in dark), so a hardcoded `#fff` label on it
 * reads fine in light mode and vanishes in dark. Fallbacks here are all light,
 * so a missing token set degrades to one coherent theme rather than a mix.
 * @module dsh-research/client/styles
 */

/** Attribute marking the style element as this plugin's. */
export const STYLE_TAG_ID = 'dsh-research/settings-section'

const P = 'rmkt'

/** Class names used by the section component. */
export const cls = {
  root: `${P}-root`,
  head: `${P}-head`,
  title: `${P}-title`,
  titleIcon: `${P}-title-icon`,
  sub: `${P}-sub`,
  headAction: `${P}-head-action`,
  tabs: `${P}-tabs`,
  tab: `${P}-tab`,
  tabOn: `${P}-tab-on`,
  body: `${P}-body`,
  searchWrap: `${P}-search-wrap`,
  searchIcon: `${P}-search-icon`,
  search: `${P}-search`,
  chips: `${P}-chips`,
  chip: `${P}-chip`,
  chipOn: `${P}-chip-on`,
  bar: `${P}-bar`,
  list: `${P}-list`,
  card: `${P}-card`,
  avatar: `${P}-avatar`,
  cardHead: `${P}-card-head`,
  name: `${P}-name`,
  meta: `${P}-meta`,
  badge: `${P}-badge`,
  summary: `${P}-summary`,
  detail: `${P}-detail`,
  more: `${P}-more`,
  cardFoot: `${P}-card-foot`,
  tag: `${P}-tag`,
  actions: `${P}-actions`,
  primary: `${P}-primary`,
  ghost: `${P}-ghost`,
  link: `${P}-link`,
  note: `${P}-note`,
  warn: `${P}-warn`,
  warnOutput: `${P}-warn-output`,
  empty: `${P}-empty`,
  disclosure: `${P}-disclosure`,
  overlay: `${P}-overlay`,
  dialog: `${P}-dialog`,
  dialogHead: `${P}-dialog-head`,
  dialogTitle: `${P}-dialog-title`,
  dialogClose: `${P}-dialog-close`,
  dialogBody: `${P}-dialog-body`,
  dialogCmd: `${P}-dialog-cmd`,
  dialogFoot: `${P}-dialog-foot`,
  progress: `${P}-progress`,
  progressText: `${P}-progress-text`,
  progressTrack: `${P}-progress-track`,
} as const

const CSS = `
.${cls.root}{display:flex;flex-direction:column;min-width:0;color:var(--dsw-alias-label-primary,#1f2328)}
.${cls.head}{display:flex;flex-direction:column;gap:10px;padding:0 0 12px}
.${cls.title}{display:flex;align-items:center;gap:9px;font-size:16px;line-height:24px;font-weight:600;margin:0}
.${cls.titleIcon}{flex:none;opacity:.85}
.${cls.sub}{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13.5px;line-height:22px;color:var(--dsw-alias-label-tertiary,#8b93a1);margin:0}
.${cls.headAction}{margin-left:auto;display:flex;align-items:center;gap:12px;flex:none}
.${cls.tabs}{display:flex;gap:2px;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e7eb);align-items:flex-end}
.${cls.tab}{border:none;background:none;font:inherit;font-size:13px;color:var(--dsw-alias-label-secondary,#6b7280);padding:7px 12px;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
.${cls.tab}:hover{color:var(--dsw-alias-label-primary,#1f2328)}
.${cls.tab}.${cls.tabOn}{color:var(--dsw-alias-brand-primary,#4f6ef7);border-bottom-color:var(--dsw-alias-brand-primary,#4f6ef7);font-weight:600}
.${cls.body}{display:flex;flex-direction:column;gap:12px;padding:14px 0 4px}
.${cls.searchWrap}{position:relative;display:flex;align-items:center}
.${cls.searchIcon}{position:absolute;left:11px;pointer-events:none;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.${cls.search}{width:100%;padding:8px 12px 8px 34px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-2,transparent);color:inherit;font:inherit;font-size:13.5px}
.${cls.search}:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#4f6ef7)}
.${cls.chips}{display:flex;gap:7px;flex-wrap:wrap}
.${cls.chip}{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:none;color:var(--dsw-alias-label-secondary,#6b7280);border-radius:99px;padding:4px 12px;font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}
.${cls.chip}:hover{color:var(--dsw-alias-label-primary,#1f2328)}
.${cls.chip}.${cls.chipOn}{background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.14));color:var(--dsw-alias-label-primary,#1f2328);font-weight:600}
.${cls.bar}{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 13px;border-radius:8px;border:1px solid var(--dsw-alias-brand-primary,#4f6ef7);font-size:13px}
.${cls.bar} span{flex:1 1 auto;min-width:0}
.${cls.list}{display:flex;flex-direction:column;gap:10px;margin:0;padding:0;list-style:none}
${'' /* bg-base sits a step deeper than the settings page's own surface in
     dark mode (950 vs 875), which is what makes cards read as cards there;
     in light mode both are white and the border keeps doing that job. */}
.${cls.card}{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;background:var(--dsw-alias-bg-base,transparent)}
.${cls.avatar}{width:30px;height:30px;border-radius:8px;flex:none;display:block;object-fit:cover}
.${cls.cardHead}{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.${cls.name}{font-size:14.5px;font-weight:600;text-decoration:none;color:inherit}
.${cls.name}:hover{text-decoration:underline}
.${cls.badge}{font-size:11px;padding:1px 8px;border-radius:99px;color:var(--dsw-alias-brand-primary,#4f6ef7);border:1px solid currentColor;font-weight:500}
.${cls.meta}{font-size:12px;color:var(--dsw-alias-label-tertiary,#9ca3af);margin:0}
.${cls.summary}{margin:0;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary,#6b7280)}
.${cls.detail}{margin:0;font-size:12.5px;line-height:1.75;color:var(--dsw-alias-label-tertiary,#9ca3af);padding:10px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.08))}
.${cls.more}{align-self:flex-start;border:0;background:none;color:var(--dsw-alias-brand-primary,#4f6ef7);font:inherit;font-size:12.5px;cursor:pointer;padding:0}
.${cls.more}:hover{text-decoration:underline}
.${cls.cardFoot}{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.${cls.tag}{font-size:11.5px;color:var(--dsw-alias-label-secondary,#6b7280);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:5px;padding:1px 7px}
.${cls.actions}{margin-left:auto;display:flex;align-items:center;gap:8px}
.${cls.primary}{flex:none;border:0;background:var(--dsw-alias-button-primary-fill,#1f2328);color:var(--dsw-alias-label-primary-foreground,#fff);border-radius:7px;padding:6px 15px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.${cls.primary}:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#3a3f47)}
.${cls.primary}:disabled{opacity:.45;cursor:default}
.${cls.ghost}{flex:none;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:transparent;color:inherit;border-radius:7px;padding:5px 12px;font:inherit;font-size:12.5px;cursor:pointer}
.${cls.ghost}:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary,#4f6ef7)}
.${cls.ghost}:disabled{opacity:.5;cursor:default}
.${cls.link}{color:var(--dsw-alias-brand-primary,#4f6ef7);font-size:13px}
.${cls.note},.${cls.empty}{margin:0;font-size:13px;color:var(--dsw-alias-label-tertiary,#9ca3af)}
.${cls.empty}{padding:28px 0;text-align:center}
.${cls.warn}{margin:0;font-size:12.5px;color:var(--dsw-alias-state-warn-primary,#b45309);overflow-wrap:anywhere}
/* The CLI tail: newlines kept, height capped so a long pnpm dump cannot push the
   card's buttons off screen, and scrollable so all of it stays reachable. */
.${cls.warnOutput}{margin:4px 0 0;padding:6px 8px;max-height:180px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary,#6b7280);background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.08));border-radius:6px}
.${cls.disclosure}{margin:0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary,#9ca3af);padding-top:4px;border-top:1px solid var(--dsw-alias-border-l2,#e5e7eb)}
.${cls.overlay}{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:24px}
.${cls.dialog}{width:min(460px,100%);max-height:80vh;overflow-y:auto;background:var(--dsw-alias-bg-layer-1,#ffffff);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:14px;padding:20px 22px;display:flex;flex-direction:column;gap:14px;box-shadow:0 18px 48px rgba(0,0,0,.4)}
.${cls.dialogHead}{display:flex;align-items:flex-start;gap:12px}
.${cls.dialogTitle}{margin:0;font-size:16px;font-weight:600;line-height:1.4;flex:1}
.${cls.dialogClose}{flex:none;border:0;background:none;color:var(--dsw-alias-label-tertiary,#9ca3af);font-size:15px;line-height:1;cursor:pointer;padding:2px 4px}
.${cls.dialogClose}:hover{color:var(--dsw-alias-label-primary,#1f2328)}
.${cls.dialogBody}{margin:0;font-size:13.5px;line-height:1.7;color:var(--dsw-alias-label-secondary,#6b7280);display:flex;flex-direction:column;gap:10px}
.${cls.dialogBody} b{color:var(--dsw-alias-label-primary,#1f2328);font-weight:600}
.${cls.dialogCmd}{margin:0;padding:11px 13px;border-radius:8px;background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.14));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;overflow-x:auto;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dsw-alias-label-primary,#1f2328)}
.${cls.dialogFoot}{display:flex;justify-content:flex-end;gap:10px;padding-top:2px}
.${cls.progress}{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#e5e7eb)}
.${cls.progressText}{margin:0;font-size:12.5px;color:var(--dsw-alias-label-secondary,#6b7280)}
.${cls.progressTrack}{height:3px;border-radius:99px;background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.2));overflow:hidden;position:relative}
.${cls.progressTrack}::after{content:'';position:absolute;inset-block:0;width:38%;border-radius:99px;background:var(--dsw-alias-brand-primary,#4f6ef7);animation:${P}-slide 1.35s ease-in-out infinite}
@keyframes ${P}-slide{0%{left:-38%}100%{left:100%}}
`

/**
 * Add the stylesheet once per document.
 * @param doc - the document to inject into; defaults to the page's.
 * @returns a disposer owned by the client plugin fiber.
 */
export function installStyles(doc: Document = document): () => void {
  let tag = doc.querySelector<HTMLStyleElement>(`style[data-plugin="${STYLE_TAG_ID}"]`)
  if (tag === null) {
    tag = doc.createElement('style')
    tag.setAttribute('data-plugin', STYLE_TAG_ID)
    tag.textContent = CSS
    doc.head.append(tag)
  }
  return () => { tag.remove() }
}
