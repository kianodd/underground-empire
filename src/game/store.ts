import { create } from 'zustand'
import { DISTRICTS, MISSIONS, MODIFIERS, PRODUCTS, makeCustomers, makeRivals, makeStaff } from './data'
import { clamp, dailyRent, dailyWages, findSpecial, isListed, listedInStockKeys, productDependency, productName, productValue, productionCapacity, salePrice, storageCap, totalWarehouseUnits, upgradeCost } from './economy'
import { CRAFT_QUEUE_MAX, buildSpecial, buildSpecialV2, craftDurationHours, generateSpecialName, signatureOf } from './crafting'
import { computeCraft, ingredientById, shopPrice, shopStockForDay } from './ingredients'
import { customerMaxPrice, customerOfferPrice, dependencyFit, loyaltyGainFromDependency, negotiate, priceDemandFactor, repeatOrderFactor, type NegotiationResult } from './npc'
import { dedupeOrders } from './save'
import { heatDecayPerHour, heatFromSale } from './police'
import { playerShare, tickRivals } from './market'
import { currentStage, stageName } from './progression'
import { missionDef, missionDone, metricValue } from './missions'
import { SAVE_VERSION, type CraftingJob, type GameState, type Order } from './types'

let uid = 1
const nid = (p: string) => `${p}${Date.now().toString(36)}${uid++}`

export function initialState(): GameState {
  return {
    saveVersion: SAVE_VERSION,
    cash: 500,
    reputation: 0,
    day: 1,
    hour: 8,
    speed: 1,
    heat: 0,
    salesPausedUntilDay: 0,
    inventory: {},
    salesList: {},
    ingredients: { banana: 2, honey: 2 },
    shopStock: shopStockForDay(1),
    shopDay: 1,
    discoveries: [],
    starterPackGiven: true,
    specials: [],
    customers: makeCustomers(),
    orders: [],
    staff: makeStaff(),
    districts: structuredClone(DISTRICTS),
    rivals: makeRivals(),
    ledger: [{ id: nid('l'), day: 1, hour: 8, kind: 'income', amount: 500, desc: 'سرمایه شروع' }],
    productionQueue: [],
    craftingQueue: [],
    upgrades: { capacity: 0, quality: 0, storage: 0, riskMgmt: 0, marketing: 0 },
    missions: MISSIONS.map((m) => ({ defId: m.id, claimed: false, baseline: 0 })),
    eventLog: [{ id: nid('e'), day: 1, hour: 8, text: 'شبکه‌ات را در محله قدیمی شروع کردی. اولین محصول را تولید کن!', kind: 'info' }],
    stats: { totalIncome: 0, totalExpense: 0, deals: 0, crafts: 0, hires: 0, customersServed: [] },
    demandSpike: null,
    costMult: null,
    settings: { sound: false },
    lastSavedAt: Date.now(),
    startedAtDay: 1,
  }
}

export interface Toast { id: string; text: string; kind: 'info' | 'warn' | 'good' | 'bad' }

interface Store {
  game: GameState
  toasts: Toast[]
  stage: number
  loaded: boolean
  setGame: (g: GameState) => void
  toast: (text: string, kind?: Toast['kind']) => void
  dismissToast: (id: string) => void
  tick: () => void
  setSpeed: (s: 0 | 1 | 3) => void
  startProduction: (productId: string, qty: number) => string | null
  cancelProduction: (jobId: string) => void
  craft: (baseId: string, modifierIds: string[]) => string | null
  craftWithIngredients: (baseId: string, ingredientIds: string[]) => string | null
  cancelCrafting: (jobId: string) => void
  buyIngredient: (id: string, qty: number) => string | null
  sellIngredient: (id: string, qty: number) => string | null
  setPrice: (key: string, price: number) => void
  setListed: (key: string, listed: boolean) => void
  setSalePrice: (key: string, price: number) => void
  setAllListed: (listed: boolean) => void
  negotiateOrder: (orderId: string, counterPrice: number) => NegotiationResult | null
  acceptOrder: (orderId: string, price: number, discounted?: boolean) => string | null
  rejectOrder: (orderId: string) => void
  hireStaff: (id: string) => string | null
  fireStaff: (id: string) => void
  upgradeStaff: (id: string) => string | null
  unlockDistrict: (id: string) => string | null
  buyUpgrade: (kind: keyof GameState['upgrades']) => string | null
  claimMission: (defId: string) => string | null
  setSound: (on: boolean) => void
  resetGame: () => void
  importGame: (g: GameState) => void
}

function logEvent(g: GameState, text: string, kind: GameState['eventLog'][number]['kind'] = 'info') {
  g.eventLog.unshift({ id: nid('e'), day: g.day, hour: g.hour, text, kind })
  g.eventLog = g.eventLog.slice(0, 80)
}

