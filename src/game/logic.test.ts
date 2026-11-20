import { describe, expect, it } from 'vitest'
import { CRAFT_QUEUE_MAX, craftCost, craftCostV2, craftDurationHours, craftValue, generateSpecialName } from './crafting'
import { advanceCrafting } from './store'

/** v4 test helper: advance the crafting queue by N game-hours through the real engine. */
const finishCrafts = (hours: number) => {
  const g = structuredClone(useStore.getState().game)
  advanceCrafting(g, hours)
  useStore.getState().setGame(g)
}
import { INGREDIENTS, SYNERGIES, computeCraft, shopPrice, ingredientById } from './ingredients'
import { useStore } from './store'
import { acceptProbability, negotiate } from './npc'
import { deserialize, serialize } from './save'
import { initialState } from './store'
import { currentStage } from './progression'
import { heatFromSale } from './police'
import { netWorth } from './economy'
import type { Customer } from './types'

const cust = (over: Partial<Customer> = {}): Customer => ({
  id: 'c1', name: 'تست', age: 30, personality: 'normal', trust: 50, buyingPower: 1000,
  loyalty: 50, priceSensitivity: 0.5, taste: 'any', risk: 30, satisfaction: 50,
  districtId: 'oldtown', unlockStage: 1, history: [], totalProfit: 0, deals: 0, ...over,
})

describe('crafting', () => {
  it('value increases with stronger modifiers', () => {
    const a = craftValue('ink', ['shiny'])
    const b = craftValue('ink', ['legend'])
    expect(b.value).toBeGreaterThan(a.value)
    expect(b.rarity).toBeGreaterThanOrEqual(a.rarity)
  })
  it('quality and popularity bounded 0..100, rarity 1..10', () => {
    const v = craftValue('pearl', ['legend', 'rare'], 50)
    expect(v.quality).toBeLessThanOrEqual(100)
    expect(v.popularity).toBeLessThanOrEqual(100)
    expect(v.rarity).toBeLessThanOrEqual(10)
    expect(v.rarity).toBeGreaterThanOrEqual(1)
  })
  it('generates non-empty Persian name', () => {
    expect(generateSpecialName(() => 0).length).toBeGreaterThan(3)
  })
})

describe('negotiation', () => {
  it('accept probability bounded and monotonic in price', () => {
    const c = cust()
    const p1 = acceptProbability(c, 60, 50, 100)
    const p2 = acceptProbability(c, 90, 50, 100)
    const p3 = acceptProbability(c, 200, 50, 100)
    expect(p1).toBeGreaterThanOrEqual(0); expect(p1).toBeLessThanOrEqual(1)
    expect(p1).toBeGreaterThan(p2)
    expect(p3).toBe(0)
    expect(acceptProbability(c, 50, 50, 100)).toBe(1)
  })
  it('picky customers accept less than wealthy at same price', () => {
    const picky = cust({ personality: 'picky', priceSensitivity: 0.9 })
    const wealthy = cust({ personality: 'wealthy', priceSensitivity: 0.25 })
    expect(acceptProbability(wealthy, 85, 50, 100)).toBeGreaterThan(acceptProbability(picky, 85, 50, 100))
  })
  it('negotiate returns valid outcome', () => {
    const r = negotiate(cust(), 55, 50, 100, () => 0.01)
    expect(['accept', 'counter', 'reject']).toContain(r.outcome)
  })
})

describe('save round-trip', () => {
  it('serialize/deserialize preserves core fields', () => {
    const g = initialState()
    g.cash = 1234; g.day = 7; g.reputation = 42
    const back = deserialize(serialize(g))
    expect(back).not.toBeNull()
    expect(back!.cash).toBe(1234)
    expect(back!.day).toBe(7)
    expect(back!.reputation).toBe(42)
    expect(back!.customers.length).toBe(g.customers.length)
  })
  it('deserialize rejects garbage', () => {
    expect(deserialize('not json')).toBeNull()
    expect(deserialize('{"x":1}')).toBeNull()
  })
})

