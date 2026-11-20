import { clamp } from './economy'
import type { Customer } from './types'

export interface NegotiationResult {
  outcome: 'accept' | 'counter' | 'reject'
  price: number // agreed or counter-back price per unit
  acceptProb: number
}

/**
 * Probability the customer accepts player's counter price.
 * Monotonic: higher price -> lower probability. Bounded 0..1.
 */
export function acceptProbability(customer: Customer, counterPrice: number, offerPrice: number, maxPrice: number): number {
  if (counterPrice <= offerPrice) return 1
  if (counterPrice > maxPrice * 1.6) return 0
  const ratio = (counterPrice - offerPrice) / Math.max(1, maxPrice - offerPrice)
  const trustBonus = (customer.trust - 50) / 200 // -0.25..0.25
  const loyaltyBonus = (customer.loyalty - 50) / 400
  const sens = customer.priceSensitivity
  let p = 1 - ratio * (0.5 + sens * 0.9) + trustBonus + loyaltyBonus
  if (customer.personality === 'wealthy') p += 0.15
  if (customer.personality === 'picky') p -= 0.15
  if (customer.personality === 'stranger') p -= 0.1
  return clamp(p, 0, 1)
}

export function negotiate(customer: Customer, counterPrice: number, offerPrice: number, maxPrice: number, rng: () => number = Math.random): NegotiationResult {
  const p = acceptProbability(customer, counterPrice, offerPrice, maxPrice)
  const roll = rng()
  if (roll < p) return { outcome: 'accept', price: counterPrice, acceptProb: p }
  // counter-back if price is within reach
  if (counterPrice <= maxPrice * 1.25 && roll < p + 0.45) {
    const meet = Math.round((counterPrice + offerPrice) / 2)
    return { outcome: 'counter', price: Math.max(offerPrice, meet), acceptProb: p }
  }
  return { outcome: 'reject', price: offerPrice, acceptProb: p }
}

export function customerMaxPrice(customer: Customer, baseValue: number, tasteMatch: boolean): number {
  // v4 rebalance: acceptable price anchored to MARKET value, modest premiums only.
  let mult = 1.05 + (customer.buyingPower / 8000) * 0.2
  if (customer.personality === 'wealthy') mult += 0.3
  if (customer.personality === 'picky') mult -= 0.1
  if (tasteMatch) mult += 0.15
  mult += (customer.trust - 50) / 500
  return Math.max(1, Math.round(baseValue * clamp(mult, 0.8, 1.5)))
}

/**
 * v4: how likely an order is at a given player-price / market-value ratio.
 * 100% -> 1, 120% -> ~0.55, 150% -> ~0.15, 200% -> ~0.01 (almost no orders).
 */
export function priceDemandFactor(ratio: number): number {
  if (ratio <= 1) return 1
  if (ratio <= 1.2) return 1 - (ratio - 1) * 2.25
  if (ratio <= 1.5) return 0.55 - (ratio - 1.2) * (0.4 / 0.3)
  if (ratio <= 2) return Math.max(0.01, 0.15 - (ratio - 1.5) * 0.28)
  return 0.01
}

export function customerOfferPrice(customer: Customer, maxPrice: number, rng: () => number = Math.random): number {
  const frac = customer.personality === 'picky' ? 0.55 + rng() * 0.15 : customer.personality === 'wealthy' ? 0.8 + rng() * 0.15 : 0.65 + rng() * 0.2
  return Math.max(1, Math.round(maxPrice * frac))
}

/** v3: repeat-order weight from last purchased product's dependency (fictional game stat). */
export function repeatOrderFactor(customer: Customer): number {
  const dep = customer.lastDependency ?? 0
  return 1 + dep / 100 // 1.0 .. 2.0
}

export function dependencyBand(dep: number): 'low' | 'mid' | 'high' {
  return dep < 35 ? 'low' : dep <= 65 ? 'mid' : 'high'
}

/** How well a product dependency fits the customer's preference: 0..1 (1 = perfect). */
export function dependencyFit(customer: Customer, dep: number): number {
  const pref = customer.dependencyPreference ?? 'mid'
  const band = dependencyBand(dep)
  if (pref === band) return 1
  const order = ['low', 'mid', 'high']
  return Math.abs(order.indexOf(pref) - order.indexOf(band)) === 1 ? 0.6 : 0.3
}

/** Extra loyalty gain (game points) from buying a product with this dependency. */
export function loyaltyGainFromDependency(dep: number): number {
  return Math.round(dep / 25) // 0..4
}