function addLedger(g: GameState, kind: 'income' | 'expense', amount: number, desc: string) {
  g.ledger.unshift({ id: nid('l'), day: g.day, hour: g.hour, kind, amount: Math.round(amount), desc })
  g.ledger = g.ledger.slice(0, 200)
  if (kind === 'income') g.stats.totalIncome += Math.round(amount)
  else g.stats.totalExpense += Math.round(amount)
}

export function ensureListing(g: GameState, key: string, price: number) {
  if (!g.salesList) g.salesList = {}
  if (!g.salesList[key]) g.salesList[key] = { listed: true, price: Math.max(1, Math.round(price)) }
}

export function hasActiveOrder(g: GameState, customerId: string, productKey: string): boolean {
  return g.orders.some((o) => o.status === 'open' && o.customerId === customerId && o.productKey === productKey)
}

/**
 * v4: finish one crafting job — add product to its stack, run discovery check.
 * Crafting is FREE; discovery reward (+50 coins/+3 reputation) happens ONLY here, at completion.
 */
export function completeCraftJob(g: GameState, job: CraftingJob, toast?: (t: string, k?: Toast['kind']) => void): void {
  const isLegacy = job.modifierIds.length > 0
  const sp = isLegacy
    ? buildSpecial(job.baseId, job.modifierIds, g.day, g.upgrades.quality * 5)
    : buildSpecialV2(job.baseId, job.ingredientIds, g.day, g.upgrades.quality * 5)
  if (isLegacy) sp.name = job.name // keep the name predicted when queued
  const existingSp = findSpecial(g, sp.signature!)
  let stackQty = 1
  if (existingSp) {
    const invEx = g.inventory[sp.signature!]
    g.inventory[sp.signature!] = { qty: (invEx?.qty ?? 0) + 1, price: invEx?.price ?? existingSp.value }
    existingSp.qty = g.inventory[sp.signature!].qty
    stackQty = existingSp.qty
  } else {
    g.specials.unshift(sp)
    g.inventory[sp.id] = { qty: 1, price: sp.value }
  }
  ensureListing(g, sp.signature!, sp.value)
  g.stats.crafts += 1
  g.reputation += 2
  const readyText = `ترکیب آماده شد: «${sp.name}» (ارزش ${sp.value.toLocaleString('fa-IR')}) — موجودی این ترکیب: ×${stackQty}.`
  logEvent(g, readyText, 'good')
  if (toast) toast(readyText, 'good')
  if (!isLegacy) {
    const existingDiscovery = g.discoveries.find((d) => d.key === sp.comboKey)
    if (existingDiscovery) {
      existingDiscovery.craftCount = (existingDiscovery.craftCount ?? 1) + 1
    } else {
      const r = computeCraft(job.baseId, job.ingredientIds, g.upgrades.quality * 5)
      g.discoveries.unshift({
        key: sp.comboKey!, name: sp.name, baseId: job.baseId, ingredientIds: [...job.ingredientIds],
        value: sp.value, day: g.day, stats: sp.stats ?? {},
        synergyNames: [...new Set(r.synergies.map((s) => s.name))],
        craftCount: 1,
      })
      g.cash += 50
      addLedger(g, 'income', 50, 'پاداش کشف ترکیب جدید')
      g.reputation += 3
      const text = `کشف جدید! ترکیب «${sp.name}» برای اولین بار ساخته شد (+۵۰ سکه، +۳ اعتبار).`
      logEvent(g, text, 'good')
      if (toast) toast(text, 'good')
    }
  }
}

/**
 * v4: advance the SEQUENTIAL crafting queue by `hours` game-hours.
 * Only the first (active) job progresses; leftover hours carry into the next job.
 */
export function advanceCrafting(g: GameState, hours: number, toast?: (t: string, k?: Toast['kind']) => void): void {
  if (!Array.isArray(g.craftingQueue)) g.craftingQueue = []
  let left = Math.max(0, hours)
  while (left > 0 && g.craftingQueue.length > 0) {
    const job = g.craftingQueue[0]
    const use = Math.min(left, job.remainingHours)
    job.remainingHours -= use
    left -= use
    if (job.remainingHours <= 0) {
      g.craftingQueue.shift()
      completeCraftJob(g, job, toast)
    }
  }
}

