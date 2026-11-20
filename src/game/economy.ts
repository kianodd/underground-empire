import { PRODUCTS } from './data'
import { INGREDIENTS } from './ingredients'
import type { GameState } from './types'

export function findSpecial(state: GameState, key: string) {
  return state.specials.find((s) => s.id === key || s.signature === key || s.comboKey === key)
}

export function productValue(state: GameState, key: string): number {
  const sp = findSpecial(state, key)
  if (sp) return sp.value
  return PRODUCTS.find((p) => p.id === key)?.baseValue ?? 0
}

export function productName(state: GameState, key: string): string {
  const sp = findSpecial(state, key)
  if (sp) return sp.name
  return PRODUCTS.find((p) => p.id === key)?.name ?? key
}

export function productColor(state: GameState, key: string): string {
  const sp = findSpecial(state, key)
  if (sp) return sp.color
  return PRODUCTS.find((p) => p.id === key)?.color ?? '#9a9ab0'
}

/** v3 fictional game stat 0-100 («وابستگی مشتری» در بازی). */
export function productDependency(state: GameState, key: string): number {
  const sp = findSpecial(state, key)
  if (sp) return sp.dependency ?? 25
  return PRODUCTS.find((p) => p.id === key)?.dependency ?? 25
}

/** v3 sales list helpers. */
export function isListed(state: GameState, key: string): boolean {
  return state.salesList?.[key]?.listed === true
}

export function salePrice(state: GameState, key: string): number {
  return state.salesList?.[key]?.price ?? state.inventory[key]?.price ?? productValue(state, key)
}

export function listedProductKeys(state: GameState): string[] {
  return Object.entries(state.salesList ?? {})
    .filter(([, e]) => e.listed)
    .map(([k]) => k)
}

export function listedInStockKeys(state: GameState): string[] {
  return listedProductKeys(state).filter((k) => (state.inventory[k]?.qty ?? 0) > 0)
}

export function inventoryUnits(state: GameState): number {
  return Object.values(state.inventory).reduce((a, i) => a + i.qty, 0)
}

export function inventoryValue(state: GameState): number {
  return Object.entries(state.inventory).reduce((a, [k, i]) => a + i.qty * productValue(state, k), 0)
}

export function ingredientUnits(state: GameState): number {
  return Object.values(state.ingredients ?? {}).reduce((a, n) => a + n, 0)
}

export function ingredientsValue(state: GameState): number {
  return Object.entries(state.ingredients ?? {}).reduce((a, [id, n]) => {
    const def = INGREDIENTS.find((i) => i.id === id)
    return a + n * (def?.basePrice ?? 0)
  }, 0)
}

export function totalWarehouseUnits(state: GameState): number {
  return inventoryUnits(state) + ingredientUnits(state)
}

export function netWorth(state: GameState): number {
  return Math.round(state.cash + inventoryValue(state) + ingredientsValue(state))
}

export function storageCap(state: GameState): number {
  return 50 + state.upgrades.storage * 50
}

export function productionCapacity(state: GameState): number {
  return 1 + state.upgrades.capacity
}

export function dailyRent(state: GameState): number {
  return state.districts.filter((d) => d.unlocked).reduce((a, d) => a + d.rent, 0)
}

export function dailyWages(state: GameState): number {
  return state.staff.filter((s) => s.hired).reduce((a, s) => a + s.wage * s.level, 0)
}

export function upgradeCost(kind: keyof GameState['upgrades'], level: number): number {
  // v4 rebalance: exponential ×2.2 per level.
  const base: Record<string, number> = { capacity: 400, quality: 500, storage: 350, riskMgmt: 450, marketing: 400 }
  return Math.round(base[kind] * Math.pow(2.2, level))
}

export const UPGRADE_INFO: Record<keyof GameState['upgrades'], { name: string; desc: string; max: number }> = {
  capacity: { name: 'ظرفیت تولید', desc: 'هر سطح: +۱ سفارش تولید هم‌زمان', max: 5 },
  quality: { name: 'کیفیت تولید', desc: 'هر سطح: +۱۰ کیفیت محصولات تولیدی', max: 5 },
  storage: { name: 'انبار بزرگ‌تر', desc: 'هر سطح: +۵۰ ظرفیت انبار', max: 6 },
  riskMgmt: { name: 'مدیریت ریسک', desc: 'هر سطح: کاهش سریع‌تر توجه پلیس و گرمای کمتر از فروش', max: 5 },
  marketing: { name: 'بازاریابی', desc: 'هر سطح: سفارش‌های بیشتر از مشتریان', max: 5 },
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