describe('v2 ingredients & order-dependent crafting', () => {
  it('has at least 48 ingredients and at least 100 synergy rules', () => {
    expect(INGREDIENTS.length).toBeGreaterThanOrEqual(48)
    expect(SYNERGIES.length).toBeGreaterThanOrEqual(100)
  })
  it('banana gives a power buff in game stats', () => {
    const r = computeCraft('ink', ['banana'])
    expect(r.stats.power).toBeGreaterThan(0)
  })
  it('order matters: A,B differs from B,A', () => {
    const ab = computeCraft('ink', ['banana', 'honey'])
    const ba = computeCraft('ink', ['honey', 'banana'])
    expect(ab.stats).not.toEqual(ba.stats)
    expect(ab.comboKey).not.toBe(ba.comboKey)
  })
  it('order matters for antagonism pair too', () => {
    const a = computeCraft('ink', ['caramel', 'salt'])
    const b = computeCraft('ink', ['salt', 'caramel'])
    expect(a.value).not.toBe(b.value)
  })
  it('deterministic: same ordered tuple twice gives identical result', () => {
    const a = computeCraft('stone', ['coffee', 'chocolate', 'mint'])
    const b = computeCraft('stone', ['coffee', 'chocolate', 'mint'])
    expect(a).toEqual(b)
  })
  it('infinite combos: many distinct ordered tuples give valid values', () => {
    const ids = INGREDIENTS.slice(0, 12).map((i) => i.id)
    let count = 0
    for (const a of ids) for (const b of ids) {
      const r = computeCraft('ink', [a, b])
      expect(Number.isFinite(r.value)).toBe(true)
      expect(r.value).toBeGreaterThan(0)
      count++
    }
    expect(count).toBe(144)
  })
  it('value bounds: never negative or NaN even with debuffs', () => {
    const r = computeCraft('ink', ['vinegar', 'salt', 'pepper', 'soda'])
    expect(Number.isFinite(r.value)).toBe(true)
    expect(r.value).toBeGreaterThanOrEqual(1)
    for (const v of Object.values(r.stats)) {
      expect(v).toBeGreaterThanOrEqual(-20)
      expect(v).toBeLessThanOrEqual(60)
    }
  })
  it('shop price fluctuates deterministically within ±25% (v4)', () => {
    const ing = ingredientById('banana')!
    const p1 = shopPrice(ing, 3)
    const p2 = shopPrice(ing, 3)
    expect(p1).toBe(p2)
    expect(p1).toBeGreaterThanOrEqual(Math.floor(ing.basePrice * 0.75) - 1)
    expect(p1).toBeLessThanOrEqual(Math.ceil(ing.basePrice * 1.25) + 1)
    // v4 price floors: nothing below 5 coins base
    expect(Math.min(...INGREDIENTS.map((i) => i.basePrice))).toBeGreaterThanOrEqual(5)
  })
})

describe('v2 shop & consumption via store', () => {
  it('buy ingredient: cash, ledger, inventory and stock change', () => {
    useStore.getState().resetGame()
    const before = useStore.getState().game
    const cash0 = before.cash
    const stock0 = before.shopStock['banana']
    const price = shopPrice(ingredientById('banana')!, before.day)
    const err = useStore.getState().buyIngredient('banana', 3)
    expect(err).toBeNull()
    const after = useStore.getState().game
    expect(after.cash).toBe(cash0 - price * 3)
    expect(after.ingredients['banana']).toBe(2 + 3) // starter pack 2
    expect(after.shopStock['banana']).toBe(stock0 - 3)
    expect(after.ledger[0].desc).toContain('موز')
  })
  it('craft consumes base + ingredients, blocks when insufficient (v4: queued, free)', () => {
    useStore.getState().resetGame()
    const st = useStore.getState()
    // no base product yet -> blocked
    expect(st.craftWithIngredients('ink', ['banana'])).not.toBeNull()
    // give base product
    const g = structuredClone(st.game)
    g.inventory['ink'] = { qty: 2, price: 40 }
    st.setGame(g)
    const cash0 = useStore.getState().game.cash
    const ledger0 = useStore.getState().game.ledger.length
    const err = useStore.getState().craftWithIngredients('ink', ['banana', 'honey'])
    expect(err).toBeNull()
    const after = useStore.getState().game
    expect(after.inventory['ink'].qty).toBe(1)
    expect(after.ingredients['banana'] ?? 0).toBe(1)
    expect(after.ingredients['honey'] ?? 0).toBe(1)
    // v4: free + NOT instant — job queued, no product/discovery yet, cash & ledger untouched
    expect(after.cash).toBe(cash0)
    expect(after.ledger.length).toBe(ledger0)
    expect(after.craftingQueue.length).toBe(1)
    expect(after.specials.length).toBe(0)
    expect(after.discoveries.length).toBe(0)
    finishCrafts(craftDurationHours(2))
    expect(useStore.getState().game.specials.length).toBe(1)
    expect(useStore.getState().game.discoveries.length).toBe(1)
    // second craft of same combo: no new discovery
    const g2 = structuredClone(useStore.getState().game)
    g2.inventory['ink'] = { qty: 2, price: 40 }
    useStore.getState().setGame(g2)
    expect(useStore.getState().craftWithIngredients('ink', ['banana', 'honey'])).toBeNull()
    finishCrafts(craftDurationHours(2))
    expect(useStore.getState().game.discoveries.length).toBe(1)
    // insufficient ingredient -> blocked
    expect(useStore.getState().craftWithIngredients('ink', ['saffron'])).not.toBeNull()
  })
})