function executeDeal(g: GameState, order: Order, unitPrice: number, discounted: boolean): string | null {
  if (g.salesPausedUntilDay >= g.day) return 'فروش موقتاً متوقف است (فشار نظارتی شهر).'
  const inv = g.inventory[order.productKey]
  if (!inv || inv.qty < order.qty) return 'موجودی کافی نیست؛ اول تولید کن.'
  const customer = g.customers.find((c) => c.id === order.customerId)
  if (!customer) return 'مشتری پیدا نشد.'
  const total = Math.round(unitPrice * order.qty)
  const unitCost = PRODUCTS.find((p) => p.id === order.productKey)?.prodCost ?? Math.round(productValue(g, order.productKey) * 0.4)
  const profit = total - unitCost * order.qty
  inv.qty -= order.qty
  if (inv.qty <= 0) delete g.inventory[order.productKey]
  // v3: keep special stack qty in sync (record stays so listing/name survive at 0)
  const spSold = findSpecial(g, order.productKey)
  if (spSold) spSold.qty = Math.max(0, inv.qty)
  g.cash += total
  addLedger(g, 'income', total, `فروش ${productName(g, order.productKey)} ×${order.qty} به ${customer.name}`)
  order.status = 'done'
  g.orders = g.orders.filter((o) => o.id !== order.id)
  const district = g.districts.find((d) => d.id === customer.districtId)
  const dep = productDependency(g, order.productKey)
  const extraHeat = dep > 70 ? 2 : dep > 50 ? 1 : 0
  g.heat = clamp(g.heat + heatFromSale(g, total, district?.surveillance ?? 30) + extraHeat, 0, 100)
  g.reputation += discounted ? 1 : 2
  customer.deals += 1
  customer.totalProfit += profit
  customer.lastDependency = dep
  customer.lastPurchaseDay = g.day
  if (dep > 70) {
    customer.highDepStreak = (customer.highDepStreak ?? 0) + 1
    customer.satisfaction = clamp(customer.satisfaction - (6 + customer.highDepStreak * 2) + (discounted ? 4 : 0), 0, 100)
    if (customer.satisfaction < 25) {
      customer.restUntilDay = g.day + 3
      logEvent(g, `${customer.name} مدتی از خرید استراحت می‌کند (رضایت پایین در بازی).`, 'warn')
    }
  } else {
    customer.highDepStreak = 0
    customer.satisfaction = clamp(customer.satisfaction + (discounted ? 10 : 4), 0, 100)
  }
  customer.loyalty = clamp(customer.loyalty + (discounted ? 8 : 2) + loyaltyGainFromDependency(dep), 0, 100)
  customer.trust = clamp(customer.trust + 3, 0, 100)
  customer.history.unshift({ day: g.day, hour: g.hour, productName: productName(g, order.productKey), qty: order.qty, unitPrice, total, profit })
  customer.history = customer.history.slice(0, 20)
  g.stats.deals += 1
  if (!g.stats.customersServed.includes(customer.id)) g.stats.customersServed.push(customer.id)
  return null
}

/**
 * v3 order generator. Enforces:
 * - only LISTED products with stock>0 (sales list),
 * - at most ONE active order per customer per unique productKey,
 * - resting customers (low satisfaction) get no orders,
 * - repeat-order weighting + dependency preference (fictional game stats).
 * Returns true if an order was created.
 */
