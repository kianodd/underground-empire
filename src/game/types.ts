export type Personality = 'loyal' | 'picky' | 'wealthy' | 'unreliable' | 'stranger' | 'normal'

export interface ProductDef {
  id: string
  name: string
  category: string
  baseValue: number
  rarity: number // 1-5
  demand: number // 0-100 base demand
  prodCost: number // abstract cost per unit
  prodHours: number // abstract timer per batch unit
  unlockStage: number
  color: string
  desc: string
  dependency?: number // v3: fictional game stat 0-100 («وابستگی مشتری» در بازی)
}

export interface ModifierDef {
  id: string
  name: string
  valueMult: number
  qualityBonus: number
  rarityBonus: number
  popularity: number // 0-100
  craftCost: number
  unlockStage: number
  color: string
}

export interface SpecialProduct {
  id: string
  name: string
  baseId: string
  modifierIds: string[]
  ingredientIds?: string[] // v2: ordered ingredient ids
  stats?: Record<string, number> // v2: fictional game stats
  comboKey?: string
  signature?: string // v3: deterministic stack signature (= comboKey for v2 crafts)
  qty?: number // v3: stack quantity
  dependency?: number // v3: fictional game stat 0-100
  quality: number // 0-100
  rarity: number // 1-10
  popularity: number // 0-100
  value: number
  color: string
  desc: string
  createdDay: number
}

export interface Discovery {
  key: string
  name: string
  baseId: string
  ingredientIds: string[]
  value: number
  day: number
  stats: Record<string, number>
  synergyNames: string[]
  craftCount?: number // v3: times this combo was crafted
}

export interface SalesEntry {
  listed: boolean
  price: number // player-set sale price per unit
}

export interface InvItem {
  qty: number
  price: number // player-set unit price
}

export interface TxRecord {
  day: number
  hour: number
  productName: string
  qty: number
  unitPrice: number
  total: number
  profit: number
}

export interface Customer {
  id: string
  name: string
  age: number
  personality: Personality
  trust: number // 0-100
  buyingPower: number // max total spend per order
  loyalty: number // 0-100
  priceSensitivity: number // 0-1
  taste: string // modifier id or 'any'
  preferredStat?: string // v2: fictional game stat this customer likes
  dependencyPreference?: 'low' | 'mid' | 'high' // v3: fictional game preference
  lastDependency?: number // v3: dependency of last purchased product
  lastPurchaseDay?: number
  highDepStreak?: number // v3: consecutive very-high-dependency purchases
  restUntilDay?: number // v3: no orders while day <= this («در استراحت»)
  risk: number // 0-100
  satisfaction: number // 0-100
  districtId: string
  unlockStage: number
  history: TxRecord[]
  totalProfit: number
  deals: number
}

export interface Order {
  id: string
  customerId: string
  productKey: string // base product id or special id
  qty: number
  offerPrice: number // per unit offered by customer
  maxPrice: number // per unit ceiling (hidden-ish, shown as hint range)
  createdDay: number
  createdHour: number
  expiresInHours: number
  status: 'open' | 'done' | 'expired' | 'rejected'
}

export interface Staff {
  id: string
  name: string
  wage: number // per day
  skill: number // 0-100
  loyalty: number // 0-100
  hireCost: number
  hired: boolean
  level: number
  autoSales: number
}

export interface District {
  id: string
  name: string
  economy: number // 0-100
  buyingPower: number // multiplier-ish 0-100
  competition: number // 0-100
  surveillance: number // 0-100
  rent: number // per day
  unlockCost: number
  unlockStage: number
  unlocked: boolean
  desc: string
  color: string
}

export interface Rival {
  id: string
  name: string
  capital: number
  reputation: number
  marketShare: number // 0-100
  districtId: string
  personality: string
  growth: number // per day drift
}

export interface LedgerEntry {
  id: string
  day: number
  hour: number
  kind: 'income' | 'expense'
  amount: number
  desc: string
}

export interface CraftingJob {
  id: string
  baseId: string
  baseQty: number // base units consumed at start (1 for ingredient crafting, 2 for legacy modifier crafting)
  ingredientIds: string[] // v4: ordered ingredients (empty for legacy modifier jobs)
  modifierIds: string[] // v4: legacy modifier ids (empty for ingredient jobs)
  signature: string
  name: string // predicted product name
  totalHours: number
  remainingHours: number
  createdDay: number
}

export interface ProductionJob {
  id: string
  productId: string
  qty: number
  hoursLeft: number
  totalHours: number
  quality: number
}

export interface EventEntry {
  id: string
  day: number
  hour: number
  text: string
  kind: 'info' | 'warn' | 'good' | 'bad'
}

export interface MissionDef {
  id: string
  title: string
  desc: string
  kind: 'daily' | 'story'
  metric: 'income' | 'deals' | 'customers' | 'crafts' | 'hires' | 'districts' | 'reputation' | 'networth'
  target: number
  reward: number
}

export interface MissionState {
  defId: string
  claimed: boolean
  baseline: number // metric value at mission start (for daily)
}

export interface Upgrades {
  capacity: number
  quality: number
  storage: number
  riskMgmt: number
  marketing: number
}

export interface GameState {
  saveVersion: number
  cash: number
  reputation: number
  day: number
  hour: number
  speed: 0 | 1 | 3
  heat: number
  salesPausedUntilDay: number // 0 = not paused
  inventory: Record<string, InvItem>
  salesList: Record<string, SalesEntry> // v3: player-controlled sales list by productKey
  ingredients: Record<string, number> // v2: ingredient warehouse counts
  shopStock: Record<string, number> // v2: today's shop stock
  shopDay: number // v2: day shopStock was generated for
  discoveries: Discovery[] // v2: discovered ordered combos
  starterPackGiven: boolean // v2
  specials: SpecialProduct[]
  customers: Customer[]
  orders: Order[]
  staff: Staff[]
  districts: District[]
  rivals: Rival[]
  ledger: LedgerEntry[]
  productionQueue: ProductionJob[]
  craftingQueue: CraftingJob[] // v4: sequential free-but-timed crafting queue (max 5)
  upgrades: Upgrades
  missions: MissionState[]
  eventLog: EventEntry[]
  stats: {
    totalIncome: number
    totalExpense: number
    deals: number
    crafts: number
    hires: number
    customersServed: string[]
  }
  demandSpike: { modifierId: string; untilDay: number; mult: number } | null
  costMult: { untilDay: number; mult: number } | null
  settings: { sound: boolean }
  lastSavedAt: number
  startedAtDay: number
}

export const SAVE_VERSION = 4

export const STAGES = [
  { stage: 1, name: 'تازه‌کار', netWorth: 0, reputation: 0 },
  { stage: 2, name: 'فروشنده محلی', netWorth: 1500, reputation: 10 },
  { stage: 3, name: 'صاحب شبکه کوچک', netWorth: 6000, reputation: 30 },
  { stage: 4, name: 'مدیر منطقه', netWorth: 20000, reputation: 60 },
  { stage: 5, name: 'رئیس شبکه شهری', netWorth: 60000, reputation: 110 },
  { stage: 6, name: 'امپراتور زیرزمینی', netWorth: 150000, reputation: 180 },
] as const
