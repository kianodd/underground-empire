import { useMemo, useState } from 'react'
import { DIALOGUE, MISSIONS, MODIFIERS, PERSONALITY_LABEL, PRODUCTS } from '../game/data'
import { dailyRent, dailyWages, findSpecial, inventoryUnits, isListed, listedProductKeys, netWorth, productColor, productDependency, productName, productValue, productionCapacity, salePrice, storageCap, upgradeCost, UPGRADE_INFO } from '../game/economy'
import { craftDurationHours, craftValue } from '../game/crafting'
import { heatLevel } from '../game/police'
import { playerShare } from '../game/market'
import { missionDone, missionProgress } from '../game/missions'
import { nextStageInfo, stageName } from '../game/progression'
import { beep, useStore } from '../game/store'
import { DependencyBar, IngredientWarehouse, StatChips } from './ShopCraft'
import type { Order } from '../game/types'

export const fmt = (n: number) => Math.round(n).toLocaleString('fa-IR')

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-panel border border-line rounded-2xl p-4 ${className}`}>{children}</div>
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))
  return (
    <div className="h-2 bg-panel2 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function Btn({ children, onClick, color = 'neon', disabled }: { children: React.ReactNode; onClick: () => void; color?: 'neon' | 'violet' | 'danger' | 'ghost'; disabled?: boolean }) {
  const cls = {
    neon: 'bg-neon text-black font-bold',
    violet: 'bg-violet2 text-white font-bold',
    danger: 'bg-danger/20 text-danger border border-danger/50',
    ghost: 'bg-panel2 text-cream border border-line',
  }[color]
  return (
    <button disabled={disabled} onClick={onClick} className={`${cls} rounded-xl px-4 py-2.5 min-h-[44px] text-sm disabled:opacity-40 active:scale-95 transition`}>
      {children}
    </button>
  )
}

export function Dashboard() {
  const game = useStore((s) => s.game)
  const stage = useStore((s) => s.stage)
  const [helpOpen, setHelpOpen] = useState(() => { try { return localStorage.getItem('ue-help-dismissed') !== '1' } catch { return true } })
  const next = nextStageInfo(game)
  const hl = heatLevel(game.heat)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><div className="text-mute text-xs">موجودی نقد</div><div className="text-2xl font-black text-neon">{fmt(game.cash)} سکه</div></Card>
        <Card><div className="text-mute text-xs">ارزش شبکه</div><div className="text-2xl font-black">{fmt(netWorth(game))}</div></Card>
        <Card><div className="text-mute text-xs">اعتبار</div><div className="text-2xl font-black text-violet2">{fmt(game.reputation)}</div></Card>
        <Card><div className="text-mute text-xs">مرحله</div><div className="text-lg font-black text-warn">{stageName(stage)}</div></Card>
      </div>
      <Card>
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold">توجه پلیس (Heat)</span>
          <span style={{ color: hl.color }} className="font-bold">{fmt(game.heat)}٪ — {hl.label}</span>
        </div>
        <Bar value={game.heat} max={100} color={hl.color} />
        {game.salesPausedUntilDay >= game.day && <div className="text-danger text-sm mt-2">فروش تا پایان روز {fmt(game.salesPausedUntilDay)} متوقف است.</div>}
        {next && <div className="text-mute text-sm mt-3">مرحله بعد: «{next.name}» — نیازمند ارزش شبکه {fmt(next.netWorth)} و اعتبار {fmt(next.reputation)}</div>}
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-center">
        <Card><div className="text-xl font-black">{fmt(game.orders.length)}</div><div className="text-mute text-xs">سفارش فعال</div></Card>
        <Card><div className="text-xl font-black">{fmt(listedProductKeys(game).length)}</div><div className="text-mute text-xs">محصول در لیست فروش</div></Card>
        <Card><div className="text-xl font-black">{fmt(inventoryUnits(game))}/{fmt(storageCap(game))}</div><div className="text-mute text-xs">موجودی انبار</div></Card>
        <Card><div className="text-xl font-black">{fmt(game.productionQueue.length)}/{fmt(productionCapacity(game))}</div><div className="text-mute text-xs">تولید در جریان</div></Card>
        {(game.craftingQueue?.length ?? 0) > 0 && (
          <Card><div className="text-base font-black text-violet2">«{game.craftingQueue[0].name}» — {fmt(game.craftingQueue[0].remainingHours)} ساعت مانده{game.craftingQueue.length > 1 ? ` (+${fmt(game.craftingQueue.length - 1)} در صف)` : ''}</div><div className="text-mute text-xs">ساخت در جریان (رایگان)</div></Card>
        )}
        <Card><div className="text-xl font-black">{fmt(game.stats.deals)}</div><div className="text-mute text-xs">معامله موفق</div></Card>
      </div>
      <Card>
        <div className="font-bold mb-2">رویدادهای اخیر شهر</div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {game.eventLog.slice(0, 15).map((e) => (
            <div key={e.id} className="text-sm border-b border-line/50 pb-1">
              <span className="text-mute text-xs">روز {fmt(e.day)} ساعت {fmt(e.hour)}: </span>{e.text}
            </div>
          ))}
        </div>
      </Card>
      {helpOpen && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold">شروع سریع</span>
            <Btn color="ghost" onClick={() => { setHelpOpen(false); try { localStorage.setItem('ue-help-dismissed', '1') } catch { /* ignore */ } }}>بستن</Btn>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm text-center">
            <div className="bg-panel2 rounded-xl p-2">۱. تولید کن</div>
            <div className="bg-panel2 rounded-xl p-2">۲. ترکیب بساز</div>
            <div className="bg-panel2 rounded-xl p-2">۳. در لیست فروش بگذار</div>
            <div className="bg-panel2 rounded-xl p-2">۴. مذاکره کن و بفروش</div>
          </div>
        </Card>
      )}
    </div>
  )
}

export function Districts() {
  const game = useStore((s) => s.game)
  const unlockDistrict = useStore((s) => s.unlockDistrict)
  const toast = useStore((s) => s.toast)
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {game.districts.map((d) => (
        <Card key={d.id}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-4 h-4 rounded" style={{ background: d.color }} />
            <span className="font-black text-lg">{d.name}</span>
            {d.unlocked ? <span className="text-neon text-xs">فعال</span> : <span className="text-mute text-xs">قفل (مرحله {fmt(d.unlockStage)})</span>}
          </div>
          <p className="text-sm text-mute mb-3">{d.desc}</p>
          <div className="space-y-1.5 text-xs">
            <div>قدرت خرید <Bar value={d.buyingPower} max={100} color="#22ff88" /></div>
            <div>رقابت <Bar value={d.competition} max={100} color="#fb923c" /></div>
            <div>نظارت <Bar value={d.surveillance} max={100} color="#f87171" /></div>
          </div>
          <div className="text-sm mt-3">اجاره روزانه: {fmt(d.rent)} سکه</div>
          {!d.unlocked && (
            <div className="mt-3">
              <Btn onClick={() => { const e = unlockDistrict(d.id); toast(e ?? `منطقه «${d.name}» باز شد!`, e ? 'bad' : 'good') }}>
                باز کردن — {fmt(d.unlockCost)} سکه
              </Btn>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

function NegotiationModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const game = useStore((s) => s.game)
  const negotiateOrder = useStore((s) => s.negotiateOrder)
  const acceptOrder = useStore((s) => s.acceptOrder)
  const rejectOrder = useStore((s) => s.rejectOrder)
  const toast = useStore((s) => s.toast)
  const customer = game.customers.find((c) => c.id === order.customerId)
  const [counter, setCounter] = useState(Math.round(order.offerPrice * 1.15))
  const [msg, setMsg] = useState(DIALOGUE.greet[order.id.length % DIALOGUE.greet.length])
  const [counterBack, setCounterBack] = useState<number | null>(null)
  if (!customer) return null
  const stock = game.inventory[order.productKey]?.qty ?? 0
  const extra = customer.personality === 'picky' ? DIALOGUE.picky[0] : customer.personality === 'wealthy' ? DIALOGUE.wealthy[0] : ''

  const doAccept = (price: number, discounted = false) => {
    const e = acceptOrder(order.id, price, discounted)
    if (e) { toast(e, 'bad'); return }
    beep(game.settings.sound)
    toast(discounted ? DIALOGUE.discountThanks[0] : `معامله با ${customer.name} انجام شد!`, 'good')
    onClose()
  }

  const doCounter = () => {
    const res = negotiateOrder(order.id, counter)
    if (!res) { onClose(); return }
    if (res.outcome === 'accept') {
      setMsg(DIALOGUE.accept[0])
      doAccept(res.price)
    } else if (res.outcome === 'counter') {
      setCounterBack(res.price)
      setMsg(`${DIALOGUE.counterBack[0]} پیشنهاد نهایی من: ${fmt(res.price)} سکه برای هر واحد.`)
    } else {
      toast(`${customer.name}: ${DIALOGUE.reject[0]}`, 'bad')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="bg-panel border border-line rounded-2xl w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-violet2/30 flex items-center justify-center font-black text-lg">{customer.name.slice(0, 1)}</div>
          <div>
            <div className="font-black">{customer.name} <span className="text-mute text-xs">({PERSONALITY_LABEL[customer.personality]})</span></div>
            <div className="text-xs text-mute">اعتماد {fmt(customer.trust)}٪ • وفاداری {fmt(customer.loyalty)}٪ • حساسیت قیمت {fmt(customer.priceSensitivity * 100)}٪</div>
          </div>
        </div>
        <div className="bg-panel2 rounded-xl p-3 text-sm">«{msg}» {extra && <span className="text-mute">{extra}</span>}</div>
        <div className="text-sm">
          <b>{productName(game, order.productKey)}</b> ×{fmt(order.qty)} • موجودی تو: {fmt(stock)}
          <div className="mt-1">پیشنهاد مشتری: <b className="text-neon text-2xl">{fmt(order.offerPrice)}</b> سکه/واحد <span className="text-mute">(جمع {fmt(order.offerPrice * order.qty)})</span></div>
          <div className="text-mute text-xs">قیمت بازار: {fmt(productValue(game, order.productKey))} سکه/واحد</div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">قیمت پیشنهادی تو:</label>
          <input type="number" value={counter} onChange={(e) => setCounter(Math.max(1, Number(e.target.value) || 1))}
            className="bg-panel2 border border-line rounded-xl px-3 py-2 w-28 text-center" />
          <Btn color="violet" onClick={doCounter}>پیشنهاد بده</Btn>
        </div>
        {counterBack !== null && (
          <Btn onClick={() => doAccept(counterBack)}>قبول قیمت نهایی مشتری ({fmt(counterBack)})</Btn>
        )}
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => doAccept(order.offerPrice)}>قبول پیشنهاد مشتری</Btn>
          <Btn color="ghost" onClick={() => doAccept(Math.max(1, Math.round(order.offerPrice * 0.9)), true)}>تخفیف ۱۰٪ (وفاداری+)</Btn>
          <Btn color="danger" onClick={() => { rejectOrder(order.id); onClose() }}>رد سفارش</Btn>
        </div>
      </div>
    </div>
  )
}

export function Customers() {
  const game = useStore((s) => s.game)
  const stage = useStore((s) => s.stage)
  const [sel, setSel] = useState<Order | null>(null)
  const [tab, setTab] = useState<'orders' | 'people'>('orders')
  const liveSel = sel ? game.orders.find((o) => o.id === sel.id) ?? null : null
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Btn color={tab === 'orders' ? 'neon' : 'ghost'} onClick={() => setTab('orders')}>سفارش‌ها ({fmt(game.orders.length)})</Btn>
        <Btn color={tab === 'people' ? 'neon' : 'ghost'} onClick={() => setTab('people')}>مشتریان</Btn>
      </div>
      {tab === 'orders' && (
        game.orders.length === 0
          ? <Card><p className="text-mute">سفارشی نیست؛ زمان را جلو ببر.</p></Card>
          : game.orders.map((o) => {
              const c = game.customers.find((x) => x.id === o.customerId)
              const stock = game.inventory[o.productKey]?.qty ?? 0
              return (
                <Card key={o.id}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-bold">{c?.name} <span className="text-mute text-xs">({c ? PERSONALITY_LABEL[c.personality] : ''})</span></div>
                      <div className="text-sm">{productName(game, o.productKey)} ×{fmt(o.qty)} — پیشنهاد {fmt(o.offerPrice)}/واحد</div>
                      <div className="text-xs text-mute">موجودی تو: {fmt(stock)} • انقضا تا {fmt(o.expiresInHours)} ساعت دیگر</div>
                    </div>
                    <Btn onClick={() => setSel(o)}>مذاکره</Btn>
                  </div>
                </Card>
              )
            })
      )}
      {tab === 'people' && game.customers.map((c) => {
        const locked = c.unlockStage > stage
        return (
          <Card key={c.id} className={locked ? 'opacity-50' : ''}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-panel2 flex items-center justify-center font-black">{c.name.slice(0, 1)}</div>
              <div className="flex-1">
                <div className="font-bold">{c.name} <span className="text-mute text-xs">{PERSONALITY_LABEL[c.personality]} • {fmt(c.age)} ساله</span></div>
                <div className="text-xs text-mute">
                  {locked ? `از مرحله ${fmt(c.unlockStage)} فعال می‌شود` : `اعتماد ${fmt(c.trust)}٪ • وفاداری ${fmt(c.loyalty)}٪ • رضایت ${fmt(c.satisfaction)}٪ • قدرت خرید ${fmt(c.buyingPower)} • معامله: ${fmt(c.deals)} • سود تو: ${fmt(c.totalProfit)}`}
                </div>
                {!locked && (
                  <div className="text-xs mt-1">
                    <span className="text-violet2">پیشنهاد فعال: {fmt(game.orders.filter((o) => o.customerId === c.id).length)}</span>
                    <span className="text-mute"> • علاقه به وابستگی (در بازی): {c.dependencyPreference === 'high' ? 'زیاد' : c.dependencyPreference === 'low' ? 'کم' : 'متوسط'}</span>
                    {(c.restUntilDay ?? 0) >= game.day && <span className="text-warn"> • در استراحت تا روز {fmt(c.restUntilDay ?? 0)}</span>}
                  </div>
                )}
              </div>
            </div>
            {!locked && c.history.length > 0 && (
              <div className="text-xs text-mute mt-2">آخرین معامله: {c.history[0].productName} ×{fmt(c.history[0].qty)} — {fmt(c.history[0].total)} سکه (روز {fmt(c.history[0].day)})</div>
            )}
          </Card>
        )
      })}
      {liveSel && <NegotiationModal order={liveSel} onClose={() => setSel(null)} />}
    </div>
  )
}

export function Inventory() {
  const game = useStore((s) => s.game)
  const stage = useStore((s) => s.stage)
  const setPrice = useStore((s) => s.setPrice)
  const entries = Object.entries(game.inventory)
  return (
    <div className="space-y-3">
      <Card><div className="font-bold">انبار محصولات: {fmt(inventoryUnits(game))} واحد (ظرفیت کل با مواد: {fmt(storageCap(game))})</div></Card>
      <IngredientWarehouse />
      {entries.length === 0 && <Card><p className="text-mute">انبار خالی است؛ از بخش تولید شروع کن.</p></Card>}
      {entries.map(([key, item]) => (
        <Card key={key}>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded" style={{ background: productColor(game, key) }} />
            <span className="font-bold">{productName(game, key)}</span>
            <span className="text-mute text-sm">×{fmt(item.qty)}</span>
          </div>
          <div className="text-xs text-mute mt-1">ارزش بازار: {fmt(productValue(game, key))} سکه/واحد</div>
          <div className="flex items-center gap-2 mt-2">
            <label className="text-sm">قیمت فروش تو:</label>
            <input type="number" value={item.price} onChange={(e) => setPrice(key, Number(e.target.value) || 1)}
              className="bg-panel2 border border-line rounded-xl px-3 py-2 w-28 text-center" />
          </div>
        </Card>
      ))}
      <Card>
        <div className="font-bold mb-2">کاتالوگ محصولات پایه</div>
        {PRODUCTS.map((p) => (
          <div key={p.id} className={`text-sm py-1 border-b border-line/50 ${p.unlockStage > stage ? 'opacity-50' : ''}`}>
            <span className="inline-block w-3 h-3 rounded ml-1" style={{ background: p.color }} />
            <b>{p.name}</b> — ارزش {fmt(p.baseValue)} • هزینه تولید {fmt(p.prodCost)} • زمان {fmt(p.prodHours)} ساعت/واحد
            {p.unlockStage > stage && <span className="text-mute"> (مرحله {fmt(p.unlockStage)})</span>}
            <div className="text-xs text-mute">{p.desc}</div>
          </div>
        ))}
      </Card>
      {game.specials.length > 0 && (
        <Card>
          <div className="font-bold mb-2">محصولات ویژه ساخته‌شده</div>
          {game.specials.map((s) => (
            <div key={s.id} className="text-sm py-1 border-b border-line/50">
              <span className="inline-block w-3 h-3 rounded ml-1" style={{ background: s.color }} />
              <b>{s.name}</b> ×{fmt(game.inventory[s.signature ?? s.id]?.qty ?? s.qty ?? 0)} — ارزش {fmt(s.value)} • کیفیت {fmt(s.quality)} • کمیابی {fmt(s.rarity)}/۱۰ • محبوبیت {fmt(s.popularity)}
              {s.stats && <div className="mt-1"><StatChips stats={s.stats} /></div>}
              <div className="mt-1"><DependencyBar value={s.dependency ?? 25} /></div>
              <div className="text-xs text-mute">{s.desc}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

export function SalesListPage() {
  const game = useStore((s) => s.game)
  const setListed = useStore((s) => s.setListed)
  const setSalePrice = useStore((s) => s.setSalePrice)
  const setAllListed = useStore((s) => s.setAllListed)
  const toast = useStore((s) => s.toast)
  const keys = [...new Set([
    ...Object.keys(game.inventory),
    ...game.specials.map((s) => s.signature ?? s.id),
    ...Object.keys(game.salesList ?? {}),
  ])]
  return (
    <div className="space-y-3">
      <Card>
        <div className="font-bold">لیست فروش</div>
        <p className="text-sm text-mute mt-1">فقط محصولات «برای فروش» سفارش می‌گیرند.</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Btn onClick={() => { setAllListed(true); toast('همه محصولات برای فروش گذاشته شدند.', 'good') }}>همه را برای فروش بگذار</Btn>
          <Btn color="danger" onClick={() => { setAllListed(false); toast('فروش همه محصولات متوقف شد.', 'warn') }}>همه را متوقف کن</Btn>
        </div>
      </Card>
      {keys.length === 0 && <Card><p className="text-mute">هنوز محصولی نداری؛ اول از «تولید» محصول بساز.</p></Card>}
      {keys.map((key) => {
        const qty = game.inventory[key]?.qty ?? 0
        const listed = isListed(game, key)
        const sp = findSpecial(game, key)
        return (
          <Card key={key}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-4 h-4 rounded shrink-0" style={{ background: productColor(game, key) }} />
              <span className="font-bold">{productName(game, key)}</span>
              <span className="text-mute text-sm">×{fmt(qty)}</span>
              {qty <= 0 && <span className="text-danger text-xs border border-danger/50 rounded-full px-2 py-0.5">ناموجود</span>}
              {listed
                ? <span className="text-neon text-xs border border-neon/50 rounded-full px-2 py-0.5">برای فروش</span>
                : <span className="text-mute text-xs border border-line rounded-full px-2 py-0.5">توقف فروش</span>}
            </div>
            <div className="text-xs text-mute mt-1">قیمت بازار: {fmt(productValue(game, key))} سکه/واحد{sp ? ' • محصول ویژه' : ''} • قیمت تو {fmt(Math.round((salePrice(game, key) / Math.max(1, productValue(game, key))) * 100))}٪ بازار</div>
            {salePrice(game, key) > productValue(game, key) * 1.2 && (
              <div className="text-warn text-xs mt-1">⚠ قیمت بالا = سفارش کمتر</div>
            )}
            <div className="mt-1"><DependencyBar value={productDependency(game, key)} /></div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <label className="text-sm">قیمت فروش:</label>
              <input type="number" min={1} value={salePrice(game, key)}
                onChange={(e) => setSalePrice(key, Number(e.target.value) || 1)}
                className="bg-panel2 border border-line rounded-xl px-3 py-2 w-28 text-center" />
              {listed
                ? <Btn color="danger" onClick={() => setListed(key, false)}>توقف فروش</Btn>
                : <Btn onClick={() => setListed(key, true)}>برای فروش بگذار</Btn>}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

export function Production() {
  const game = useStore((s) => s.game)
  const stage = useStore((s) => s.stage)
  const startProduction = useStore((s) => s.startProduction)
  const cancelProduction = useStore((s) => s.cancelProduction)
  const toast = useStore((s) => s.toast)
  const [qty, setQty] = useState<Record<string, number>>({})
  return (
    <div className="space-y-3">
      <Card>
        <div className="font-bold">صف تولید ({fmt(game.productionQueue.length)}/{fmt(productionCapacity(game))})</div>
        {game.productionQueue.length === 0 && <p className="text-mute text-sm">صف خالی است.</p>}
        {game.productionQueue.map((j) => (
          <div key={j.id} className="flex items-center gap-2 mt-2">
            <div className="flex-1">
              <div className="text-sm">{productName(game, j.productId)} ×{fmt(j.qty)} — {fmt(j.hoursLeft)} ساعت مانده</div>
              <Bar value={j.totalHours - j.hoursLeft} max={j.totalHours} color="#22ff88" />
            </div>
            <Btn color="danger" onClick={() => cancelProduction(j.id)}>لغو</Btn>
          </div>
        ))}
      </Card>
      {PRODUCTS.map((p) => {
        const locked = p.unlockStage > stage
        const q = qty[p.id] ?? 3
        const mult = game.costMult && game.day <= game.costMult.untilDay ? game.costMult.mult : 1
        return (
          <Card key={p.id} className={locked ? 'opacity-50' : ''}>
            <div className="font-bold"><span className="inline-block w-3 h-3 rounded ml-1" style={{ background: p.color }} />{p.name}</div>
            <div className="text-sm text-mute">هزینه هر واحد: {fmt(p.prodCost * mult)} • زمان هر واحد: {fmt(p.prodHours)} ساعت • ارزش بازار: {fmt(p.baseValue)}</div>
            {!locked && (
              <div className="flex items-center gap-2 mt-2">
                <input type="number" min={1} max={20} value={q} onChange={(e) => setQty({ ...qty, [p.id]: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                  className="bg-panel2 border border-line rounded-xl px-3 py-2 w-20 text-center" />
                <Btn onClick={() => { const e = startProduction(p.id, q); toast(e ?? 'تولید شروع شد.', e ? 'bad' : 'good') }}>شروع تولید ({fmt(p.prodCost * q * mult)} سکه)</Btn>
              </div>
            )}
            {locked && <div className="text-sm text-mute mt-1">از مرحله {fmt(p.unlockStage)} باز می‌شود.</div>}
          </Card>
        )
      })}
    </div>
  )
}

export function Crafting() {
  const game = useStore((s) => s.game)
  const stage = useStore((s) => s.stage)
  const craft = useStore((s) => s.craft)
  const toast = useStore((s) => s.toast)
  const [baseId, setBaseId] = useState('ink')
  const [mods, setMods] = useState<string[]>(['shiny'])
  const preview = useMemo(() => craftValue(baseId, mods, game.upgrades.quality * 5), [baseId, mods, game.upgrades.quality])
  const toggle = (id: string) => setMods((m) => m.includes(id) ? m.filter((x) => x !== id) : m.length >= 2 ? [m[1], id] : [...m, id])
  return (
    <div className="space-y-3">
      <Card>
        <div className="font-bold mb-2">۱) محصول پایه (۲ واحد مصرف می‌شود)</div>
        <div className="flex flex-wrap gap-2">
          {PRODUCTS.filter((p) => p.unlockStage <= stage).map((p) => (
            <Btn key={p.id} color={baseId === p.id ? 'neon' : 'ghost'} onClick={() => setBaseId(p.id)}>
              {p.name} (موجودی {fmt(game.inventory[p.id]?.qty ?? 0)})
            </Btn>
          ))}
        </div>
      </Card>
      <Card>
        <div className="font-bold mb-2">۲) ویژگی‌های خیالی (۱ تا ۲ مورد)</div>
        <div className="flex flex-wrap gap-2">
          {MODIFIERS.map((m) => {
            const locked = m.unlockStage > stage
            return (
              <Btn key={m.id} color={mods.includes(m.id) ? 'violet' : 'ghost'} disabled={locked} onClick={() => toggle(m.id)}>
                {m.name} ×{m.valueMult}{locked ? ` (مرحله ${fmt(m.unlockStage)})` : ''}
              </Btn>
            )
          })}
        </div>
        {game.demandSpike && <div className="text-neon text-sm mt-2">تقاضای ویژه شهر برای ویژگی «{MODIFIERS.find((m) => m.id === game.demandSpike!.modifierId)?.name}» تا روز {fmt(game.demandSpike.untilDay)}!</div>}
      </Card>
      <Card>
        <div className="font-bold mb-1">پیش‌نمایش محصول ویژه</div>
        <div className="text-sm">ارزش تقریبی: <b className="text-neon">{fmt(preview.value)}</b> • کیفیت {fmt(preview.quality)} • کمیابی {fmt(preview.rarity)}/۱۰ • محبوبیت {fmt(preview.popularity)}</div>
        <div className="text-sm text-mute"><b className="text-neon">رایگان</b> • {fmt(craftDurationHours(mods.length))} ساعت بازی • ۲ واحد محصول پایه</div>
        <div className="mt-3">
          <Btn onClick={() => { const e = craft(baseId, mods); toast(e ?? 'در صف ساخت قرار گرفت.', e ? 'bad' : 'good') }}>شروع ساخت (رایگان)</Btn>
        </div>
      </Card>
    </div>
  )
}

export function StaffPage() {
  const game = useStore((s) => s.game)
  const hireStaff = useStore((s) => s.hireStaff)
  const fireStaff = useStore((s) => s.fireStaff)
  const upgradeStaff = useStore((s) => s.upgradeStaff)
  const toast = useStore((s) => s.toast)
  return (
    <div className="space-y-3">
      <Card><p className="text-sm text-mute">نماینده‌ها سفارش کوچک را خودکار می‌فروشند؛ حقوق روزانه کم می‌شود.</p></Card>
      {game.staff.map((s) => (
        <Card key={s.id}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-neon/20 flex items-center justify-center font-black">{s.name.slice(0, 1)}</div>
            <div className="flex-1">
              <div className="font-bold">{s.name} {s.hired && <span className="text-neon text-xs">سطح {fmt(s.level)} — فعال</span>}</div>
              <div className="text-xs text-mute">مهارت {fmt(s.skill)} • وفاداری {fmt(s.loyalty)}٪ • حقوق روزانه {fmt(s.wage * s.level)} • فروش خودکار: {fmt(s.autoSales)}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {!s.hired && <Btn onClick={() => { const e = hireStaff(s.id); toast(e ?? `${s.name} استخدام شد.`, e ? 'bad' : 'good') }}>استخدام — {fmt(s.hireCost)} سکه</Btn>}
            {s.hired && <>
              <Btn color="violet" onClick={() => { const e = upgradeStaff(s.id); toast(e ?? 'ارتقا انجام شد.', e ? 'bad' : 'good') }}>ارتقا ({fmt(200 * s.level)})</Btn>
              <Btn color="danger" onClick={() => fireStaff(s.id)}>اخراج</Btn>
            </>}
          </div>
        </Card>
      ))}
    </div>
  )
}

export function Economy() {
  const game = useStore((s) => s.game)
  const share = playerShare(game)
  const rivalSum = game.rivals.reduce((a, r) => a + r.marketShare, 0) || 1
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Card><div className="text-mute text-xs">درآمد کل</div><div className="text-xl font-black text-neon">{fmt(game.stats.totalIncome)}</div></Card>
        <Card><div className="text-mute text-xs">هزینه کل</div><div className="text-xl font-black text-danger">{fmt(game.stats.totalExpense)}</div></Card>
        <Card><div className="text-mute text-xs">اجاره روزانه</div><div className="text-xl font-black">{fmt(dailyRent(game))}</div></Card>
        <Card><div className="text-mute text-xs">حقوق روزانه</div><div className="text-xl font-black">{fmt(dailyWages(game))}</div></Card>
      </div>
      <Card>
        <div className="font-bold mb-2">سود و زیان روزانه (از دفتر حساب)</div>
        <div className="space-y-1 text-sm">
          {[game.day, game.day - 1, game.day - 2].filter((d) => d >= 1).map((d) => {
            const inc = game.ledger.filter((l) => l.day === d && l.kind === 'income').reduce((a, l) => a + l.amount, 0)
            const exp = game.ledger.filter((l) => l.day === d && l.kind === 'expense').reduce((a, l) => a + l.amount, 0)
            const net = inc - exp
            return (
              <div key={d} className="flex justify-between border-b border-line/50 py-1">
                <span>روز {fmt(d)}{d === game.day ? ' (امروز)' : ''}</span>
                <span className="text-mute">درآمد {fmt(inc)} − هزینه {fmt(exp)} (اجاره/حقوق/تولید/مواد)</span>
                <span className={net >= 0 ? 'text-neon font-bold' : 'text-danger font-bold'}>{net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}</span>
              </div>
            )
          })}
          <p className="text-xs text-mute">اجاره {fmt(dailyRent(game))} + حقوق {fmt(dailyWages(game))} سکه/روز</p>
        </div>
      </Card>
      <Card>
        <div className="font-bold mb-2">سهم بازار</div>
        <div className="space-y-2 text-sm">
          <div>شبکه تو — {fmt(share)}٪<Bar value={share} max={100} color="#22ff88" /></div>
          {game.rivals.map((r) => (
            <div key={r.id}>{r.name} ({r.personality}) — {fmt(Math.round((r.marketShare / rivalSum) * (100 - share)))}٪ • سرمایه {fmt(r.capital)} • اعتبار {fmt(Math.round(r.reputation))}
              <Bar value={(r.marketShare / rivalSum) * (100 - share)} max={100} color="#a855f7" />
            </div>
          ))}
        </div>
        <p className="text-xs text-mute mt-2">قیمت بالا = سهم بیشتر برای رقبا.</p>
      </Card>
      <Card>
        <div className="font-bold mb-2">دفتر حساب (آخرین تراکنش‌ها)</div>
        <div className="space-y-1 max-h-80 overflow-y-auto text-sm">
          {game.ledger.map((l) => (
            <div key={l.id} className="flex justify-between border-b border-line/50 py-1">
              <span><span className="text-mute text-xs">روز {fmt(l.day)}: </span>{l.desc}</span>
              <span className={l.kind === 'income' ? 'text-neon font-bold' : 'text-danger font-bold'}>{l.kind === 'income' ? '+' : '−'}{fmt(l.amount)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export function Security() {
  const game = useStore((s) => s.game)
  const hl = heatLevel(game.heat)
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex justify-between mb-2"><span className="font-bold">توجه پلیس شهر (Heat)</span><span style={{ color: hl.color }} className="font-black">{fmt(game.heat)}٪ — {hl.label}</span></div>
        <Bar value={game.heat} max={100} color={hl.color} />
        <ul className="text-sm text-mute mt-3 space-y-1 list-disc pr-5">
          <li>فروش بزرگ = Heat بیشتر.</li>
          <li>بالای ۸۰٪: بازرسی و جریمه. بالای ۹۵٪: توقف فروش.</li>
          <li>«مدیریت ریسک» Heat را سریع‌تر کم می‌کند.</li>
        </ul>
      </Card>
      <Card>
        <div className="font-bold mb-2">نظارت مناطق</div>
        {game.districts.map((d) => (
          <div key={d.id} className="text-sm py-1">{d.name} {d.unlocked ? '' : '(قفل)'}<Bar value={d.surveillance} max={100} color="#f87171" /></div>
        ))}
      </Card>
      <Card>
        <div className="font-bold mb-2">رویدادهای امنیتی و شهری</div>
        <div className="space-y-1 max-h-64 overflow-y-auto text-sm">
          {game.eventLog.map((e) => <div key={e.id} className="border-b border-line/50 py-1"><span className="text-mute text-xs">روز {fmt(e.day)}: </span>{e.text}</div>)}
        </div>
      </Card>
    </div>
  )
}

export function MissionsPage() {
  const game = useStore((s) => s.game)
  const claimMission = useStore((s) => s.claimMission)
  const toast = useStore((s) => s.toast)
  return (
    <div className="space-y-3">
      {MISSIONS.map((def) => {
        const ms = game.missions.find((m) => m.defId === def.id)
        const prog = missionProgress(game, def)
        const done = missionDone(game, def)
        return (
          <Card key={def.id} className={ms?.claimed ? 'opacity-60' : ''}>
            <div className="flex justify-between gap-2">
              <div>
                <div className="font-bold">{def.title} <span className="text-xs text-mute">({def.kind === 'daily' ? 'روزانه' : 'داستانی'})</span></div>
                <div className="text-sm text-mute">{def.desc} — پاداش {fmt(def.reward)} سکه</div>
                <div className="text-sm mt-1">{fmt(Math.min(prog, def.target))} / {fmt(def.target)}</div>
                <Bar value={prog} max={def.target} color="#a855f7" />
              </div>
              {ms?.claimed ? <span className="text-neon text-sm">گرفته شد ✓</span>
                : <Btn disabled={!done} onClick={() => { const e = claimMission(def.id); toast(e ?? 'پاداش مأموریت گرفته شد!', e ? 'bad' : 'good') }}>دریافت پاداش</Btn>}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

export function UpgradesPage() {
  const game = useStore((s) => s.game)
  const buyUpgrade = useStore((s) => s.buyUpgrade)
  const toast = useStore((s) => s.toast)
  const kinds = Object.keys(UPGRADE_INFO) as Array<keyof typeof UPGRADE_INFO>
  return (
    <div className="space-y-3">
      {kinds.map((k) => {
        const info = UPGRADE_INFO[k]
        const level = game.upgrades[k]
        const maxed = level >= info.max
        return (
          <Card key={k}>
            <div className="flex justify-between gap-2 items-start">
              <div>
                <div className="font-bold">{info.name} — سطح {fmt(level)}/{fmt(info.max)}</div>
                <div className="text-sm text-mute">{info.desc}</div>
                <Bar value={level} max={info.max} color="#22ff88" />
              </div>
              {maxed ? <span className="text-neon text-sm">حداکثر</span>
                : <Btn onClick={() => { const e = buyUpgrade(k); toast(e ?? 'ارتقا انجام شد.', e ? 'bad' : 'good') }}>{fmt(upgradeCost(k, level))} سکه</Btn>}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

export function SettingsPage({ onExport, onImport, onReset }: { onExport: () => void; onImport: (f: File) => void; onReset: () => void }) {
  const game = useStore((s) => s.game)
  const setSound = useStore((s) => s.setSound)
  const setSpeed = useStore((s) => s.setSpeed)
  return (
    <div className="space-y-3">
      <Card>
        <div className="font-bold mb-2">صدای افکت‌ها</div>
        <Btn color={game.settings.sound ? 'neon' : 'ghost'} onClick={() => { setSound(!game.settings.sound); beep(!game.settings.sound) }}>
          {game.settings.sound ? 'روشن' : 'خاموش'}
        </Btn>
      </Card>
      <Card>
        <div className="font-bold mb-2">سرعت بازی</div>
        <div className="flex gap-2">
          <Btn color={game.speed === 0 ? 'neon' : 'ghost'} onClick={() => setSpeed(0)}>توقف</Btn>
          <Btn color={game.speed === 1 ? 'neon' : 'ghost'} onClick={() => setSpeed(1)}>معمولی</Btn>
          <Btn color={game.speed === 3 ? 'neon' : 'ghost'} onClick={() => setSpeed(3)}>سریع ×۳</Btn>
        </div>
      </Card>
      <Card>
        <div className="font-bold mb-2">ذخیره بازی</div>
        <p className="text-sm text-mute mb-3">ذخیره خودکار • نسخه {fmt(game.saveVersion)} • آخرین: {new Date(game.lastSavedAt).toLocaleString('fa-IR')}</p>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={onExport}>خروجی فایل ذخیره (JSON)</Btn>
          <label className="bg-panel2 text-cream border border-line rounded-xl px-4 py-2.5 min-h-[44px] text-sm cursor-pointer inline-flex items-center">
            ورود فایل ذخیره
            <input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f) }} />
          </label>
          <Btn color="danger" onClick={onReset}>بازنشانی کامل بازی</Btn>
        </div>
      </Card>
      <Card>
        <div className="font-bold mb-1">درباره</div>
        <p className="text-sm text-mute">امپراتوری زیرزمینی — نسخه ۴٫۰٫۰ • بازی کاملاً خیالی</p>
      </Card>
    </div>
  )
}