export function tryGenerateOrder(g: GameState, rng: () => number = Math.random): boolean {
  const stage = currentStage(g)
  const pool = g.customers.filter((c) =>
    c.unlockStage <= stage
    && g.districts.find((d) => d.id === c.districtId)?.unlocked
    && (c.restUntilDay ?? 0) < g.day)
  if (!pool.length) return false
  const availableKeys = listedInStockKeys(g).filter((k) => {
    const def = PRODUCTS.find((p) => p.id === k)
    return !def || def.unlockStage <= stage
  })
  if (!availableKeys.length) return false
  // weighted customer pick: high last-dependency => reorders sooner (more likely picked)
  const weights = pool.map((c) => repeatOrderFactor(c))
  const totalW = weights.reduce((a, w) => a + w, 0)
  let roll = rng() * totalW
  let customer = pool[0]
  for (let i = 0; i < pool.length; i++) { roll -= weights[i]; if (roll <= 0) { customer = pool[i]; break } }
  // try the picked customer first, then others, until someone has an eligible product
  const ordered = [customer, ...pool.filter((c) => c.id !== customer.id)]
  for (const cust of ordered) {
    if (cust.personality === 'unreliable' && rng() < 0.25) continue // flaky
    const eligible = availableKeys.filter((k) => !hasActiveOrder(g, cust.id, k))
    if (!eligible.length) continue
    // choose product: taste + preferred stat + dependency fit weighting
    const scored = eligible.map((k) => {
      const sp = findSpecial(g, k)
      let score = 1 + rng()
      if (sp && cust.taste !== 'any' && sp.modifierIds.includes(cust.taste)) score += 2
      if (sp?.stats && cust.preferredStat && (sp.stats[cust.preferredStat] ?? 0) > 0) score += 1.5
      score += dependencyFit(cust, productDependency(g, k)) * 1.5
      return { k, score }
    }).sort((a, b) => b.score - a.score)
    const key = scored[0].k
    const sp = findSpecial(g, key)
    const tasteMatch = !!sp && cust.taste !== 'any' && sp.modifierIds.includes(cust.taste)
    // v4 rebalance: overpricing kills demand — order probability falls sharply above market value
    const marketValue = Math.max(1, productValue(g, key))
    const priceRatio = salePrice(g, key) / marketValue
    if (rng() > priceDemandFactor(priceRatio)) continue
    // negotiation anchor = MARKET value (not the player's list price), so overpricing cannot inflate budgets
    let maxPrice = customerMaxPrice(cust, marketValue, tasteMatch)
    if (sp?.stats && cust.preferredStat) {
      const liked = sp.stats[cust.preferredStat] ?? 0
      if (liked > 0) maxPrice = Math.round(maxPrice * (1 + Math.min(0.25, liked / 40))) // premium capped at +25%
    }
    // dependency fit modestly raises acceptable price
    maxPrice = Math.round(maxPrice * (1 + (dependencyFit(cust, productDependency(g, key)) - 0.3) * 0.2))
    if (g.demandSpike && sp?.modifierIds.includes(g.demandSpike.modifierId)) maxPrice = Math.round(maxPrice * g.demandSpike.mult)
    const qty = Math.max(1, Math.min(10, Math.floor(cust.buyingPower / Math.max(1, maxPrice)) || 1))
    const offerPrice = customerOfferPrice(cust, maxPrice, rng)
    g.orders.unshift({
      id: nid('o'), customerId: cust.id, productKey: key, qty,
      offerPrice, maxPrice, createdDay: g.day, createdHour: g.hour,
      expiresInHours: 48, status: 'open',
    })
    g.orders = dedupeOrders(g.orders).slice(0, 30)
    return true
  }
  return false
}

function generateOrder(g: GameState) {
  tryGenerateOrder(g)
}

function randomCityEvent(g: GameState, toast: (t: string, k?: Toast['kind']) => void) {
  const roll = Math.random()
  if (roll < 0.22) {
    const mod = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)]
    g.demandSpike = { modifierId: mod.id, untilDay: g.day + 2, mult: 1.5 }
    const text = `رویداد شهر: تقاضا برای محصولات «${mod.name}» تا ۲ روز آینده ۵۰٪ بیشتر شد!`
    logEvent(g, text, 'good'); toast(text, 'good')
  } else if (roll < 0.4) {
    g.costMult = { untilDay: g.day + 2, mult: 1.4 }
    const text = 'رویداد شهر: هزینه‌های تولید به‌مدت ۲ روز ۴۰٪ افزایش یافت.'
    logEvent(g, text, 'warn'); toast(text, 'warn')
  } else if (roll < 0.55) {
    const rival = g.rivals[Math.floor(Math.random() * g.rivals.length)]
    rival.marketShare = clamp(rival.marketShare + 4, 0, 60)
    const text = `رقیب ${rival.name} با کمپین تبلیغاتی سهم بازارش را افزایش داد.`
    logEvent(g, text, 'warn'); toast(text, 'warn')
  } else if (roll < 0.7) {
    const wealthy = g.customers.filter((c) => c.personality === 'wealthy' && c.unlockStage <= currentStage(g))
    if (wealthy.length) {
      const c = wealthy[Math.floor(Math.random() * wealthy.length)]
      c.buyingPower += 1500
      const text = `مشتری ویژه: قدرت خرید ${c.name} افزایش یافت؛ سفارش‌های بزرگ‌تری می‌دهد.`
      logEvent(g, text, 'good'); toast(text, 'good')
    }
  }
}

