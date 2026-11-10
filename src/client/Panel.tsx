import type { ComponentType } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { MarketIcon, MarketSection } from './Section.js'
import type { MarketSectionFace, MarketSectionProps } from './Section.js'
import { NS } from './locales.js'
import { cls } from './styles.js'

/** Shared identity: the host opens the main panel named by the sidebar row. */
export const MARKET_PANEL_ID = 'research-market.catalog'

/** The full-height shell owns scrolling; settings and plugin pages own theirs. */
export function MarketPanel(props: MarketSectionProps): JSX.Element {
  return <main className={cls.panel} aria-label={props.t('title')}>
    <MarketSection {...props} />
  </main>
}

/** Additive slot contracts, also used by Ai4Scholar's workbench. */
interface PanelSlots {
  inject(name: 'main' | 'sidebar.panellist', callback: () => () => void): () => void
  register(options: {
    name: 'main'; key: string; locale: typeof NS; inject(): MarketSectionFace
  }, component: ComponentType<MarketSectionProps>): () => void
  register(options: {
    name: 'sidebar.panellist'; id: string; order: number; label(): string
  }, component: ComponentType<{ size?: number }>): () => void
}

/** Register lazily so older hosts can continue using the existing Settings page. */
export function applyMarketPanel(ctx: ClientContext, face: () => MarketSectionFace): void {
  const slots = ctx.slots as unknown as PanelSlots
  slots.inject('main', () => slots.register({
    name: 'main', key: MARKET_PANEL_ID, locale: NS, inject: face,
  }, MarketPanel))
  slots.inject('sidebar.panellist', () => slots.register({
    name: 'sidebar.panellist', id: MARKET_PANEL_ID, order: 67,
    label: () => ctx.locale.bind(NS)('sidebarNav'),
  }, ({ size }) => <MarketIcon size={size ?? 20} />))
}
