import { openDB, type IDBPDatabase } from 'idb'
import { SAVE_VERSION, type GameState, type Order } from './types'
import { computeCraft } from './ingredients'
import { PRODUCTS } from './data'

/** Keep earliest active order per customer+productKey, drop later duplicates. */
export function dedupeOrders(orders: Order[]): Order[] {
  const seen = new Set<string>()
  const keep: Order[] = []
  // orders are stored newest-first; iterate from the end so the earliest survives
  for (let i = orders.length - 1; i >= 0; i--) {
    const o = orders[i]
    if (o.status === 'open') {
      const k = `${o.customerId}|${o.productKey}`
      if (seen.has(k)) continue
      seen.add(k)
    }
    keep.push(o)
  }
  return keep.reverse()
}

export function signatureForSpecial(s: { baseId: string; ingredientIds?: string[]; modifierIds?: string[]; comboKey?: string; signature?: string }): string {
  if (s.signature) return s.signature
  if (s.comboKey) return s.comboKey
  if (s.ingredientIds && s.ingredientIds.length) return `${s.baseId}|${s.ingredientIds.join('>')}`
  return `${s.baseId}|mod:${(s.modifierIds ?? []).join(',')}`
}

const DB_NAME = 'underground-empire'
const STORE = 'saves'
const KEY = 'main'

let dbPromise: Promise<IDBPDatabase> | null = null
function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE)
      },
    })
  }
  return dbPromise
}

export function serialize(state: GameState): string {
  return JSON.stringify({ ...state, saveVersion: SAVE_VERSION, lastSavedAt: Date.now() })
}