function dayRollover(g: GameState, toast: (t: string, k?: Toast['kind']) => void) {
  const rent = dailyRent(g)
  const wages = dailyWages(g)
  if (rent > 0) { g.cash -= rent; addLedger(g, 'expense', rent, 'اجاره روزانه مناطق'); }
  if (wages > 0) {
    if (g.cash >= wages) { g.cash -= wages; addLedger(g, 'expense', wages, 'حقوق روزانه نیروها') }
    else {
      for (const s of g.staff.filter((x) => x.hired)) s.loyalty = clamp(s.loyalty - 15, 0, 100)
      const text = 'موجودی برای پرداخت حقوق کافی نبود؛ وفاداری نیروها کاهش یافت.'
      logEvent(g, text, 'bad'); toast(text, 'bad')
      g.cash -= wages; addLedger(g, 'expense', wages, 'حقوق روزانه نیروها (کسری)')
    }
  }
  tickRivals(g)
  // daily missions reset baselines for unclaimed
  for (const ms of g.missions) {
    const def = missionDef(ms.defId)
    if (def.kind === 'daily') { ms.baseline = metricValue(g, def.metric); ms.claimed = false }
  }
  if (g.demandSpike && g.day > g.demandSpike.untilDay) g.demandSpike = null
  if (g.costMult && g.day > g.costMult.untilDay) g.costMult = null
  // v2: shop restock + daily price change
  g.shopStock = shopStockForDay(g.day)
  g.shopDay = g.day
  logEvent(g, 'فروشگاه مواد شارژ شد و قیمت‌های امروز به‌روز شدند.', 'info')
  randomCityEvent(g, toast)
  // inspection
  if (g.heat > 80 && Math.random() < 0.5) {
    const fine = Math.max(40, Math.round(g.cash * 0.08)) // v4: 8% of cash, min meaningful
    if (fine > 0) { g.cash -= fine; addLedger(g, 'expense', fine, 'جریمه بازرسی شهری') }
    g.salesPausedUntilDay = g.day + 1
    g.heat = clamp(g.heat - 30, 0, 100)
    const text = `بازرسی شهری! جریمه ${fine.toLocaleString('fa-IR')} سکه و توقف فروش تا فردا.`
    logEvent(g, text, 'bad'); toast(text, 'bad')
  }
  if (g.heat > 95) {
    g.salesPausedUntilDay = g.day + 1
    const text = 'توجه پلیس به اوج رسید؛ فروش تا فردا متوقف شد.'
    logEvent(g, text, 'bad'); toast(text, 'bad')
  }
}

