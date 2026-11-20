import { PRODUCTS } from './data'
import { clamp } from './economy'

export type GameStat = 'power' | 'focus' | 'speed' | 'calm' | 'popularity' | 'durability' | 'glow' | 'quality' | 'dependency'

export const STAT_LABEL: Record<GameStat, string> = {
  power: 'قدرت', focus: 'تمرکز', speed: 'سرعت', calm: 'آرامش',
  popularity: 'محبوبیت', durability: 'ماندگاری', glow: 'درخشش', quality: 'کیفیت', dependency: 'وابستگی',
}
export const STAT_KEYS = Object.keys(STAT_LABEL) as GameStat[]

export type IngredientCategory = 'میوه‌ها' | 'طعم و شیرینی' | 'نوشیدنی‌ها' | 'خشکبار و خوراکی' | 'ادویه و آشپزخانه' | 'تازه‌ها'
export const INGREDIENT_CATEGORIES: IngredientCategory[] = ['میوه‌ها', 'طعم و شیرینی', 'نوشیدنی‌ها', 'خشکبار و خوراکی', 'ادویه و آشپزخانه', 'تازه‌ها']

export interface IngredientDef {
  id: string
  name: string
  category: IngredientCategory
  basePrice: number
  rarity: 'معمولی' | 'کمیاب' | 'نادر'
  stockBase: number
  color: string
  buffs: Partial<Record<GameStat, number>>
}

const I = (id: string, name: string, category: IngredientCategory, basePrice: number, rarity: IngredientDef['rarity'], color: string, buffs: IngredientDef['buffs']): IngredientDef => ({
  id, name, category, basePrice, rarity, color, buffs,
  stockBase: rarity === 'نادر' ? 4 : rarity === 'کمیاب' ? 10 : 25,
})