describe('v1 -> v2 save migration', () => {
  it('old save without v2 fields loads with empty-ish ingredients + starter pack, no data loss', () => {
    const g = initialState() as unknown as Record<string, unknown>
    delete g.ingredients; delete g.shopStock; delete g.shopDay; delete g.discoveries; delete g.starterPackGiven
    g.saveVersion = 1; g.cash = 777; g.day = 9
    const back = deserialize(JSON.stringify(g))
    expect(back).not.toBeNull()
    expect(back!.cash).toBe(777)
    expect(back!.day).toBe(9)
    expect(back!.saveVersion).toBe(4)
    expect(back!.craftingQueue).toEqual([])
    expect(back!.ingredients['banana']).toBe(2)
    expect(back!.ingredients['honey']).toBe(2)
    expect(Array.isArray(back!.discoveries)).toBe(true)
    expect(back!.customers.every((c) => !!c.preferredStat)).toBe(true)
  })
  it('v2 save round-trip preserves ingredients and discoveries', () => {
    const g = initialState()
    g.ingredients = { coffee: 5 }
    g.discoveries = [{ key: 'ink|coffee', name: 'تست', baseId: 'ink', ingredientIds: ['coffee'], value: 60, day: 1, stats: { focus: 3 }, synergyNames: [] }]
    const back = deserialize(serialize(g))
    expect(back!.ingredients['coffee']).toBe(5)
    expect(back!.discoveries.length).toBe(1)
  })
})

describe('progression & heat', () => {
  it('fresh game is stage 1', () => {
    expect(currentStage(initialState())).toBe(1)
  })
  it('stage rises with net worth + reputation', () => {
    const g = initialState()
    g.cash = 2000; g.reputation = 15
    expect(currentStage(g)).toBe(2)
    g.cash = 200000; g.reputation = 200
    expect(currentStage(g)).toBe(6)
  })
  it('heat from sale bounded 0..12', () => {
    const g = initialState()
    expect(heatFromSale(g, 100000, 100)).toBeLessThanOrEqual(12)
    expect(heatFromSale(g, 10, 0)).toBeGreaterThanOrEqual(0)
  })
  it('net worth includes inventory value', () => {
    const g = initialState()
    g.ingredients = {}
    g.inventory['ink'] = { qty: 10, price: 40 }
    expect(netWorth(g)).toBe(500 + 400)
  })
})

import { tryGenerateOrder, hasActiveOrder, ensureListing } from './store'
import { quickCraftCheck, signatureOf } from './crafting'
import { loyaltyGainFromDependency, repeatOrderFactor } from './npc'
import { dedupeOrders } from './save'
import { productDependency } from './economy'

describe('v3 stacking', () => {
  it('same ordered combo twice -> one stack qty 2; different order -> separate stack', () => {
    useStore.getState().resetGame()
    const g = structuredClone(useStore.getState().game)
    g.inventory['ink'] = { qty: 10, price: 40 }
    g.ingredients = { banana: 5, honey: 5 }
    g.cash = 1000
    useStore.getState().setGame(g)
    expect(useStore.getState().craftWithIngredients('ink', ['banana', 'honey'])).toBeNull()
    expect(useStore.getState().craftWithIngredients('ink', ['banana', 'honey'])).toBeNull()
    finishCrafts(craftDurationHours(2) * 2) // two sequential jobs
    let after = useStore.getState().game
    expect(after.craftingQueue.length).toBe(0)
    expect(after.specials.length).toBe(1)
    expect(after.specials[0].qty).toBe(2)
    expect(after.inventory[signatureOf('ink', ['banana', 'honey'])].qty).toBe(2)
    expect(after.discoveries.length).toBe(1)
    expect(after.discoveries[0].craftCount).toBe(2)
    // different order = different signature = separate stack
    expect(useStore.getState().craftWithIngredients('ink', ['honey', 'banana'])).toBeNull()
    finishCrafts(craftDurationHours(2))
    after = useStore.getState().game
    expect(after.specials.length).toBe(2)
    expect(after.inventory[signatureOf('ink', ['honey', 'banana'])].qty).toBe(1)
  })
  it('selling decrements stack qty and removes inventory entry at 0', () => {
    useStore.getState().resetGame()
    const g = structuredClone(useStore.getState().game)
    g.inventory['ink'] = { qty: 2, price: 40 }
    g.salesList['ink'] = { listed: true, price: 40 }
    g.orders = [{
      id: 'o-test', customerId: g.customers[0].id, productKey: 'ink', qty: 2,
      offerPrice: 40, maxPrice: 60, createdDay: 1, createdHour: 8, expiresInHours: 48, status: 'open',
    }]
    useStore.getState().setGame(g)
    expect(useStore.getState().acceptOrder('o-test', 40)).toBeNull()
    const after = useStore.getState().game
    expect(after.inventory['ink']).toBeUndefined()
    expect(after.orders.length).toBe(0)
    // listing survives at zero stock (ناموجود) and can reactivate on restock
    expect(after.salesList['ink'].listed).toBe(true)
  })
})

