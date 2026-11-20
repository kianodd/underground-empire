import { MODIFIERS, NAME_PARTS_A, NAME_PARTS_B, NAME_PARTS_C, PRODUCTS } from './data'
import { clamp } from './economy'
import { STAT_LABEL, computeCraft, ingredientById, type GameStat } from './ingredients'
import type { SpecialProduct } from './types'

export { computeCraft } from './ingredients'

/** v4: crafting is FREE — no monetary cost. Time is the only cost (see craftDurationHours). */
export function craftCostV2(_ingredientIds: string[]): number {
  return 0
}

/** v4: deterministic crafting duration in game-hours: 1 base hour + 1 per ingredient/modifier slot. */
export function craftDurationHours(slotCount: number): number {
  return 1 + Math.max(0, slotCount)
}

/** v4: max queued crafting jobs (1 active + waiting). */
export const CRAFT_QUEUE_MAX = 5

export function buildSpecialV2(baseId: string, ingredientIds: string[], day: number, qualityBonus = 0): SpecialProduct {
  const base = PRODUCTS.find((p) => p.id === baseId)!
  const r = computeCraft(baseId, ingredientIds, qualityBonus)
  const ingNames = ingredientIds.map((id) => ingredientById(id)?.name ?? id).join(' ← ')
  const topStats = (Object.entries(r.stats) as Array<[GameStat, number]>)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
    .map(([k, v]) => `${STAT_LABEL[k]} ${v > 0 ? '+' : ''}${v}`)
    .join('، ')
  return {
    id: r.comboKey,
    name: r.name,
    baseId,
    modifierIds: [],
    ingredientIds: [...ingredientIds],
    stats: r.stats,
    comboKey: r.comboKey,
    signature: r.comboKey,
    qty: 1,
    dependency: r.dependency,
    quality: r.quality,
    rarity: r.rarity,
    popularity: r.popularity,
    value: r.value,
    color: r.color,
    desc: `ترکیب خیالی «${base.name}» با مواد (به‌ترتیب): ${ingNames}. ویژگی‌های بازی: ${topStats || 'بدون ویژگی خاص'}.`,
    createdDay: day,
  }
}

/** v4: legacy modifier crafting is also FREE (time-only cost). */
export function craftCost(_baseId: string, _modifierIds: string[]): number {
  return 0
}

export function craftValue(baseId: string, modifierIds: string[], qualityBonus = 0): { value: number; quality: number; rarity: number; popularity: number } {
  const base = PRODUCTS.find((p) => p.id === baseId)
  const mods = modifierIds.map((id) => MODIFIERS.find((m) => m.id === id)).filter(Boolean)
  const mult = clamp(mods.reduce((a, m) => a * (m?.valueMult ?? 1), 1), 0.8, 2.2)
  const inputCost = 2 * (base?.prodCost ?? 10) // legacy craft consumes 2 base units
  const value = Math.min(Math.round((base?.baseValue ?? 0) * mult * (1 + qualityBonus / 200)), inputCost * 3)
  const quality = clamp(50 + mods.reduce((a, m) => a + (m?.qualityBonus ?? 0), 0) + qualityBonus, 0, 100)
  const rarity = clamp((base?.rarity ?? 1) + mods.reduce((a, m) => a + (m?.rarityBonus ?? 0), 0), 1, 10)
  const popularity = clamp(Math.round(mods.reduce((a, m) => a + (m?.popularity ?? 0), 0) / Math.max(1, mods.length) + (base?.demand ?? 0) * 0.3), 0, 100)
  return { value, quality, rarity, popularity }
}

export function generateSpecialName(rng: () => number = Math.random): string {
  const a = NAME_PARTS_A[Math.floor(rng() * NAME_PARTS_A.length)]
  const b = NAME_PARTS_B[Math.floor(rng() * NAME_PARTS_B.length)]
  const c = NAME_PARTS_C[Math.floor(rng() * NAME_PARTS_C.length)]
  return `${a}‌${b} ${c}`
}

export function buildSpecial(baseId: string, modifierIds: string[], day: number, qualityBonus = 0, rng: () => number = Math.random): SpecialProduct {
  const base = PRODUCTS.find((p) => p.id === baseId)!
  const mods = modifierIds.map((id) => MODIFIERS.find((m) => m.id === id)).filter(Boolean)
  const stats = craftValue(baseId, modifierIds, qualityBonus)
  const modNames = mods.map((m) => m!.name).join(' و ')
  const signature = `${baseId}|mod:${modifierIds.join(',')}`
  return {
    id: signature,
    name: generateSpecialName(rng),
    baseId,
    modifierIds,
    signature,
    qty: 1,
    dependency: base.dependency ?? 25,
    quality: stats.quality,
    rarity: stats.rarity,
    popularity: stats.popularity,
    value: stats.value,
    color: mods[0]?.color ?? base.color,
    desc: `محصولی ویژه از ترکیب «${base.name}» با ویژگی‌های خیالی ${modNames}؛ ساخته‌ای منحصربه‌فرد از شبکه تو.`,
    createdDay: day,
  }
}

export function signatureOf(baseId: string, ingredientIds: string[]): string {
  return `${baseId}|${ingredientIds.join('>')}`
}

export interface QuickCraftCheck {
  ok: boolean
  missing: string[] // Persian, e.g. «عسل ×۱»
  cost: number
}

/** v4: can this ordered combo be queued right now? (base + ingredients + queue space; crafting is FREE) */
export function quickCraftCheck(
  state: { inventory: Record<string, { qty: number }>; ingredients: Record<string, number>; cash: number; craftingQueue?: unknown[] },
  baseId: string,
  ingredientIds: string[],
): QuickCraftCheck {
  const missing: string[] = []
  const base = PRODUCTS.find((p) => p.id === baseId)
  if ((state.inventory[baseId]?.qty ?? 0) < 1) missing.push(`${base?.name ?? baseId} ×1`)
  const need: Record<string, number> = {}
  for (const id of ingredientIds) need[id] = (need[id] ?? 0) + 1
  for (const [id, n] of Object.entries(need)) {
    const have = state.ingredients[id] ?? 0
    if (have < n) missing.push(`${ingredientById(id)?.name ?? id} ×${n - have}`)
  }
  if ((state.craftingQueue?.length ?? 0) >= CRAFT_QUEUE_MAX) missing.push('صف ساخت پر است')
  return { ok: missing.length === 0, missing, cost: 0 }
}