export const INGREDIENTS: IngredientDef[] = [
  // میوه‌ها
  I('banana', 'موز', 'میوه‌ها', 8, 'معمولی', '#facc15', { power: 3, popularity: 1, dependency: 4}),
  I('apple', 'سیب', 'میوه‌ها', 7, 'معمولی', '#f87171', { quality: 2, durability: 1, dependency: 1}),
  I('mango', 'انبه', 'میوه‌ها', 18, 'کمیاب', '#fb923c', { glow: 3, popularity: 2, dependency: 3}),
  I('lemon', 'لیمو', 'میوه‌ها', 6, 'معمولی', '#fde68a', { focus: 2, speed: 1, calm: -1, dependency: 0}),
  I('orange', 'پرتقال', 'میوه‌ها', 8, 'معمولی', '#fb923c', { speed: 2, popularity: 1, dependency: 2}),
  I('strawberry', 'توت‌فرنگی', 'میوه‌ها', 20, 'کمیاب', '#f472b6', { popularity: 3, glow: 2, dependency: 4}),
  I('pineapple', 'آناناس', 'میوه‌ها', 24, 'کمیاب', '#facc15', { power: 2, speed: 2, calm: -1, dependency: 3}),
  I('watermelon', 'هندوانه', 'میوه‌ها', 10, 'معمولی', '#34d399', { calm: 2, durability: 1, dependency: -3}),
  I('grape', 'انگور', 'میوه‌ها', 13, 'معمولی', '#a855f7', { popularity: 2, quality: 1, dependency: 3}),
  I('kiwi', 'کیوی', 'میوه‌ها', 17, 'کمیاب', '#84cc16', { focus: 3, glow: 1, dependency: 0}),
  // طعم و شیرینی
  I('honey', 'عسل', 'طعم و شیرینی', 22, 'کمیاب', '#f59e0b', { durability: 3, popularity: 2, dependency: 6}),
  I('chocolate', 'شکلات', 'طعم و شیرینی', 14, 'معمولی', '#92400e', { popularity: 3, power: 1, dependency: 8}),
  I('mint', 'نعناع', 'طعم و شیرینی', 5, 'معمولی', '#34d399', { focus: 2, calm: 1, dependency: -1}),
  I('cinnamon', 'دارچین', 'طعم و شیرینی', 11, 'معمولی', '#b45309', { glow: 2, power: 1, calm: -1, dependency: 3}),
  I('vanilla', 'وانیل', 'طعم و شیرینی', 38, 'نادر', '#fef3c7', { quality: 3, popularity: 2, dependency: 4}),
  I('caramel', 'کارامل', 'طعم و شیرینی', 12, 'معمولی', '#d97706', { popularity: 2, durability: 1, dependency: 8}),
  I('sugar', 'شکر', 'طعم و شیرینی', 6, 'معمولی', '#e5e7eb', { speed: 2, quality: -1, dependency: 9}),
  I('jam', 'مربا', 'طعم و شیرینی', 9, 'معمولی', '#e11d48', { popularity: 1, durability: 2, dependency: 5}),
  I('rosewater', 'گلاب', 'طعم و شیرینی', 20, 'کمیاب', '#fbcfe8', { calm: 3, glow: 1, dependency: -2}),
  // نوشیدنی‌ها
  I('coffee', 'قهوه', 'نوشیدنی‌ها', 12, 'معمولی', '#78350f', { focus: 3, speed: 2, calm: -2, dependency: 10}),
  I('greentea', 'چای سبز', 'نوشیدنی‌ها', 10, 'معمولی', '#4ade80', { calm: 2, focus: 2, dependency: 3}),
  I('blacktea', 'چای سیاه', 'نوشیدنی‌ها', 8, 'معمولی', '#7c2d12', { focus: 1, durability: 2, dependency: 6}),
  I('cocoa', 'کاکائو', 'نوشیدنی‌ها', 11, 'معمولی', '#5b3a29', { power: 2, popularity: 1, dependency: 6}),
  I('milk', 'شیر', 'نوشیدنی‌ها', 6, 'معمولی', '#f8fafc', { quality: 2, calm: 1, dependency: 1}),
  I('juice', 'آب‌میوه', 'نوشیدنی‌ها', 9, 'معمولی', '#fdba74', { speed: 1, popularity: 2, dependency: -3}),
  I('soda', 'نوشابه', 'نوشیدنی‌ها', 7, 'معمولی', '#38bdf8', { speed: 3, quality: -2, dependency: 7}),
  I('doogh', 'دوغ', 'نوشیدنی‌ها', 6, 'معمولی', '#e2e8f0', { calm: 2, quality: 1, dependency: -2}),
  // خشکبار و خوراکی
  I('almond', 'بادام', 'خشکبار و خوراکی', 24, 'کمیاب', '#d6a05a', { quality: 2, power: 2, dependency: 2}),
  I('walnut', 'گردو', 'خشکبار و خوراکی', 23, 'کمیاب', '#8b5a2b', { focus: 2, durability: 2, dependency: 1}),
  I('date', 'خرما', 'خشکبار و خوراکی', 9, 'معمولی', '#7c3f21', { power: 2, durability: 1, dependency: 5}),
  I('raisin', 'کشمش', 'خشکبار و خوراکی', 8, 'معمولی', '#6d28d9', { durability: 2, speed: 1, dependency: 3}),
  I('hazelnut', 'فندق', 'خشکبار و خوراکی', 26, 'کمیاب', '#a16207', { quality: 3, glow: 1, dependency: 3}),
  I('pistachio', 'پسته', 'خشکبار و خوراکی', 45, 'نادر', '#65a30d', { quality: 3, popularity: 3, dependency: 4}),
  I('fig', 'انجیر خشک', 'خشکبار و خوراکی', 14, 'معمولی', '#7e22ce', { durability: 3, calm: 1, dependency: 3}),
  I('peanut', 'بادام‌زمینی', 'خشکبار و خوراکی', 7, 'معمولی', '#ca8a04', { power: 2, popularity: -1, dependency: 3}),
  // ادویه و آشپزخانه
  I('ginger', 'زنجبیل', 'ادویه و آشپزخانه', 10, 'معمولی', '#fbbf24', { power: 2, speed: 1, calm: -1, dependency: 3}),
  I('pepper', 'فلفل', 'ادویه و آشپزخانه', 6, 'معمولی', '#dc2626', { power: 4, calm: -2, popularity: -1, dependency: 5}),
  I('salt', 'نمک', 'ادویه و آشپزخانه', 5, 'معمولی', '#f1f5f9', { durability: 2, popularity: -1, dependency: 2}),
  I('saffron', 'زعفران', 'ادویه و آشپزخانه', 65, 'نادر', '#f97316', { glow: 4, quality: 3, popularity: 2, dependency: 4}),
  I('cardamom', 'هل', 'ادویه و آشپزخانه', 40, 'نادر', '#a3e635', { quality: 2, calm: 2, glow: 1, dependency: 2}),
  I('turmeric', 'زردچوبه', 'ادویه و آشپزخانه', 7, 'معمولی', '#eab308', { glow: 2, durability: 1, dependency: 0}),
  I('garlic', 'سیر', 'ادویه و آشپزخانه', 5, 'معمولی', '#e7e5e4', { power: 2, popularity: -2, dependency: 1}),
  I('vinegar', 'سرکه', 'ادویه و آشپزخانه', 6, 'معمولی', '#cbd5e1', { durability: 2, popularity: -2, quality: -1, dependency: -4}),
  I('oliveoil', 'روغن زیتون', 'ادویه و آشپزخانه', 15, 'معمولی', '#84cc16', { quality: 2, durability: 1, dependency: 0}),
  // تازه‌ها
  I('basil', 'ریحان', 'تازه‌ها', 5, 'معمولی', '#22c55e', { calm: 2, focus: 1, dependency: -2}),
  I('cucumber', 'خیار', 'تازه‌ها', 6, 'معمولی', '#4ade80', { calm: 2, speed: 1, dependency: -6}),
  I('carrot', 'هویج', 'تازه‌ها', 5, 'معمولی', '#fb923c', { glow: 2, quality: 1, dependency: -1}),
  I('tomato', 'گوجه', 'تازه‌ها', 6, 'معمولی', '#ef4444', { popularity: 1, power: 1, dependency: 0}),
  I('lettuce', 'کاهو', 'تازه‌ها', 5, 'معمولی', '#86efac', { calm: 1, durability: -1, dependency: -5}),
  I('parsley', 'جعفری', 'تازه‌ها', 5, 'معمولی', '#16a34a', { focus: 1, glow: 1, dependency: -2}),
  I('yogurt', 'ماست', 'تازه‌ها', 6, 'معمولی', '#f8fafc', { calm: 2, quality: 1, dependency: -1}),
  I('cheese', 'پنیر', 'تازه‌ها', 13, 'معمولی', '#fde047', { quality: 2, durability: 1, popularity: -1, dependency: 3}),
  I('egg', 'تخم‌مرغ', 'تازه‌ها', 5, 'معمولی', '#fef9c3', { power: 2, quality: 1, dependency: 1}),
]