describe('v3 sales list & one active offer per customer per product', () => {
  it('unlisted product generates 0 orders; listed generates orders', () => {
    const g = initialState()
    g.inventory['ink'] = { qty: 20, price: 40 }
    g.salesList['ink'] = { listed: false, price: 40 }
    let created = 0
    for (let i = 0; i < 50; i++) if (tryGenerateOrder(g, () => 0.5)) created++
    expect(created).toBe(0)
    expect(g.orders.length).toBe(0)
    g.salesList['ink'].listed = true
    created = 0
    for (let i = 0; i < 50; i++) if (tryGenerateOrder(g, () => 0.5)) created++
    expect(created).toBeGreaterThan(0)
    expect(g.orders.every((o) => o.productKey === 'ink')).toBe(true)
  })
  it('generator never creates a 2nd active order for same customer+product', () => {
    const g = initialState()
    g.inventory['ink'] = { qty: 50, price: 40 }
    g.salesList['ink'] = { listed: true, price: 40 }
    for (let i = 0; i < 100; i++) tryGenerateOrder(g, () => 0.5)
    const seen = new Set<string>()
    for (const o of g.orders) {
      const k = `${o.customerId}|${o.productKey}`
      expect(seen.has(k)).toBe(false)
      seen.add(k)
    }
    // every unlocked customer can hold at most one 'ink' order; total bounded by customer pool
    expect(g.orders.length).toBeLessThanOrEqual(g.customers.length)
    expect(hasActiveOrder(g, g.orders[0].customerId, 'ink')).toBe(true)
  })
  it('dedupeOrders keeps earliest duplicate', () => {
    const mk = (id: string, day: number) => ({
      id, customerId: 'c1', productKey: 'ink', qty: 1, offerPrice: 10, maxPrice: 20,
      createdDay: day, createdHour: 8, expiresInHours: 48, status: 'open' as const,
    })
    const out = dedupeOrders([mk('new', 3), mk('mid', 2), mk('old', 1)])
    expect(out.length).toBe(1)
    expect(out[0].id).toBe('old')
  })
})

describe('v3 dependency (fictional game stat)', () => {
  it('dependency bounded 0..100 and order affects it', () => {
    const a = computeCraft('ink', ['coffee', 'chocolate', 'sugar', 'caramel'])
    const b = computeCraft('ink', ['cucumber', 'lettuce', 'juice', 'watermelon'])
    expect(a.dependency).toBeGreaterThanOrEqual(0); expect(a.dependency).toBeLessThanOrEqual(100)
    expect(b.dependency).toBeGreaterThanOrEqual(0); expect(b.dependency).toBeLessThanOrEqual(100)
    expect(a.dependency).toBeGreaterThan(b.dependency)
    const ab = computeCraft('ink', ['coffee', 'cucumber'])
    const ba = computeCraft('ink', ['cucumber', 'coffee'])
    expect(ab.dependency).not.toBe(ba.dependency)
    // every ingredient carries a dependency value
    expect(INGREDIENTS.every((i) => typeof i.buffs.dependency === 'number')).toBe(true)
    // at least 20 synergy rules affect dependency
    expect(SYNERGIES.filter((s) => typeof s.effects.dependency === 'number').length).toBeGreaterThanOrEqual(20)
  })
  it('high dependency increases repeat factor and loyalty gain', () => {
    const lo = cust({ lastDependency: 10 })
    const hi = cust({ lastDependency: 90 })
    expect(repeatOrderFactor(hi)).toBeGreaterThan(repeatOrderFactor(lo))
    expect(loyaltyGainFromDependency(90)).toBeGreaterThan(loyaltyGainFromDependency(10))
    expect(loyaltyGainFromDependency(0)).toBe(0)
  })
  it('base products have modest default dependency', () => {
    const g = initialState()
    expect(productDependency(g, 'ink')).toBeGreaterThanOrEqual(15)
    expect(productDependency(g, 'ink')).toBeLessThanOrEqual(40)
  })
})

