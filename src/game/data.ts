import type { Customer, District, MissionDef, ModifierDef, ProductDef, Rival, Staff } from './types'

// v4 rebalance: production cost ≈ 50% of market value; slower production throughput.
export const PRODUCTS: ProductDef[] = [
  { id: 'ink', name: 'جوهر شب‌تاب', category: 'جوهر خیالی', baseValue: 40, rarity: 1, demand: 70, prodCost: 20, prodHours: 3, unlockStage: 1, color: '#22ff88', desc: 'جوهری خیالی که در تاریکی می‌درخشد؛ کالای پایه شبکه.', dependency: 25 },
  { id: 'stone', name: 'سنگ درخشان خیالی', category: 'سنگ تزئینی', baseValue: 90, rarity: 2, demand: 55, prodCost: 45, prodHours: 5, unlockStage: 2, color: '#38bdf8', desc: 'سنگی خیالی با نور ملایم؛ محبوب کلکسیونرهای شهر.', dependency: 20 },
  { id: 'perfume', name: 'عطر مرموز', category: 'عطر خیالی', baseValue: 160, rarity: 3, demand: 45, prodCost: 80, prodHours: 8, unlockStage: 3, color: '#a855f7', desc: 'عطری خیالی با رایحه‌ای که هیچ‌کس نمی‌تواند توصیفش کند.', dependency: 30 },
  { id: 'crystal', name: 'کریستال ستاره', category: 'کریستال خیالی', baseValue: 320, rarity: 4, demand: 35, prodCost: 165, prodHours: 12, unlockStage: 4, color: '#facc15', desc: 'کریستالی خیالی که نور ستاره‌ها را در خود نگه می‌دارد.', dependency: 28 },
  { id: 'pearl', name: 'مروارید ماه', category: 'جواهر خیالی', baseValue: 650, rarity: 5, demand: 25, prodCost: 340, prodHours: 18, unlockStage: 5, color: '#f472b6', desc: 'مرواریدی خیالی و کمیاب؛ نماد ثروت در شهر.', dependency: 35 },
]

export const MODIFIERS: ModifierDef[] = [
  { id: 'shiny', name: 'درخشان', valueMult: 1.4, qualityBonus: 8, rarityBonus: 1, popularity: 60, craftCost: 15, unlockStage: 1, color: '#fde68a' },
  { id: 'lux', name: 'لوکس', valueMult: 1.8, qualityBonus: 14, rarityBonus: 2, popularity: 55, craftCost: 40, unlockStage: 2, color: '#facc15' },
  { id: 'mystic', name: 'مرموز', valueMult: 1.6, qualityBonus: 10, rarityBonus: 2, popularity: 70, craftCost: 30, unlockStage: 2, color: '#a855f7' },
  { id: 'lasting', name: 'ماندگار', valueMult: 1.5, qualityBonus: 12, rarityBonus: 1, popularity: 50, craftCost: 25, unlockStage: 3, color: '#34d399' },
  { id: 'premium', name: 'ممتاز', valueMult: 2.2, qualityBonus: 20, rarityBonus: 3, popularity: 65, craftCost: 80, unlockStage: 3, color: '#38bdf8' },
  { id: 'rare', name: 'کمیاب', valueMult: 2.6, qualityBonus: 16, rarityBonus: 4, popularity: 75, craftCost: 120, unlockStage: 4, color: '#f472b6' },
  { id: 'legend', name: 'افسانه‌ای', valueMult: 3.5, qualityBonus: 28, rarityBonus: 5, popularity: 90, craftCost: 250, unlockStage: 5, color: '#fb923c' },
]

// v4 rebalance: rent bites daily; unlock costs rise steeply.
export const DISTRICTS: District[] = [
  { id: 'oldtown', name: 'محله قدیمی', economy: 35, buyingPower: 40, competition: 30, surveillance: 25, rent: 50, unlockCost: 0, unlockStage: 1, unlocked: true, desc: 'محله‌ای آرام با مشتریان وفادار و اجاره کم.', color: '#22ff88' },
  { id: 'bazaar', name: 'بازار مرکزی', economy: 65, buyingPower: 70, competition: 70, surveillance: 55, rent: 180, unlockCost: 1500, unlockStage: 2, unlocked: false, desc: 'قلب تجاری شهر؛ تقاضای بالا و رقابت شدید.', color: '#facc15' },
  { id: 'industrial', name: 'منطقه صنعتی', economy: 50, buyingPower: 55, competition: 40, surveillance: 35, rent: 150, unlockCost: 5000, unlockStage: 3, unlocked: false, desc: 'کارگاه‌ها و انبارهای بزرگ؛ هزینه تولید کمتر.', color: '#38bdf8' },
  { id: 'hills', name: 'تپه‌های شمالی', economy: 90, buyingPower: 95, competition: 50, surveillance: 70, rent: 400, unlockCost: 15000, unlockStage: 4, unlocked: false, desc: 'محله ثروتمندان؛ قدرت خرید بالا و نظارت شدید.', color: '#a855f7' },
  { id: 'port', name: 'بندر خیالی', economy: 75, buyingPower: 80, competition: 60, surveillance: 45, rent: 300, unlockCost: 40000, unlockStage: 5, unlocked: false, desc: 'دروازه تجارت شهر؛ مشتریان متنوع و سفارش‌های بزرگ.', color: '#f472b6' },
]