export function ingredientById(id: string): IngredientDef | undefined {
  return INGREDIENTS.find((i) => i.id === id)
}

/** Deterministic hash (FNV-1a) — same input always same output. */
export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/** Daily price: deterministic ±25% fluctuation per game day (v4 rebalance). */
export function shopPrice(ing: IngredientDef, day: number): number {
  const f = 0.75 + (hashStr(`${ing.id}:${day}`) % 51) / 100 // 0.75..1.25
  return Math.max(1, Math.round(ing.basePrice * f))
}

/** Daily stock: deterministic, rarer = less. */
export function shopStockForDay(day: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const ing of INGREDIENTS) {
    const jitter = hashStr(`stock:${ing.id}:${day}`) % 7 // 0..6
    out[ing.id] = Math.max(1, ing.stockBase + jitter - 3)
  }
  return out
}

export interface SynergyRule {
  id: string
  name: string
  kind: 'synergy' | 'antagonism'
  first?: string // ingredient id
  second?: string
  firstCat?: IngredientCategory
  secondCat?: IngredientCategory
  effects: Partial<Record<GameStat, number>>
  mult: number
}

const S = (name: string, first: string, second: string, effects: SynergyRule['effects'], mult: number, kind: SynergyRule['kind'] = 'synergy'): SynergyRule => ({
  id: `s-${first}-${second}-${name}`, name, kind, first, second, effects, mult,
})