describe('v3 quick craft eligibility', () => {
  it('sufficient stock -> ok, consumes and stacks; insufficient -> blocked with missing list', () => {
    useStore.getState().resetGame()
    const g = structuredClone(useStore.getState().game)
    g.inventory['ink'] = { qty: 3, price: 40 }
    g.ingredients = { banana: 1, honey: 1 }
    g.cash = 1000
    useStore.getState().setGame(g)
    // insufficient (needs banana x2 via duplicate slot)
    const bad = quickCraftCheck(useStore.getState().game, 'ink', ['banana', 'banana'])
    expect(bad.ok).toBe(false)
    expect(bad.missing.join(' ')).toContain('موز')
    // sufficient
    const good = quickCraftCheck(useStore.getState().game, 'ink', ['banana', 'honey'])
    expect(good.ok).toBe(true)
    expect(good.cost).toBe(0) // v4: free
    expect(useStore.getState().craftWithIngredients('ink', ['banana', 'honey'])).toBeNull()
    expect(useStore.getState().game.craftingQueue.length).toBe(1) // v4: queued, not instant
    finishCrafts(craftDurationHours(2))
    const after = useStore.getState().game
    expect(after.ingredients['banana'] ?? 0).toBe(0)
    expect(after.inventory[signatureOf('ink', ['banana', 'honey'])].qty).toBe(1)
  })
  it('already-discovered combo gets no second discovery reward', () => {
    useStore.getState().resetGame()
    const g = structuredClone(useStore.getState().game)
    g.inventory['ink'] = { qty: 5, price: 40 }
    g.ingredients = { banana: 4, honey: 4 }
    g.cash = 1000
    useStore.getState().setGame(g)
    expect(useStore.getState().craftWithIngredients('ink', ['banana', 'honey'])).toBeNull()
    finishCrafts(craftDurationHours(2))
    const cashAfterFirst = useStore.getState().game.cash
    const repAfterFirst = useStore.getState().game.reputation
    expect(cashAfterFirst).toBe(1000 + 50) // free craft + discovery reward at completion
    expect(useStore.getState().craftWithIngredients('ink', ['banana', 'honey'])).toBeNull()
    finishCrafts(craftDurationHours(2))
    const after = useStore.getState().game
    // v4: second craft is FREE and gets no second +50 discovery reward
    expect(after.cash).toBe(cashAfterFirst)
    // reputation: +2 per completed craft, no extra +3 discovery bonus
    expect(after.reputation).toBe(repAfterFirst + 2)
    expect(after.discoveries.length).toBe(1)
  })
})

