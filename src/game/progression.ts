import { netWorth } from './economy'
import { STAGES, type GameState } from './types'

export function currentStage(state: GameState): number {
  const nw = netWorth(state)
  let stage = 1
  for (const s of STAGES) {
    if (nw >= s.netWorth && state.reputation >= s.reputation) stage = s.stage
  }
  return stage
}

export function stageName(stage: number): string {
  return STAGES.find((s) => s.stage === stage)?.name ?? 'تازه‌کار'
}

export function nextStageInfo(state: GameState): { name: string; netWorth: number; reputation: number } | null {
  const cur = currentStage(state)
  const next = STAGES.find((s) => s.stage === cur + 1)
  return next ? { name: next.name, netWorth: next.netWorth, reputation: next.reputation } : null
}