// Curated ordered pairs — A-before-B deliberately differs from B-before-A in several cases.
const CURATED: SynergyRule[] = [
  S('هم‌افزایی طلایی', 'banana', 'honey', { power: 3, durability: 2 , dependency: 3}, 1.25),
  S('آغاز تند', 'pepper', 'banana', { power: 2, calm: -2 , dependency: -2}, 1.1),
  S('پایان شیرین', 'banana', 'pepper', { popularity: 2, power: 1 , dependency: 4}, 1.15),
  S('بیداری صبحگاهی', 'coffee', 'chocolate', { focus: 3, speed: 2 , dependency: 2}, 1.3),
  S('تلخی مضاعف', 'chocolate', 'coffee', { quality: -2, power: 2 , dependency: -3}, 0.95, 'antagonism'),
  S('نسیم باغ', 'mint', 'lemon', { focus: 3, glow: 1 , dependency: 5}, 1.2),
  S('ترشی تیز', 'lemon', 'mint', { speed: 2, calm: -2 , dependency: 3}, 1.05),
  S('عطر سلطنتی', 'saffron', 'cardamom', { glow: 4, quality: 3 , dependency: -2}, 1.5),
  S('ادویه‌جات ناسازگار', 'cardamom', 'saffron', { quality: -3, glow: 1 , dependency: 4}, 0.85, 'antagonism'),
  S('صبحانه کامل', 'egg', 'cheese', { power: 3, quality: 2 , dependency: 2}, 1.2),
  S('سنگینی', 'cheese', 'egg', { speed: -2, durability: 2 , dependency: -3}, 0.95, 'antagonism'),
  S('باغ میوه', 'strawberry', 'banana', { popularity: 4, glow: 2 , dependency: 5}, 1.35),
  S('موز غالب', 'banana', 'strawberry', { power: 3, popularity: 1 , dependency: 3}, 1.15),
  S('خنکی تابستان', 'watermelon', 'mint', { calm: 4, speed: 1 , dependency: -2}, 1.2),
  S('آرامش شبانه', 'greentea', 'honey', { calm: 3, focus: 2 , dependency: 4}, 1.25),
  S('چای سنگین', 'honey', 'greentea', { durability: 2, calm: -1 , dependency: 2}, 1.0),
  S('انرژی کوهستان', 'walnut', 'date', { power: 3, durability: 2 , dependency: -3}, 1.25),
  S('خرمای طلایی', 'date', 'walnut', { durability: 3, popularity: 1 , dependency: 5}, 1.15),
  S('آجیل اشرافی', 'pistachio', 'almond', { quality: 4, popularity: 2 , dependency: 3}, 1.4),
  S('آجیل مخلوط', 'almond', 'pistachio', { power: 2, quality: 2 , dependency: -2}, 1.2),
  S('تندی آتشین', 'pepper', 'ginger', { power: 5, calm: -3 , dependency: 4}, 1.2),
  S('گرمای متعادل', 'ginger', 'pepper', { power: 3, speed: 2 , dependency: 2}, 1.25),
  S('ترش و شیرین', 'lemon', 'honey', { popularity: 3, focus: 1 , dependency: -3}, 1.2),
  S('شیرینِ ترش', 'honey', 'lemon', { durability: 2, calm: -1 , dependency: 5}, 1.05),
  S('سالاد تازه', 'cucumber', 'tomato', { calm: 2, glow: 2 }, 1.15),
  S('سالاد سنگین', 'tomato', 'cucumber', { popularity: 2, speed: -1 }, 1.0),
  S('سبزی معطر', 'basil', 'parsley', { focus: 2, calm: 2 }, 1.15),
  S('دوغ و نعناع', 'doogh', 'mint', { calm: 4 }, 1.2),
  S('نعناع و دوغ', 'mint', 'doogh', { focus: 2, calm: 1 }, 1.1),
  S('شیرکاکائو', 'milk', 'cocoa', { popularity: 3, power: 1 }, 1.2),
  S('کاکائوی غلیظ', 'cocoa', 'milk', { power: 3, quality: -1 }, 1.05),
  S('کارامل و نمک', 'caramel', 'salt', { popularity: 3, durability: 1 }, 1.25),
  S('نمک اضافی', 'salt', 'caramel', { popularity: -3, quality: -2 }, 0.8, 'antagonism'),
  S('سرکه و عسل', 'vinegar', 'honey', { durability: 3, popularity: -2 }, 0.9, 'antagonism'),
  S('عسل و سرکه', 'honey', 'vinegar', { quality: -2, durability: 2 }, 0.9, 'antagonism'),
  S('سیر و ماست', 'garlic', 'yogurt', { power: 2, popularity: -2 }, 0.95, 'antagonism'),
  S('ماست و سیر', 'yogurt', 'garlic', { calm: 1, popularity: -1 }, 1.0),
  S('وانیل و شیر', 'vanilla', 'milk', { quality: 4, popularity: 2 }, 1.35),
  S('شیر وانیلی', 'milk', 'vanilla', { calm: 3, quality: 1 }, 1.15),
  S('دارچین و سیب', 'cinnamon', 'apple', { glow: 3, popularity: 2 }, 1.25),
  S('سیب دارچینی', 'apple', 'cinnamon', { durability: 2, glow: 1 }, 1.1),
  S('قهوه و هل', 'coffee', 'cardamom', { focus: 4, quality: 2 }, 1.4),
  S('هل و قهوه', 'cardamom', 'coffee', { calm: -2, focus: 2 }, 1.05),
  S('انبه و نارگیل‌وار', 'mango', 'juice', { popularity: 3, speed: 2 }, 1.2),
  S('آناناس تند', 'pineapple', 'pepper', { power: 3, popularity: 2 }, 1.2),
  S('فلفل و آناناس', 'pepper', 'pineapple', { calm: -3, glow: 2 }, 0.95, 'antagonism'),
  S('انجیر و گردو', 'fig', 'walnut', { durability: 4, quality: 1 }, 1.2),
  S('کشمش و بادام', 'raisin', 'almond', { durability: 2, power: 2 }, 1.15),
  S('زعفران و گلاب', 'saffron', 'rosewater', { glow: 5, popularity: 2 }, 1.5),
  S('گلاب و زعفران', 'rosewater', 'saffron', { calm: 3, glow: 2 }, 1.3),
]

