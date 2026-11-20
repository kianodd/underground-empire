import { netWorth } from './economy'
import { MISSIONS } from './data'
import type { GameState, MissionDef } from './types'

export function metricValue(state: GameState, metric: MissionDef['metric']): number {
  switch (metric) {
    case 'income': return state.stats.totalIncome
    case 'deals': return state.stats.deals
    case 'customers': return state.stats.customersServed.length
    case 'crafts': return state.stats.crafts
    case 'hires': return state.stats.hires
    case 'districts': return state.districts.filter((d) => d.unlocked).length
    case 'reputation': return state.reputation
    case 'networth': return netWorth(state)
  }
}

export function missionProgress(state: GameState, def: MissionDef): number {
  const ms = state.missions.find((m) => m.defId === def.id)
  const base = ms?.baseline ?? 0
  return Math.max(0, metricValue(state, def.metric) - base)
}

export function missionDone(state: GameState, def: MissionDef): boolean {
  return missionProgress(state, def) >= def.target
}

export function missionDef(id: string): MissionDef {
  return MISSIONS.find((m) => m.id === id)!
}