describe('v2 -> v3 save migration', () => {
  it('merges duplicate specials into one stack, defaults listings, dedupes orders, no data loss', () => {
    const g = initialState() as unknown as Record<string, unknown>
    g.saveVersion = 2; g.cash = 555; g.day = 4
    delete g.salesList
    const sp = (id: string) => ({
      id, name: 'تست ویژه', baseId: 'ink', modifierIds: [], ingredientIds: ['banana', 'honey'],
      stats: { power: 5 }, comboKey: 'ink|banana>honey', quality: 60, rarity: 3, popularity: 50,
      value: 76, color: '#facc15', desc: 'تست', createdDay: 1,
    })
    g.specials = [sp('sp-old-1'), sp('sp-old-2')]
    g.inventory = { 'sp-old-1': { qty: 1, price: 76 }, 'sp-old-2': { qty: 1, price: 76 }, ink: { qty: 3, price: 40 } }
    const ord = (id: string, day: number, key: string) => ({
      id, customerId: 'c1', productKey: key, qty: 1, offerPrice: 50, maxPrice: 80,
      createdDay: day, createdHour: 8, expiresInHours: 48, status: 'open',
    })
    g.orders = [ord('o-new', 3, 'sp-old-1'), ord('o-old', 1, 'sp-old-2')]
    const back = deserialize(JSON.stringify(g))
    expect(back).not.toBeNull()
    expect(back!.saveVersion).toBe(4)
    expect(back!.craftingQueue).toEqual([])
    expect(back!.cash).toBe(555)
    expect(back!.specials.length).toBe(1)
    expect(back!.specials[0].qty).toBe(2)
    expect(back!.specials[0].signature).toBe('ink|banana>honey')
    expect(typeof back!.specials[0].dependency).toBe('number')
    expect(back!.inventory['ink|banana>honey'].qty).toBe(2)
    expect(back!.inventory['ink'].qty).toBe(3)
    expect(back!.salesList['ink|banana>honey'].listed).toBe(true)
    expect(back!.salesList['ink'].listed).toBe(true)
    expect(back!.salesList['ink'].price).toBe(40)
    // duplicate active orders for same customer+product collapsed to earliest, remapped to signature
    expect(back!.orders.length).toBe(1)
    expect(back!.orders[0].id).toBe('o-old')
    expect(back!.orders[0].productKey).toBe('ink|banana>honey')
    expect(back!.customers.every((c) => !!c.dependencyPreference)).toBe(true)
  })
  it('v3 save round-trip preserves sales list and stacks', () => {
    const g = initialState()
    g.inventory['ink'] = { qty: 4, price: 55 }
    ensureListing(g, 'ink', 55)
    g.salesList['ink'].listed = false
    const back = deserialize(serialize(g))
    expect(back!.salesList['ink'].listed).toBe(false)
    expect(back!.salesList['ink'].price).toBe(55)
    expect(back!.inventory['ink'].qty).toBe(4)
  })
})