export function deserialize(json: string): GameState | null {
  try {
    const obj = JSON.parse(json) as GameState
    if (typeof obj !== 'object' || obj === null) return null
    if (typeof obj.cash !== 'number' || typeof obj.day !== 'number') return null
    // v1 -> v2 migration: fill new fields defensively, keep all old progress
    if ((obj.saveVersion ?? 0) < SAVE_VERSION) {
      obj.saveVersion = SAVE_VERSION
    }
    if (!obj.settings) obj.settings = { sound: false }
    if (!obj.missions) obj.missions = []
    if (!obj.eventLog) obj.eventLog = []
    if (!obj.demandSpike) obj.demandSpike = null
    if (!obj.costMult) obj.costMult = null
    if (!obj.ingredients || typeof obj.ingredients !== 'object') obj.ingredients = {}
    if (!obj.shopStock || typeof obj.shopStock !== 'object') obj.shopStock = {}
    if (typeof obj.shopDay !== 'number') obj.shopDay = obj.day
    if (!Array.isArray(obj.discoveries)) obj.discoveries = []
    if (typeof obj.starterPackGiven !== 'boolean') obj.starterPackGiven = false
    if (!obj.starterPackGiven) {
      obj.ingredients['banana'] = (obj.ingredients['banana'] ?? 0) + 2
      obj.ingredients['honey'] = (obj.ingredients['honey'] ?? 0) + 2
      obj.starterPackGiven = true
      obj.eventLog.unshift({ id: 'mig-v2', day: obj.day, hour: obj.hour ?? 8, text: 'بسته شروع نسخه ۲: ۲ موز و ۲ عسل به انبار مواد اضافه شد. از فروشگاه مواد بخر و ترکیب بساز!', kind: 'good' })
    }
    const STATS = ['power', 'focus', 'speed', 'calm', 'popularity', 'durability', 'glow', 'quality']
    if (Array.isArray(obj.customers)) {
      obj.customers.forEach((c, i) => {
        if (!c.preferredStat) c.preferredStat = STATS[i % STATS.length]
        if (!c.dependencyPreference) c.dependencyPreference = (['low', 'mid', 'high'] as const)[i % 3]
        if (typeof c.lastDependency !== 'number') c.lastDependency = 0
        if (typeof c.lastPurchaseDay !== 'number') c.lastPurchaseDay = 0
        if (typeof c.highDepStreak !== 'number') c.highDepStreak = 0
        if (typeof c.restUntilDay !== 'number') c.restUntilDay = 0
      })
    }
    // ---- v3 migration: stacking signatures, qty merge, sales list, order dedupe ----
    if (!obj.inventory || typeof obj.inventory !== 'object') obj.inventory = {}
    if (!Array.isArray(obj.specials)) obj.specials = []
    if (!Array.isArray(obj.orders)) obj.orders = []
    const idToSig: Record<string, string> = {}
    const merged: GameState['specials'] = []
    const bySig = new Map<string, GameState['specials'][number]>()
    for (const s of obj.specials) {
      if (!s.ingredientIds) s.ingredientIds = []
      if (!s.stats) s.stats = {}
      const sig = signatureForSpecial(s)
      idToSig[s.id] = sig
      const invQty = obj.inventory[s.id]?.qty
      const qty = Math.max(0, s.qty ?? invQty ?? 1)
      if (typeof s.dependency !== 'number') {
        s.dependency = s.ingredientIds.length
          ? computeCraft(s.baseId, s.ingredientIds).dependency
          : (PRODUCTS.find((p) => p.id === s.baseId)?.dependency ?? 25)
      }
      s.signature = sig
      s.comboKey = s.comboKey ?? sig
      const existing = bySig.get(sig)
      if (existing) {
        existing.qty = (existing.qty ?? 0) + qty
      } else {
        s.qty = qty
        s.id = sig
        bySig.set(sig, s)
        merged.push(s)
      }
    }
    obj.specials = merged
    // remap inventory keys old special id -> signature (summing)
    const newInv: GameState['inventory'] = {}
    for (const [k, item] of Object.entries(obj.inventory)) {
      const nk = idToSig[k] ?? k
      if (newInv[nk]) newInv[nk].qty += item.qty
      else newInv[nk] = { ...item }
    }
    obj.inventory = newInv
    // sync special.qty with inventory; create inventory entry if special has qty but none
    for (const s of obj.specials) {
      const inv = obj.inventory[s.signature!]
      if (inv) s.qty = inv.qty
      else if ((s.qty ?? 0) > 0) obj.inventory[s.signature!] = { qty: s.qty!, price: s.value }
    }
    // remap orders to signature keys + dedupe active duplicates
    for (const o of obj.orders) o.productKey = idToSig[o.productKey] ?? o.productKey
    obj.orders = dedupeOrders(obj.orders)
    // discoveries: craftCount default
    if (Array.isArray(obj.discoveries)) for (const d of obj.discoveries) if (typeof d.craftCount !== 'number') d.craftCount = 1
    // sales list: default everything owned -> listed at current price (no stuck players)
    if (!obj.salesList || typeof obj.salesList !== 'object') obj.salesList = {}
    for (const [k, item] of Object.entries(obj.inventory)) {
      if (!obj.salesList[k]) obj.salesList[k] = { listed: true, price: Math.max(1, item.price || 1) }
    }
    for (const s of obj.specials) {
      if (!obj.salesList[s.signature!]) obj.salesList[s.signature!] = { listed: true, price: Math.max(1, s.value || 1) }
    }
    // ---- v4 migration: crafting queue (free but timed) ----
    if (!Array.isArray(obj.craftingQueue)) obj.craftingQueue = []
    obj.craftingQueue = obj.craftingQueue.filter((j) =>
      j && typeof j.baseId === 'string' && typeof j.totalHours === 'number' && typeof j.remainingHours === 'number',
    ).map((j) => ({
      ...j,
      baseQty: typeof j.baseQty === 'number' ? j.baseQty : 1,
      ingredientIds: Array.isArray(j.ingredientIds) ? j.ingredientIds : [],
      modifierIds: Array.isArray(j.modifierIds) ? j.modifierIds : [],
      signature: j.signature ?? signatureForSpecial(j),
      name: j.name ?? 'ترکیب',
      createdDay: typeof j.createdDay === 'number' ? j.createdDay : obj.day,
    }))
    obj.saveVersion = SAVE_VERSION
    return obj
  } catch {
    return null
  }
}

export async function saveGame(state: GameState): Promise<void> {
  try {
    const d = await db()
    await d.put(STORE, serialize(state), KEY)
  } catch {
    // fallback: localStorage (light settings + emergency save)
    try { localStorage.setItem('ue-save', serialize(state)) } catch { /* ignore */ }
  }
}

export async function loadGame(): Promise<GameState | null> {
  try {
    const d = await db()
    const raw = (await d.get(STORE, KEY)) as string | undefined
    if (raw) return deserialize(raw)
  } catch { /* fall through */ }
  try {
    const raw = localStorage.getItem('ue-save')
    if (raw) return deserialize(raw)
  } catch { /* ignore */ }
  return null
}

export async function clearSave(): Promise<void> {
  try {
    const d = await db()
    await d.delete(STORE, KEY)
  } catch { /* ignore */ }
  try { localStorage.removeItem('ue-save') } catch { /* ignore */ }
}

export function loadSettings(): { sound: boolean } {
  try {
    const raw = localStorage.getItem('ue-settings')
    if (raw) return JSON.parse(raw) as { sound: boolean }
  } catch { /* ignore */ }
  return { sound: false }
}

export function saveSettings(s: { sound: boolean }): void {
  try { localStorage.setItem('ue-settings', JSON.stringify(s)) } catch { /* ignore */ }
}