// Category ordered-pair rules (6×6 = 36) — order matters.
const CAT_EFFECTS: Array<[IngredientCategory, IngredientCategory, string, Partial<Record<GameStat, number>>, number, 'synergy' | 'antagonism']> = []
const CAT_NAMES: Record<string, string> = {
  'میوه‌ها>طعم و شیرینی': 'میوهٔ شیرین‌شده', 'طعم و شیرینی>میوه‌ها': 'شیرینی میوه‌ای',
  'نوشیدنی‌ها>میوه‌ها': 'نوشیدنی میوه‌ای', 'میوه‌ها>نوشیدنی‌ها': 'میوهٔ آب‌دار',
  'ادویه و آشپزخانه>میوه‌ها': 'میوهٔ ادویه‌ای', 'میوه‌ها>ادویه و آشپزخانه': 'ادویهٔ میوه‌ای',
  'خشکبار و خوراکی>طعم و شیرینی': 'آجیل شیرین', 'طعم و شیرینی>خشکبار و خوراکی': 'شیرینی آجیلی',
  'تازه‌ها>ادویه و آشپزخانه': 'تازهٔ ادویه‌ای', 'ادویه و آشپزخانه>تازه‌ها': 'ادویهٔ تازه',
  'نوشیدنی‌ها>طعم و شیرینی': 'نوشیدنی شیرین', 'طعم و شیرینی>نوشیدنی‌ها': 'شیرینی نوشیدنی',
}
for (const a of INGREDIENT_CATEGORIES) {
  for (const b of INGREDIENT_CATEGORIES) {
    const key = `${a}>${b}`
    const same = a === b
    CAT_EFFECTS.push([
      a, b,
      CAT_NAMES[key] ?? (same ? `ترکیب هم‌خانوادهٔ ${a}` : `ترکیب ${a} و ${b}`),
      same ? { quality: 1, durability: 1 } : { popularity: 1, glow: 1 },
      same ? 1.08 : 1.12,
      'synergy',
    ])
  }
}
const CAT_RULES: SynergyRule[] = CAT_EFFECTS.map(([a, b, name, effects, mult, kind]) => ({
  id: `cat-${a}-${b}`, name, kind, firstCat: a, secondCat: b, effects, mult,
}))