describe('v4 free-but-timed crafting queue', () => {
  const setup = () => {
    useStore.getState().resetGame()
    const g = structuredClone(useStore.getState().game)
    g.inventory['ink'] = { qty: 20, price: 40 }
    g.ingredients = { banana: 10, honey: 10, coffee: 10, mint: 10 }
    g.cash = 0 // crafting must work with zero cash
    useStore.getState().setGame(g)
  }

  it('craft cost is 0 everywhere (no cash change, no ledger entry)', () => {
    expect(craftCostV2(['banana', 'honey'])).toBe(0)
    expect(craftCost('ink', ['shiny'])).toBe(0)
    setup()
    const before = useStore.getState().game
    expect(useStore.getState().craftWithIngredients('ink', ['banana'])).toBeNull()
    const after = useStore.getState().game
    expect(after.cash).toBe(before.cash)
    expect(after.ledger.length).toBe(before.ledger.length)
    // quick-craft check also free even with 0 cash
    const chk = quickCraftCheck(after, 'ink', ['banana'])
    expect(chk.cost).toBe(0)
    expect(chk.ok).toBe(true)
  })

  it('duration formula: 1 + slots (1 ingredient = 2h, 4 = 5h)', () => {
    expect(craftDurationHours(1)).toBe(2)
    expect(craftDurationHours(2)).toBe(3)
    expect(craftDurationHours(4)).toBe(5)
  })

  it('craft creates a job, completes after exactly its duration', () => {
    setup()
    expect(useStore.getState().craftWithIngredients('ink', ['banana', 'honey', 'coffee'])).toBeNull()
    let g = useStore.getState().game
    expect(g.craftingQueue.length).toBe(1)
    expect(g.craftingQueue[0].totalHours).toBe(4)
    expect(g.specials.length).toBe(0)
    finishCrafts(3) // one hour short
    g = useStore.getState().game
    expect(g.craftingQueue.length).toBe(1)
    expect(g.craftingQueue[0].remainingHours).toBe(1)
    expect(g.specials.length).toBe(0)
    expect(g.discoveries.length).toBe(0) // discovery only at completion
    finishCrafts(1)
    g = useStore.getState().game
    expect(g.craftingQueue.length).toBe(0)
    expect(g.specials.length).toBe(1)
    expect(g.inventory[signatureOf('ink', ['banana', 'honey', 'coffee'])].qty).toBe(1)
    expect(g.discoveries.length).toBe(1)
    expect(g.stats.crafts).toBe(1)
    expect(g.cash).toBe(50) // discovery reward at completion
    expect(g.eventLog.some((e) => e.text.includes('ترکیب آماده شد'))).toBe(true)
  })

  it('tick() advances the queue by one game-hour', () => {
    setup()
    expect(useStore.getState().craftWithIngredients('ink', ['banana'])).toBeNull()
    useStore.getState().tick()
    expect(useStore.getState().game.craftingQueue[0].remainingHours).toBe(1)
    useStore.getState().tick()
    const g = useStore.getState().game
    expect(g.craftingQueue.length).toBe(0)
    expect(g.specials.length).toBe(1)
  })

  it('cancel refunds base + ingredients fully', () => {
    setup()
    expect(useStore.getState().craftWithIngredients('ink', ['banana', 'banana', 'honey'])).toBeNull()
    let g = useStore.getState().game
    expect(g.inventory['ink'].qty).toBe(19)
    expect(g.ingredients['banana']).toBe(8)
    expect(g.ingredients['honey']).toBe(9)
    useStore.getState().cancelCrafting(g.craftingQueue[0].id)
    g = useStore.getState().game
    expect(g.craftingQueue.length).toBe(0)
    expect(g.inventory['ink'].qty).toBe(20)
    expect(g.ingredients['banana']).toBe(10)
    expect(g.ingredients['honey']).toBe(10)
  })

  it('queue cap enforced (max 5)', () => {
    setup()
    for (let i = 0; i < CRAFT_QUEUE_MAX; i++) {
      expect(useStore.getState().craftWithIngredients('ink', ['banana'])).toBeNull()
    }
    const err = useStore.getState().craftWithIngredients('ink', ['banana'])
    expect(err).not.toBeNull()
    expect(err).toContain('صف ساخت پر است')
    expect(useStore.getState().game.craftingQueue.length).toBe(CRAFT_QUEUE_MAX)
  })

  it('sequential: second job does not progress until first completes', () => {
    setup()
    expect(useStore.getState().craftWithIngredients('ink', ['banana', 'honey', 'coffee', 'mint'])).toBeNull() // 5h
    expect(useStore.getState().craftWithIngredients('ink', ['banana'])).toBeNull() // 2h
    finishCrafts(3)
    let g = useStore.getState().game
    expect(g.craftingQueue.length).toBe(2)
    expect(g.craftingQueue[0].remainingHours).toBe(2)
    expect(g.craftingQueue[1].remainingHours).toBe(2) // untouched
    finishCrafts(2) // first completes exactly
    g = useStore.getState().game
    expect(g.craftingQueue.length).toBe(1)
    expect(g.craftingQueue[0].remainingHours).toBe(2)
    expect(g.specials.length).toBe(1)
    finishCrafts(2)
    g = useStore.getState().game
    expect(g.craftingQueue.length).toBe(0)
    expect(g.specials.length).toBe(2)
  })

  it('offline-style advance: 8h cap completes queued jobs in order', () => {
    setup()
    expect(useStore.getState().craftWithIngredients('ink', ['banana', 'honey'])).toBeNull() // 3h
    expect(useStore.getState().craftWithIngredients('ink', ['coffee'])).toBeNull() // 2h
    expect(useStore.getState().craftWithIngredients('ink', ['mint', 'banana', 'honey', 'coffee'])).toBeNull() // 5h
    const g = structuredClone(useStore.getState().game)
    advanceCrafting(g, 8) // same call App.applyOfflineProgress makes with the 8h cap
    expect(g.specials.length).toBe(2)
    expect(g.craftingQueue.length).toBe(1)
    expect(g.craftingQueue[0].remainingHours).toBe(2)
  })

  it('legacy modifier craft is also free + queued', () => {
    setup()
    const cash0 = useStore.getState().game.cash
    expect(useStore.getState().craft('ink', ['shiny'])).toBeNull()
    let g = useStore.getState().game
    expect(g.cash).toBe(cash0)
    expect(g.craftingQueue.length).toBe(1)
    expect(g.inventory['ink'].qty).toBe(18) // 2 base consumed
    finishCrafts(craftDurationHours(1))
    g = useStore.getState().game
    expect(g.specials.length).toBe(1)
    expect(g.craftingQueue.length).toBe(0)
  })

  it('v3 -> v4 migration: empty queue, no data loss; v4 round-trip preserves queue', () => {
    const g = initialState() as unknown as Record<string, unknown>
    g.saveVersion = 3; g.cash = 321; g.day = 6
    delete g.craftingQueue
    const back = deserialize(JSON.stringify(g))
    expect(back).not.toBeNull()
    expect(back!.saveVersion).toBe(4)
    expect(back!.cash).toBe(321)
    expect(back!.craftingQueue).toEqual([])
    // round-trip with a live job
    const g2 = initialState()
    g2.craftingQueue = [{
      id: 'c-test', baseId: 'ink', baseQty: 1, ingredientIds: ['banana', 'honey'], modifierIds: [],
      signature: 'ink|banana>honey', name: 'تست', totalHours: 3, remainingHours: 2, createdDay: 1,
    }]
    const back2 = deserialize(serialize(g2))
    expect(back2!.craftingQueue.length).toBe(1)
    expect(back2!.craftingQueue[0].remainingHours).toBe(2)
    expect(back2!.craftingQueue[0].ingredientIds).toEqual(['banana', 'honey'])
    expect(back2!.saveVersion).toBe(4)
  })
})