const NAMES = [
  'آرش کریمی', 'سارا محمدی', 'رضا احمدی', 'مریم حسینی', 'علی رضایی', 'زهرا موسوی',
  'امیر صادقی', 'نگار کریمی', 'حسین نجفی', 'فاطمه عزیزی', 'مهدی قاسمی', 'الهام رستمی',
  'کیان مرادی', 'درسا نادری', 'پارسا یوسفی', 'تارا شریفی',
]

const PERSONALITIES: Customer['personality'][] = [
  'loyal', 'picky', 'wealthy', 'unreliable', 'stranger', 'normal',
  'loyal', 'wealthy', 'picky', 'normal', 'stranger', 'unreliable',
  'wealthy', 'loyal', 'picky', 'normal',
]

export const PERSONALITY_LABEL: Record<Customer['personality'], string> = {
  loyal: 'وفادار',
  picky: 'سخت‌گیر',
  wealthy: 'ثروتمند',
  unreliable: 'بدقول',
  stranger: 'ناشناس',
  normal: 'معمولی',
}

export function makeCustomers(): Customer[] {
  return NAMES.map((name, i) => {
    const p = PERSONALITIES[i]
    const stage = i < 3 ? 1 : i < 6 ? 2 : i < 9 ? 3 : i < 12 ? 4 : i < 14 ? 5 : 6
    const district = DISTRICTS[Math.min(DISTRICTS.length - 1, Math.floor(i / 4))].id
    const base = {
      id: `c${i + 1}`,
      name,
      age: 22 + ((i * 7) % 35),
      personality: p,
      trust: p === 'stranger' ? 20 : p === 'loyal' ? 65 : 40 + (i % 20),
      buyingPower: p === 'wealthy' ? 2500 + i * 200 : 250 + i * 80,
      loyalty: p === 'loyal' ? 70 : 30 + (i % 25),
      priceSensitivity: p === 'picky' ? 0.9 : p === 'wealthy' ? 0.25 : 0.4 + (i % 5) * 0.08,
      taste: ['any', 'shiny', 'lux', 'mystic', 'premium', 'rare'][i % 6],
      preferredStat: ['power', 'focus', 'speed', 'calm', 'popularity', 'durability', 'glow', 'quality'][i % 8],
      dependencyPreference: (['low', 'mid', 'high'] as const)[i % 3],
      lastDependency: 0,
      lastPurchaseDay: 0,
      highDepStreak: 0,
      restUntilDay: 0,
      risk: 20 + ((i * 13) % 60),
      satisfaction: 50,
      districtId: district,
      unlockStage: stage,
      history: [],
      totalProfit: 0,
      deals: 0,
    }
    return base as Customer
  })
}

export function makeStaff(): Staff[] {
  // v4 rebalance: a rep must close several sales/day to cover wage + hire cost.
  const defs: Array<[string, number, number, number]> = [
    ['بهار نماینده', 40, 40, 300],
    ['سینا نماینده', 60, 55, 600],
    ['نیلوفر نماینده', 90, 68, 1200],
    ['آریا نماینده', 130, 80, 2500],
    ['ترانه نماینده', 180, 90, 5000],
  ]
  return defs.map(([name, wage, skill, hireCost], i) => ({
    id: `s${i + 1}`, name, wage, skill, loyalty: 60, hireCost, hired: false, level: 1, autoSales: 0,
  }))
}

export function makeRivals(): Rival[] {
  return [
    { id: 'r1', name: 'شبکه «مهتاب»', capital: 3000, reputation: 40, marketShare: 30, districtId: 'bazaar', personality: 'تهاجمی', growth: 1.2 },
    { id: 'r2', name: 'گروه «سایه»', capital: 8000, reputation: 70, marketShare: 35, districtId: 'hills', personality: 'محافظه‌کار', growth: 0.8 },
    { id: 'r3', name: 'اتحادیه «بندر»', capital: 15000, reputation: 100, marketShare: 35, districtId: 'port', personality: 'ثروتمند', growth: 0.6 },
  ]
}