export const useStore = create<Store>((set, get) => ({
  game: initialState(),
  toasts: [],
  stage: 1,
  loaded: false,
  setGame: (g) => set({ game: g, stage: currentStage(g), loaded: true }),
  toast: (text, kind = 'info') => {
    const id = nid('t')
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }].slice(-4) }))
    setTimeout(() => get().dismissToast(id), 5000)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setSpeed: (s) => set((st) => ({ game: { ...st.game, speed: s } })),
  setSound: (on) => set((st) => ({ game: { ...st.game, settings: { sound: on } } })),
  resetGame: () => set({ game: initialState(), stage: 1 }),
  importGame: (g) => set({ game: g, stage: currentStage(g) }),

  tick: () => {
    const g = structuredClone(get().game)
    const toast = get().toast
    g.hour += 1
    if (g.hour >= 24) { g.hour = 0; g.day += 1; dayRollover(g, toast) }
    // production
    for (const job of [...g.productionQueue]) {
      job.hoursLeft -= 1
      if (job.hoursLeft <= 0) {
        g.productionQueue = g.productionQueue.filter((j) => j.id !== job.id)
        const cap = storageCap(g)
        const room = Math.max(0, cap - totalWarehouseUnits(g))
        const add = Math.min(job.qty, room)
        if (add > 0) {
          const existing = g.inventory[job.productId]
          const defPrice = productValue(g, job.productId)
          g.inventory[job.productId] = { qty: (existing?.qty ?? 0) + add, price: existing?.price ?? defPrice }
          ensureListing(g, job.productId, g.inventory[job.productId].price)
          const text = `تولید «${productName(g, job.productId)}» ×${add} آماده شد.`
          logEvent(g, text, 'good'); toast(text, 'good')
        } else {
          logEvent(g, 'انبار پر است؛ بخشی از تولید از دست رفت.', 'warn')
        }
      }
    }
    // v4: crafting queue (free, sequential, 1 game-hour per tick)
    advanceCrafting(g, 1, toast)
    // orders expire
    for (const o of g.orders) o.expiresInHours -= 1
    const expired = g.orders.filter((o) => o.expiresInHours <= 0)
    if (expired.length) logEvent(g, `${expired.length} سفارش منقضی شد.`, 'info')
    g.orders = g.orders.filter((o) => o.expiresInHours > 0)
    // order generation: day/night demand (v4 rebalance: slower, scaled by market share vs rivals)
    const isDay = g.hour >= 7 && g.hour <= 22
    const shareFactor = 0.45 + (playerShare(g) / 100) * 0.55
    const rate = ((isDay ? 0.18 : 0.06) + g.upgrades.marketing * 0.05 + g.reputation / 800) * shareFactor
    if (Math.random() < rate && g.salesPausedUntilDay < g.day) generateOrder(g)
    // staff auto-sell small orders (v4: thin margin — a rep needs several sales/day to break even)
    for (const s of g.staff.filter((x) => x.hired)) {
      if (Math.random() < s.skill / 900) {
        const small = g.orders.find((o) => o.qty <= 2 && isListed(g, o.productKey) && (g.inventory[o.productKey]?.qty ?? 0) >= o.qty)
        if (small) {
          const err = executeDeal(g, small, small.offerPrice, false)
          if (!err) { s.autoSales += 1; logEvent(g, `${s.name} یک سفارش را خودکار فروخت.`, 'good') }
        }
      }
    }
    // heat decay
    g.heat = clamp(g.heat - heatDecayPerHour(g), 0, 100)
    const newStage = currentStage(g)
    if (newStage > get().stage) {
      const text = `تبریک! به مرحله «${stageName(newStage)}» رسیدی؛ امکانات جدید باز شد.`
      logEvent(g, text, 'good'); toast(text, 'good')
    }
    set({ game: g, stage: newStage })
  },

  startProduction: (productId, qty) => {
    const g = structuredClone(get().game)
    const def = PRODUCTS.find((p) => p.id === productId)
    if (!def) return 'محصول پیدا نشد.'
    if (def.unlockStage > currentStage(g)) return 'این محصول هنوز باز نشده است.'
    if (g.productionQueue.length >= productionCapacity(g)) return 'ظرفیت تولید پر است؛ ارتقا بده یا صبر کن.'
    const mult = g.costMult && g.day <= g.costMult.untilDay ? g.costMult.mult : 1
    const cost = Math.round(def.prodCost * qty * mult)
    if (g.cash < cost) return 'موجودی کافی نیست.'
    g.cash -= cost
    addLedger(g, 'expense', cost, `هزینه تولید ${def.name} ×${qty}`)
    g.productionQueue.push({
      id: nid('j'), productId, qty,
      hoursLeft: def.prodHours * qty, totalHours: def.prodHours * qty,
      quality: 50 + g.upgrades.quality * 10,
    })
    set({ game: g })
    return null
  },

  cancelProduction: (jobId) => {
    const g = structuredClone(get().game)
    g.productionQueue = g.productionQueue.filter((j) => j.id !== jobId)
    set({ game: g })
  },

  craft: (baseId, modifierIds) => {
    // v4: FREE but queued (legacy modifier crafting)
    const g = structuredClone(get().game)
    if (!Array.isArray(g.craftingQueue)) g.craftingQueue = []
    if (!modifierIds.length) return 'حداقل یک ویژگی انتخاب کن.'
    if (g.craftingQueue.length >= CRAFT_QUEUE_MAX) return `صف ساخت پر است؛ حداکثر ${CRAFT_QUEUE_MAX} ساخت در صف. صبر کن یا یکی را لغو کن.`
    const inv = g.inventory[baseId]
    if (!inv || inv.qty < 2) return 'برای ترکیب به ۲ واحد از محصول پایه نیاز است.'
    inv.qty -= 2
    if (inv.qty <= 0) delete g.inventory[baseId]
    const hours = craftDurationHours(modifierIds.length)
    const job: CraftingJob = {
      id: nid('c'), baseId, baseQty: 2, ingredientIds: [], modifierIds: [...modifierIds],
      signature: `${baseId}|mod:${modifierIds.join(',')}`, name: generateSpecialName(),
      totalHours: hours, remainingHours: hours, createdDay: g.day,
    }
    g.craftingQueue.push(job)
    logEvent(g, `ساخت «${job.name}» در صف قرار گرفت (${hours.toLocaleString('fa-IR')} ساعت بازی) — رایگان.`, 'info')
    set({ game: g, stage: currentStage(g) })
    return null
  },

  cancelCrafting: (jobId) => {
    const g = structuredClone(get().game)
    if (!Array.isArray(g.craftingQueue)) g.craftingQueue = []
    const job = g.craftingQueue.find((j) => j.id === jobId)
    if (!job) return
    g.craftingQueue = g.craftingQueue.filter((j) => j.id !== jobId)
    // full refund of materials consumed at queue time
    const ex = g.inventory[job.baseId]
    g.inventory[job.baseId] = { qty: (ex?.qty ?? 0) + job.baseQty, price: ex?.price ?? productValue(g, job.baseId) }
    for (const id of job.ingredientIds) g.ingredients[id] = (g.ingredients[id] ?? 0) + 1
    logEvent(g, `ساخت «${job.name}» لغو شد و موادش به انبار برگشت.`, 'info')
    set({ game: g })
  },

  buyIngredient: (id, qty) => {
    const g = structuredClone(get().game)
    const def = ingredientById(id)
    if (!def) return 'این ماده در فروشگاه نیست.'
    if (qty < 1) return 'تعداد نامعتبر است.'
    if (g.shopDay !== g.day) { g.shopStock = shopStockForDay(g.day); g.shopDay = g.day }
    const stock = g.shopStock[id] ?? 0
    if (stock < qty) return 'موجودی فروشگاه کافی نیست.'
    const price = shopPrice(def, g.day)
    const total = price * qty
    if (g.cash < total) return 'موجودی کافی نیست.'
    if (totalWarehouseUnits(g) + qty > storageCap(g)) return 'ظرفیت انبار پر است؛ ارتقای انبار بگیر.'
    g.cash -= total
    addLedger(g, 'expense', total, `خرید ${def.name} ×${qty} از فروشگاه`)
    g.shopStock[id] = stock - qty
    g.ingredients[id] = (g.ingredients[id] ?? 0) + qty
    set({ game: g })
    return null
  },

  sellIngredient: (id, qty) => {
    const g = structuredClone(get().game)
    const def = ingredientById(id)
    if (!def) return 'این ماده پیدا نشد.'
    const owned = g.ingredients[id] ?? 0
    if (owned < qty || qty < 1) return 'موجودی انبار کافی نیست.'
    const price = Math.max(1, Math.floor(shopPrice(def, g.day) * 0.5))
    const total = price * qty
    g.ingredients[id] = owned - qty
    if (g.ingredients[id] <= 0) delete g.ingredients[id]
    g.cash += total
    addLedger(g, 'income', total, `فروش ${def.name} ×${qty} به فروشگاه (نصف قیمت)`)
    set({ game: g })
    return null
  },

  craftWithIngredients: (baseId, ingredientIds) => {
    // v4: FREE but queued — materials consumed now, product arrives after game-time passes
    const g = structuredClone(get().game)
    if (!Array.isArray(g.craftingQueue)) g.craftingQueue = []
    if (ingredientIds.length < 1 || ingredientIds.length > 4) return 'بین ۱ تا ۴ ماده انتخاب کن.'
    if (g.craftingQueue.length >= CRAFT_QUEUE_MAX) return `صف ساخت پر است؛ حداکثر ${CRAFT_QUEUE_MAX} ساخت در صف. صبر کن یا یکی را لغو کن.`
    const inv = g.inventory[baseId]
    if (!inv || inv.qty < 1) return 'برای ترکیب به ۱ واحد از محصول پایه نیاز است؛ اول تولید کن.'
    // check ingredient counts (allow same ingredient in multiple slots)
    const need: Record<string, number> = {}
    for (const id of ingredientIds) need[id] = (need[id] ?? 0) + 1
    for (const [id, n] of Object.entries(need)) {
      if ((g.ingredients[id] ?? 0) < n) return `ماده «${ingredientById(id)?.name ?? id}» کافی نیست؛ از فروشگاه بخر.`
    }
    for (const [id, n] of Object.entries(need)) {
      g.ingredients[id] -= n
      if (g.ingredients[id] <= 0) delete g.ingredients[id]
    }
    inv.qty -= 1
    if (inv.qty <= 0) delete g.inventory[baseId]
    const hours = craftDurationHours(ingredientIds.length)
    const predicted = computeCraft(baseId, ingredientIds, g.upgrades.quality * 5)
    const job: CraftingJob = {
      id: nid('c'), baseId, baseQty: 1, ingredientIds: [...ingredientIds], modifierIds: [],
      signature: signatureOf(baseId, ingredientIds), name: predicted.name,
      totalHours: hours, remainingHours: hours, createdDay: g.day,
    }
    g.craftingQueue.push(job)
    logEvent(g, `ساخت «${job.name}» در صف قرار گرفت (${hours.toLocaleString('fa-IR')} ساعت بازی) — رایگان.`, 'info')
    set({ game: g, stage: currentStage(g) })
    return null
  },

  setPrice: (key, price) => {
    const g = structuredClone(get().game)
    const p = Math.max(1, Math.round(price))
    if (g.inventory[key]) g.inventory[key].price = p
    ensureListing(g, key, p)
    g.salesList[key].price = p
    set({ game: g })
  },

  setListed: (key, listed) => {
    const g = structuredClone(get().game)
    ensureListing(g, key, salePrice(g, key))
    g.salesList[key].listed = listed
    set({ game: g })
  },

  setSalePrice: (key, price) => {
    const g = structuredClone(get().game)
    const p = Math.max(1, Math.round(price))
    ensureListing(g, key, p)
    g.salesList[key].price = p
    if (g.inventory[key]) g.inventory[key].price = p
    set({ game: g })
  },

  setAllListed: (listed) => {
    const g = structuredClone(get().game)
    const keys = new Set([...Object.keys(g.inventory), ...g.specials.map((s) => s.signature ?? s.id), ...Object.keys(g.salesList ?? {})])
    for (const k of keys) { ensureListing(g, k, salePrice(g, k)); g.salesList[k].listed = listed }
    set({ game: g })
  },

  negotiateOrder: (orderId, counterPrice) => {
    const g = get().game
    const order = g.orders.find((o) => o.id === orderId)
    if (!order) return null
    const customer = g.customers.find((c) => c.id === order.customerId)
    if (!customer) return null
    const res = negotiate(customer, counterPrice, order.offerPrice, order.maxPrice)
    if (res.outcome === 'reject') {
      const ng = structuredClone(g)
      const nc = ng.customers.find((c) => c.id === customer.id)!
      nc.trust = clamp(nc.trust - 8, 0, 100)
      nc.satisfaction = clamp(nc.satisfaction - 5, 0, 100)
      ng.orders = ng.orders.filter((o) => o.id !== orderId)
      logEvent(ng, `${customer.name} به‌خاطر قیمت بالا معامله را لغو کرد.`, 'bad')
      set({ game: ng })
    }
    return res
  },

  acceptOrder: (orderId, price, discounted = false) => {
    const g = structuredClone(get().game)
    const order = g.orders.find((o) => o.id === orderId)
    if (!order) return 'سفارش پیدا نشد.'
    const err = executeDeal(g, order, price, discounted)
    if (err) return err
    set({ game: g, stage: currentStage(g) })
    return null
  },

  rejectOrder: (orderId) => {
    const g = structuredClone(get().game)
    g.orders = g.orders.filter((o) => o.id !== orderId)
    set({ game: g })
  },

  hireStaff: (id) => {
    const g = structuredClone(get().game)
    const s = g.staff.find((x) => x.id === id)
    if (!s || s.hired) return 'این نیرو در دسترس نیست.'
    if (g.cash < s.hireCost) return 'موجودی کافی نیست.'
    g.cash -= s.hireCost
    addLedger(g, 'expense', s.hireCost, `هزینه استخدام ${s.name}`)
    s.hired = true
    g.stats.hires += 1
    set({ game: g })
    return null
  },

  fireStaff: (id) => {
    const g = structuredClone(get().game)
    const s = g.staff.find((x) => x.id === id)
    if (s) s.hired = false
    set({ game: g })
  },

  upgradeStaff: (id) => {
    const g = structuredClone(get().game)
    const s = g.staff.find((x) => x.id === id)
    if (!s || !s.hired) return 'نیرو استخدام نشده است.'
    const cost = 200 * s.level
    if (g.cash < cost) return 'موجودی کافی نیست.'
    g.cash -= cost
    addLedger(g, 'expense', cost, `ارتقای ${s.name}`)
    s.level += 1
    s.skill = clamp(s.skill + 8, 0, 100)
    set({ game: g })
    return null
  },

  unlockDistrict: (id) => {
    const g = structuredClone(get().game)
    const d = g.districts.find((x) => x.id === id)
    if (!d || d.unlocked) return 'این منطقه در دسترس نیست.'
    if (d.unlockStage > currentStage(g)) return `نیازمند مرحله ${d.unlockStage} است.`
    if (g.cash < d.unlockCost) return 'موجودی کافی نیست.'
    g.cash -= d.unlockCost
    addLedger(g, 'expense', d.unlockCost, `باز کردن منطقه ${d.name}`)
    d.unlocked = true
    g.reputation += 5
    logEvent(g, `منطقه «${d.name}» باز شد!`, 'good')
    set({ game: g, stage: currentStage(g) })
    return null
  },

  buyUpgrade: (kind) => {
    const g = structuredClone(get().game)
    const level = g.upgrades[kind]
    const cost = upgradeCost(kind, level)
    if (g.cash < cost) return 'موجودی کافی نیست.'
    g.cash -= cost
    addLedger(g, 'expense', cost, `ارتقای ${kind}`)
    g.upgrades[kind] += 1
    set({ game: g })
    return null
  },

  claimMission: (defId) => {
    const g = structuredClone(get().game)
    const def = missionDef(defId)
    const ms = g.missions.find((m) => m.defId === defId)
    if (!ms || ms.claimed) return 'این مأموریت قبلاً گرفته شده است.'
    if (!missionDone(g, def)) return 'مأموریت هنوز کامل نشده است.'
    ms.claimed = true
    g.cash += def.reward
    addLedger(g, 'income', def.reward, `پاداش مأموریت: ${def.title}`)
    g.reputation += 3
    set({ game: g, stage: currentStage(g) })
    return null
  },
}))

export function beep(enabled: boolean) {
  if (!enabled) return
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.value = 0.08
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(); osc.stop(ctx.currentTime + 0.12)
  } catch { /* ignore */ }
}
