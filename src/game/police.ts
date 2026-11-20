import { clamp } from './economy'
import type { GameState } from './types'

export function heatFromSale(state: GameState, totalValue: number, districtSurveillance: number): number {
  const base = totalValue / 400 // big sales draw attention
  const surv = 1 + districtSurveillance / 100
  const risk = 1 - state.upgrades.riskMgmt * 0.12
  return clamp(base * surv * Math.max(0.3, risk), 0, 12)
}

export function heatDecayPerHour(state: GameState): number {
  return 0.6 + state.upgrades.riskMgmt * 0.5
}

export function heatLevel(heat: number): { label: string; color: string } {
  if (heat > 80) return { label: 'بحرانی', color: '#f87171' }
  if (heat > 60) return { label: 'هشدار', color: '#fb923c' }
  if (heat > 35) return { label: 'متوسط', color: '#facc15' }
  return { label: 'آرام', color: '#22ff88' }
}