// Additional generated ordered ingredient pairs to exceed 100 rules explicitly.
const EXTRA_PAIRS: Array<[string, string, string]> = [
  ['banana', 'coffee', 'موز قهوه‌ای'], ['coffee', 'banana', 'قهوهٔ موزی'], ['apple', 'honey', 'سیب عسلی'],
  ['honey', 'apple', 'عسل سیبی'], ['orange', 'carrot', 'نارنجی درخشان'], ['carrot', 'orange', 'هویج پرتقالی'],
  ['grape', 'cheese', 'انگور و پنیر'], ['cheese', 'grape', 'پنیر انگوری'], ['kiwi', 'yogurt', 'کیوی ماستی'],
  ['yogurt', 'kiwi', 'ماست کیویی'], ['mango', 'mint', 'انبهٔ خنک'], ['mint', 'mango', 'نعناع انبه‌ای'],
  ['strawberry', 'chocolate', 'توت شکلاتی'], ['chocolate', 'strawberry', 'شکلات توتی'], ['lemon', 'ginger', 'لیمو زنجبیلی'],
  ['ginger', 'lemon', 'زنجبیل لیمویی'], ['blacktea', 'lemon', 'چای لیمو'], ['lemon', 'blacktea', 'لیمو چایی'],
  ['date', 'milk', 'شیر خرما'], ['milk', 'date', 'خرمای شیری'], ['fig', 'honey', 'انجیر عسلی'],
  ['honey', 'fig', 'عسل انجیری'], ['hazelnut', 'chocolate', 'فندق شکلاتی'], ['chocolate', 'hazelnut', 'شکلات فندقی'],
  ['turmeric', 'milk', 'شیر طلایی'], ['milk', 'turmeric', 'طلای شیری'], ['basil', 'tomato', 'ریحان گوجه‌ای'],
  ['tomato', 'basil', 'گوجهٔ ریحانی'], ['lettuce', 'cucumber', 'سالاد سبز'], ['cucumber', 'lettuce', 'خیار کاهویی'],
  ['egg', 'tomato', 'املت خیالی'], ['tomato', 'egg', 'گوجهٔ تخم‌مرغی'], ['oliveoil', 'lemon', 'زیتون لیمویی'],
  ['lemon', 'oliveoil', 'لیمو زیتونی'], ['soda', 'juice', 'گازدار میوه‌ای'], ['juice', 'soda', 'آب‌میوهٔ گازدار'],
  ['sugar', 'coffee', 'قهوهٔ شیرین'], ['coffee', 'sugar', 'شکر قهوه‌ای'], ['jam', 'cheese', 'مربا و پنیر'],
  ['cheese', 'jam', 'پنیر مربایی'], ['peanut', 'banana', 'موز بادامی'], ['banana', 'peanut', 'بادام موزی'],
  ['raisin', 'walnut', 'کشمش گردویی'], ['walnut', 'raisin', 'گردوی کشمشی'], ['parsley', 'lemon', 'جعفری لیمویی'],
  ['lemon', 'parsley', 'لیمو جعفری'], ['caramel', 'apple', 'سیب کاراملی'], ['apple', 'caramel', 'کارامل سیبی'],
  ['vanilla', 'strawberry', 'وانیل توتی'], ['strawberry', 'vanilla', 'توت وانیلی'], ['saffron', 'milk', 'شیر زعفرانی'],
  ['milk', 'saffron', 'زعفران شیری'], ['garlic', 'oliveoil', 'سیر زیتونی'], ['oliveoil', 'garlic', 'زیتون سیری'],
]
const EXTRA_RULES: SynergyRule[] = EXTRA_PAIRS.map(([f, s, name], idx) => ({
  id: `x-${f}-${s}`, name, kind: idx % 9 === 8 ? 'antagonism' : 'synergy', first: f, second: s,
  effects: idx % 9 === 8 ? { quality: -2, popularity: 1 } : { popularity: 2, quality: 1 },
  mult: idx % 9 === 8 ? 0.9 : 1.15,
}))

export const SYNERGIES: SynergyRule[] = [...CURATED, ...CAT_RULES, ...EXTRA_RULES]

export const SLOT_WEIGHTS = [1, 0.6, 0.35, 0.2]

export interface CraftResult {
  stats: Record<GameStat, number>
  value: number
  quality: number
  rarity: number
  popularity: number
  name: string
  color: string
  synergies: SynergyRule[]
  comboKey: string
  positiveSum: number
  dependency: number // v3: fictional game stat 0-100 («وابستگی مشتری» در بازی)
}

