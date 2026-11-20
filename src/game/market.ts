import { clamp } from './economy'
import type { GameState } from './types'

/** Player market share derived from reputation + recent income vs rivals. */
export function playerShare(state: GameState): number {
  const rivalTotal = state.rivals.reduce((a, r) => a + r.marketShare, 0)
  const playerPower = state.reputation * 0.6 + Math.min(40, state.stats.totalIncome / 500)
  const total = rivalTotal + playerPower
  if (total <= 0) return 0
  return clamp(Math.round((playerPower / total) * 100), 0, 100)
}

export function tickRivals(state: GameState, rng: () => number = Math.random): void {
  // v4 rebalance: pricing above MARKET value pushes share to rivals (ratio-based, stronger).
  const ratios = Object.entries(state.inventory)
    .map(([k, i]) => {
      const mv = state.specials.find((s) => s.signature === k || s.id === k)?.value
        ?? ({ ink: 40, stone: 90, perfume: 160, crystal: 320, pearl: 650 } as Record<string, number>)[k]
        ?? i.price
      return i.price / Math.max(1, mv)
    })
  const avgRatio = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1
  const pricePressure = clamp((avgRatio - 1) * 1.5, -0.3, 0.8)
  for (const r of state.rivals) {
    r.capital = Math.max(500, Math.round(r.capital * (1 + (r.growth + pricePressure + (rng() - 0.5)) / 100)))
    r.reputation = clamp(r.reputation + (rng() - 0.45) * 2, 0, 300)
    r.marketShare = clamp(r.marketShare + (rng() - 0.5) * 2 + pricePressure * 2, 5, 60)
  }
  const sum = state.rivals.reduce((a, r) => a + r.marketShare, 0)
  if (sum > 0) for (const r of state.rivals) r.marketShare = Math.round((r.marketShare / sum) * 100)
}