import { MISSIONS } from './data'
import { priceDemandFactor } from './npc'
import { netWorth as nwOf } from './economy'

const mulberry32 = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

describe('v4 economy rebalance simulation (deterministic)', () => {
  it('30 game-days of basic play: profitable but not rich fast', () => {
    const origRandom = Math.random
    Math.random = mulberry32(1405)
    try {
      useStore.getState().resetGame()
      let nwDay7 = 0
      let nwDay30 = 0
      let maxCashFirst2Days = 0
      for (let day = 1; day <= 30; day++) {
        const st = useStore.getState()
        const g0 = st.game
        if (g0.cash > 250) { st.buyIngredient('banana', 3); st.buyIngredient('honey', 3) }
        if (useStore.getState().game.productionQueue.length === 0 && useStore.getState().game.cash > 200) {
          st.startProduction('ink', 6)
        }
        const g1 = useStore.getState().game
        if (g1.craftingQueue.length < 2 && (g1.inventory['ink']?.qty ?? 0) >= 1 && (g1.ingredients['banana'] ?? 0) >= 1 && (g1.ingredients['honey'] ?? 0) >= 1) {
          st.craftWithIngredients('ink', ['banana', 'honey'])
        }
        for (let h = 0; h < 24; h++) {
          useStore.getState().tick()
          const gg = useStore.getState().game
          if (day <= 2) maxCashFirst2Days = Math.max(maxCashFirst2Days, gg.cash)
          for (const o of [...gg.orders]) useStore.getState().acceptOrder(o.id, o.maxPrice)
        }
        for (const m of MISSIONS) useStore.getState().claimMission(m.id)
        const nw = nwOf(useStore.getState().game)
        if (day === 7) nwDay7 = nw
        if (day === 30) nwDay30 = nw
      }
      // pacing gates from the rebalance spec
      expect(nwDay7).toBeLessThan(3000)
      expect(nwDay30).toBeLessThan(25000)
      expect(nwDay30).toBeGreaterThan(500) // still profitable, no death spiral
      expect(maxCashFirst2Days).toBeLessThan(1500) // district 2 (1,500) not affordable before day 3
    } finally {
      Math.random = origRandom
    }
  })

  it('overpricing kills orders: 200% price ≈ 0 orders vs 100% price > 0', () => {
    expect(priceDemandFactor(1)).toBe(1)
    expect(priceDemandFactor(1.2)).toBeCloseTo(0.55, 5)
    expect(priceDemandFactor(1.5)).toBeCloseTo(0.15, 5)
    expect(priceDemandFactor(2)).toBeLessThanOrEqual(0.02)
    const countOrders = (price: number) => {
      const g = initialState()
      g.inventory['ink'] = { qty: 100, price }
      g.salesList['ink'] = { listed: true, price }
      const rng = mulberry32(7)
      let created = 0
      for (let i = 0; i < 200; i++) {
        g.orders = [] // measure per-call probability, not the per-customer cap
        if (tryGenerateOrder(g, rng)) created++
      }
      return created
    }
    const atMarket = countOrders(40) // ink market value = 40
    const atDouble = countOrders(80) // 200%
    expect(atMarket).toBeGreaterThan(30)
    expect(atDouble).toBeLessThanOrEqual(10)
    expect(atDouble).toBeLessThan(atMarket * 0.2)
  })

  it('crafted value never exceeds 3x input cost', () => {
    for (const combo of [['banana', 'honey'], ['coffee', 'chocolate', 'sugar', 'caramel'], ['saffron', 'pistachio', 'vanilla', 'honey']]) {
      const r = computeCraft('ink', combo)
      const input = 20 + combo.reduce((a, id) => a + (ingredientById(id)?.basePrice ?? 0), 0)
      expect(r.value).toBeLessThanOrEqual(input * 3)
      expect(r.value).toBeGreaterThan(0)
    }
  })
})