const NAME_SUFFIX = ['ویژه', 'ممتاز', 'کمیاب', 'افسانه‌ای', 'لوکس', 'ماندگار', 'درخشان', 'طلایی', 'نقره‌ای', 'مرموز']
const NAME_MID = ['شب', 'ستاره', 'مهتاب', 'طلوع', 'سایه', 'نور', 'راز', 'باد', 'آتش', 'یخ']

export function comboKeyOf(baseId: string, ingredientIds: string[]): string {
  return `${baseId}|${ingredientIds.join('>')}`
}

export function computeCraft(baseId: string, ingredientIds: string[], qualityBonus = 0): CraftResult {
  const base = PRODUCTS.find((p) => p.id === baseId)
  const ings = ingredientIds.map(ingredientById).filter((x): x is IngredientDef => !!x).slice(0, 4)
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<GameStat, number>

  ings.forEach((ing, idx) => {
    const w = SLOT_WEIGHTS[idx] ?? 0.2
    for (const [k, v] of Object.entries(ing.buffs)) stats[k as GameStat] += (v ?? 0) * w
  })
  // First ingredient = primary trait; last = finish trait
  if (ings.length) {
    const first = ings[0]
    const top = Object.entries(first.buffs).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]
    if (top && (top[1] ?? 0) > 0) stats[top[0] as GameStat] += 2
    const last = ings[ings.length - 1]
    stats.durability += 1
    stats.popularity += Math.max(0, (last.buffs.popularity ?? 0)) * 0.5
  }
  // Ordered adjacent synergies / antagonisms
  const found: SynergyRule[] = []
  let mult = 1
  for (let i = 0; i + 1 < ings.length; i++) {
    const a = ings[i]; const b = ings[i + 1]
    for (const rule of SYNERGIES) {
      const pairMatch = rule.first === a.id && rule.second === b.id
      const catMatch = rule.firstCat === a.category && rule.secondCat === b.category
      if (pairMatch || catMatch) {
        // specific pair rules take precedence in listing; apply all matches but cap total
        found.push(rule)
        for (const [k, v] of Object.entries(rule.effects)) stats[k as GameStat] += v ?? 0
        mult *= rule.mult
      }
    }
  }
  for (const k of STAT_KEYS) stats[k] = clamp(Math.round(stats[k]), -20, 60)
  const positiveSum = STAT_KEYS.filter((k) => k !== 'dependency').reduce((a, k) => a + Math.max(0, stats[k]), 0)
  const negativeSum = STAT_KEYS.filter((k) => k !== 'dependency').reduce((a, k) => a + Math.min(0, stats[k]), 0)
  // v3 dependency (fictional game stat 0-100): base product level + ordered ingredient
  // contributions (already slot-weighted in stats.dependency, incl. synergy effects)
  const dependency = clamp(Math.round((base?.dependency ?? 25) + stats.dependency * 2), 0, 100)
  const baseVal = base?.baseValue ?? 10
  // v4 rebalance: cap synergy multiplier and total value vs input cost (max 3x input).
  const cappedMult = clamp(mult, 0.7, 1.6)
  const inputCost = (base?.prodCost ?? 10) + ings.reduce((a, i) => a + i.basePrice, 0)
  const raw = baseVal * (1 + positiveSum / 50) * cappedMult * (1 + qualityBonus / 200) * (1 + dependency / 400) + negativeSum * 2
  const value = Math.max(Math.round(baseVal * 0.3), Math.min(Math.round(Number.isFinite(raw) ? raw : baseVal), inputCost * 3))
  const quality = clamp(50 + stats.quality * 3 + qualityBonus, 0, 100)
  const rarity = clamp((base?.rarity ?? 1) + Math.floor(positiveSum / 8) + ings.filter((i) => i.rarity === 'نادر').length * 2, 1, 10)
  const popularity = clamp(Math.round((base?.demand ?? 30) * 0.4 + stats.popularity * 4), 0, 100)

  const key = comboKeyOf(baseId, ings.map((i) => i.id))
  const h = hashStr(key)
  const firstName = ings[0]?.name ?? 'ویژه'
  const name = `${firstName}‌${NAME_MID[h % NAME_MID.length]} ${NAME_SUFFIX[Math.floor(h / 7) % NAME_SUFFIX.length]}`
  const color = ings[0]?.color ?? base?.color ?? '#9a9ab0'
  return { stats, value, quality, rarity, popularity, name, color, synergies: found, comboKey: key, positiveSum, dependency }
}