// v4 rebalance: modest cash rewards (early 30-100).
export const MISSIONS: MissionDef[] = [
  { id: 'm-income-1', title: 'اولین درآمدها', desc: 'به ۳۰۰ سکه درآمد کلی برس', kind: 'story', metric: 'income', target: 300, reward: 50 },
  { id: 'm-deals-1', title: 'فروشنده فعال', desc: '۵ معامله موفق انجام بده', kind: 'story', metric: 'deals', target: 5, reward: 60 },
  { id: 'm-craft-1', title: 'سازنده خلاق', desc: 'اولین محصول ویژه را ترکیب کن', kind: 'story', metric: 'crafts', target: 1, reward: 80 },
  { id: 'm-hire-1', title: 'تیم‌سازی', desc: 'یک نماینده فروش استخدام کن', kind: 'story', metric: 'hires', target: 1, reward: 100 },
  { id: 'm-district-1', title: 'گسترش شبکه', desc: 'منطقه دوم شهر را باز کن', kind: 'story', metric: 'districts', target: 2, reward: 150 },
  { id: 'm-rep-1', title: 'شهرت شهری', desc: 'به ۵۰ اعتبار برس', kind: 'story', metric: 'reputation', target: 50, reward: 200 },
  { id: 'm-net-1', title: 'سرمایه‌دار', desc: 'ارزش شبکه را به ۱۰٬۰۰۰ برسان', kind: 'story', metric: 'networth', target: 10000, reward: 300 },
  { id: 'd-income', title: 'هدف روزانه: درآمد', desc: 'امروز ۲۰۰ سکه درآمد کسب کن', kind: 'daily', metric: 'income', target: 200, reward: 30 },
  { id: 'd-deals', title: 'هدف روزانه: معامله', desc: 'امروز ۳ معامله انجام بده', kind: 'daily', metric: 'deals', target: 3, reward: 25 },
  { id: 'd-craft', title: 'هدف روزانه: ترکیب', desc: 'امروز یک محصول ویژه بساز', kind: 'daily', metric: 'crafts', target: 1, reward: 40 },
]

export const NAME_PARTS_A = ['شب', 'ستاره', 'مهتاب', 'طلوع', 'سایه', 'آتش', 'یخ', 'باد', 'نور', 'راز']
export const NAME_PARTS_B = ['تاب', 'درخشان', 'مرموز', 'طلایی', 'نقره‌ای', 'آبی', 'سرخ', 'سبز', 'بنفش', 'کهربایی']
export const NAME_PARTS_C = ['ویژه', 'ممتاز', 'کمیاب', 'افسانه‌ای', 'لوکس', 'ماندگار']

export const DIALOGUE = {
  greet: [
    'سلام! شنیدم محصول خوبی داری. این قیمت رو پیشنهاد می‌دم.',
    'وقت بخیر. برای این سفارش این مبلغ رو در نظر گرفتم.',
    'سلام دوست من. بیا سریع معامله رو ببندیم؛ این پیشنهاد منه.',
    'درود. کیفیت برام مهمه؛ این قیمت رو می‌دم.',
  ],
  accept: [
    'قبوله! معامله انجام شد.',
    'باشه، همینه. پول رو می‌فرستم.',
    'عالیه، قبول کردم.',
    'حله! منتظر تحویل می‌مونم.',
  ],
  counterBack: [
    'یکم بالاست… بیا وسط راه توافق کنیم.',
    'نزدیک شدیم؛ این قیمت نهایی منه.',
    'می‌تونم یکم بیشتر بدم، ولی نه اون‌قدر.',
  ],
  reject: [
    'نه، این قیمت خیلی بالاست. معامله لغو شد.',
    'متأسفم، با این قیمت نمی‌تونم. خداحافظ.',
    'این‌طوری نمی‌شه. شاید دفعه بعد.',
  ],
  discountThanks: [
    'ممنون از تخفیف! حتماً باز هم خرید می‌کنم.',
    'لطف کردی؛ مشتری ثابتت می‌شم.',
    'این تخفیف رو فراموش نمی‌کنم.',
  ],
  picky: [
    'همیشه باید تخفیف بدی تا راضی بشم!',
    'قیمتت بالاست؛ کمترش کن.',
  ],
  wealthy: [
    'پول مشکلی نیست، کیفیت مهمه.',
    'برای بهترین محصول، بهترین قیمت رو می‌دم.',
  ],
}
