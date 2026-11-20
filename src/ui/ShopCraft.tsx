import { useMemo, useState } from 'react'
import { PRODUCTS } from '../game/data'
import { storageCap, totalWarehouseUnits } from '../game/economy'
import { INGREDIENTS, INGREDIENT_CATEGORIES, STAT_LABEL, computeCraft, ingredientById, shopPrice, type GameStat } from '../game/ingredients'
import { CRAFT_QUEUE_MAX, craftDurationHours, quickCraftCheck } from '../game/crafting'
import { findSpecial } from '../game/economy'
import { useStore } from '../game/store'
import { fmt } from './Pages'

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-panel border border-line rounded-2xl p-4 ${className}`}>{children}</div>
}

function Btn({ children, onClick, color = 'neon', disabled }: { children: React.ReactNode; onClick: () => void; color?: 'neon' | 'violet' | 'danger' | 'ghost'; disabled?: boolean }) {
  const cls = {
    neon: 'bg-neon text-black font-bold',
    violet: 'bg-violet2 text-white font-bold',
    danger: 'bg-danger/20 text-danger border border-danger/50',
    ghost: 'bg-panel2 text-cream border border-line',
  }[color]
  return (
    <button disabled={disabled} onClick={onClick} className={`${cls} rounded-xl px-3 py-2 min-h-[44px] text-sm disabled:opacity-40 active:scale-95 transition`}>
      {children}
    </button>
  )
}

export function StatChips({ stats }: { stats: Partial<Record<GameStat, number>> }) {
  const entries = (Object.entries(stats) as Array<[GameStat, number]>).filter(([, v]) => v !== 0)
  if (!entries.length) return <span className="text-mute text-xs">بدون ویژگی</span>
  return (
    <span className="inline-flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span key={k} className={`text-[11px] rounded-full px-2 py-0.5 border ${v > 0 ? 'text-neon border-neon/50 bg-neon/10' : 'text-danger border-danger/50 bg-danger/10'}`}>
          {STAT_LABEL[k]} {v > 0 ? '+' : ''}{fmt(v)}
        </span>
      ))}
    </span>
  )
}

export function DependencyBar({ value }: { value: number }) {
  const color = value > 65 ? '#f87171' : value >= 35 ? '#fb923c' : '#22ff88'
  const label = value > 65 ? 'زیاد' : value >= 35 ? 'متوسط' : 'کم'
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="text-mute">وابستگی مشتری (در بازی):</span>
      <span className="inline-block w-24 h-2 bg-panel2 rounded-full overflow-hidden align-middle">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </span>
      <b style={{ color }}>{fmt(value)}٪ — {label}</b>
    </span>
  )
}

function Swatch({ color, name, size = 40 }: { color: string; name: string; size?: number }) {
  return (
    <span className="rounded-xl flex items-center justify-center font-black text-black shrink-0" style={{ background: color, width: size, height: size }}>
      {name.slice(0, 1)}
    </span>
  )
}

export function Shop() {
  const game = useStore((s) => s.game)
  const buyIngredient = useStore((s) => s.buyIngredient)
  const sellIngredient = useStore((s) => s.sellIngredient)
  const toast = useStore((s) => s.toast)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState<string>('همه')
  const [qtySel, setQtySel] = useState<Record<string, number>>({})

  const list = INGREDIENTS.filter((i) =>
    (cat === 'همه' || i.category === cat) && (search.trim() === '' || i.name.includes(search.trim())))

  return (
    <div className="space-y-3">
      <Card>
        <div className="font-bold">فروشگاه مواد — روز {fmt(game.day)}</div>
        <p className="text-sm text-mute mt-1">مواد بخر، در «ترکیب» به‌ترتیب بچین. انبار: {fmt(totalWarehouseUnits(game))}/{fmt(storageCap(game))}</p>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی ماده…"
          className="mt-3 w-full bg-panel2 border border-line rounded-xl px-3 py-2.5" />
        <div className="flex flex-wrap gap-2 mt-3">
          {['همه', ...INGREDIENT_CATEGORIES].map((c) => (
            <Btn key={c} color={cat === c ? 'neon' : 'ghost'} onClick={() => setCat(c)}>{c}</Btn>
          ))}
        </div>
      </Card>
      {list.map((ing) => {
        const price = shopPrice(ing, game.day)
        const stock = game.shopStock[ing.id] ?? 0
        const owned = game.ingredients[ing.id] ?? 0
        const maxAfford = Math.max(0, Math.min(stock, Math.floor(game.cash / Math.max(1, price))))
        const q = Math.min(qtySel[ing.id] ?? 1, Math.max(1, maxAfford || 1))
        const diff = price - ing.basePrice
        return (
          <Card key={ing.id}>
            <div className="flex items-center gap-3">
              <Swatch color={ing.color} name={ing.name} />
              <div className="flex-1 min-w-0">
                <div className="font-bold">{ing.name} <span className="text-xs text-mute">{ing.category} • {ing.rarity}</span></div>
                <div className="mt-1"><StatChips stats={ing.buffs} /></div>
              </div>
              <div className="text-left shrink-0">
                <div className="font-black text-neon">{fmt(price)} سکه</div>
                <div className="text-[11px] text-mute">{diff > 0 ? `▲ ${fmt(diff)}` : diff < 0 ? `▼ ${fmt(-diff)}` : 'قیمت پایه'} • موجودی فروشگاه {fmt(stock)}</div>
                <div className="text-[11px] text-mute">در انبار تو: {fmt(owned)}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {[1, 5, 10].map((n) => (
                <Btn key={n} color={q === n ? 'violet' : 'ghost'} onClick={() => setQtySel({ ...qtySel, [ing.id]: n })}>{fmt(n)}</Btn>
              ))}
              <Btn color={q === maxAfford && maxAfford > 0 ? 'violet' : 'ghost'} onClick={() => setQtySel({ ...qtySel, [ing.id]: Math.max(1, maxAfford) })}>حداکثر ({fmt(maxAfford)})</Btn>
              <Btn disabled={stock <= 0 || maxAfford <= 0} onClick={() => {
                const e = buyIngredient(ing.id, q)
                toast(e ?? `${ing.name} ×${fmt(q)} خریده شد.`, e ? 'bad' : 'good')
              }}>خرید ({fmt(price * q)} سکه)</Btn>
              {owned > 0 && (
                <Btn color="danger" onClick={() => {
                  const e = sellIngredient(ing.id, 1)
                  toast(e ?? 'یک واحد با نصف قیمت فروخته شد.', e ? 'bad' : 'good')
                }}>فروش ۱ واحد (نصف قیمت)</Btn>
              )}
            </div>
          </Card>
        )
      })}
      {list.length === 0 && <Card><p className="text-mute">ماده‌ای با این جستجو پیدا نشد.</p></Card>}
    </div>
  )
}

export function IngredientWarehouse() {
  const game = useStore((s) => s.game)
  const entries = Object.entries(game.ingredients).filter(([, n]) => n > 0)
  const totalValue = entries.reduce((a, [id, n]) => a + n * (ingredientById(id)?.basePrice ?? 0), 0)
  return (
    <Card>
      <div className="font-bold mb-1">انبار مواد ({fmt(entries.reduce((a, [, n]) => a + n, 0))} واحد — ارزش تقریبی {fmt(totalValue)} سکه)</div>
      <div className="text-xs text-mute mb-2">ظرفیت کل انبار (محصول + مواد): {fmt(totalWarehouseUnits(game))}/{fmt(storageCap(game))}</div>
      {entries.length === 0 && <p className="text-mute text-sm">ماده‌ای نداری؛ از «فروشگاه» بخر.</p>}
      <div className="grid sm:grid-cols-2 gap-2">
        {entries.map(([id, n]) => {
          const def = ingredientById(id)
          if (!def) return null
          return (
            <div key={id} className="flex items-center gap-2 bg-panel2 rounded-xl p-2">
              <Swatch color={def.color} name={def.name} size={32} />
              <div className="flex-1">
                <div className="text-sm font-bold">{def.name} ×{fmt(n)}</div>
                <StatChips stats={def.buffs} />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export function QuickCraftList() {
  const game = useStore((s) => s.game)
  const craftWithIngredients = useStore((s) => s.craftWithIngredients)
  const toast = useStore((s) => s.toast)
  const [search, setSearch] = useState('')
  const sorted = [...game.discoveries]
    .sort((a, b) => b.value - a.value)
    .filter((d) => {
      const q = search.trim()
      if (!q) return true
      return d.name.includes(q) || d.ingredientIds.some((id) => (ingredientById(id)?.name ?? '').includes(q))
    })
  return (
    <Card>
      <div className="font-bold mb-1">لیست سریع ترکیب‌ها ({fmt(game.discoveries.length)} ترکیب کشف‌شده — مرتب بر اساس ارزش)</div>
      <p className="text-xs text-mute mb-2">یک لمس = ساخت دوباره (بدون پاداش کشف دوم).</p>
      {game.discoveries.length === 0 ? (
        <p className="text-mute text-sm">هنوز ترکیبی کشف نشده — اول یه ترکیب بساز</p>
      ) : (
        <>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو با نام ترکیب یا ماده…"
            className="w-full bg-panel2 border border-line rounded-xl px-3 py-2.5 mb-3" />
          <div className="space-y-2 max-h-[32rem] overflow-y-auto">
            {sorted.map((d) => {
              const check = quickCraftCheck(game, d.baseId, d.ingredientIds)
              const dep = computeCraft(d.baseId, d.ingredientIds).dependency
              const stack = findSpecial(game, d.key)
              const stackQty = game.inventory[d.key]?.qty ?? stack?.qty ?? 0
              return (
                <div key={d.key} className="bg-panel2 rounded-xl p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <b>{d.name}</b>
                    <span className="text-xs text-mute">ارزش {fmt(d.value)} • ساخته‌شده {fmt(d.craftCount ?? 1)} بار • موجودی استک ×{fmt(stackQty)}</span>
                  </div>
                  <div className="text-xs text-mute mt-1">
                    {PRODUCTS.find((p) => p.id === d.baseId)?.name} ← {d.ingredientIds.map((id, i) => `${fmt(i + 1)}. ${ingredientById(id)?.name ?? id}`).join(' ← ')}
                  </div>
                  <div className="mt-1"><StatChips stats={d.stats as Partial<Record<GameStat, number>>} /></div>
                  <div className="mt-1"><DependencyBar value={dep} /></div>
                  {!check.ok && <div className="text-danger text-xs mt-1">کمبود: {check.missing.join('، ')}</div>}
                  <div className="mt-2">
                    <Btn disabled={!check.ok} onClick={() => {
                      const e = craftWithIngredients(d.baseId, d.ingredientIds)
                      toast(e ?? `«${d.name}» در صف ساخت قرار گرفت (${fmt(craftDurationHours(d.ingredientIds.length))} ساعت بازی).`, e ? 'bad' : 'good')
                    }}>ساخت سریع (رایگان — {fmt(craftDurationHours(d.ingredientIds.length))} ساعت بازی)</Btn>
                  </div>
                </div>
              )
            })}
            {sorted.length === 0 && <p className="text-mute text-sm">ترکیبی با این جستجو پیدا نشد.</p>}
          </div>
        </>
      )}
    </Card>
  )
}

export function CraftQueue() {
  const game = useStore((s) => s.game)
  const cancelCrafting = useStore((s) => s.cancelCrafting)
  const toast = useStore((s) => s.toast)
  const queue = game.craftingQueue ?? []
  return (
    <Card>
      <div className="font-bold mb-1">صف ساخت ({fmt(queue.length)}/{fmt(CRAFT_QUEUE_MAX)}) — رایگان، به‌ترتیب انجام می‌شود</div>
      <p className="text-xs text-mute mb-2">لغو = بازگشت کامل مواد.</p>
      {queue.length === 0 && <p className="text-mute text-sm">صف خالی است؛ یک ترکیب بساز تا اینجا دیده شود.</p>}
      <div className="space-y-2">
        {queue.map((job, idx) => {
          const active = idx === 0
          const pct = job.totalHours > 0 ? Math.round(((job.totalHours - job.remainingHours) / job.totalHours) * 100) : 0
          const ings = job.ingredientIds.length
            ? job.ingredientIds.map((id, i) => `${fmt(i + 1)}. ${ingredientById(id)?.name ?? id}`).join(' ← ')
            : job.modifierIds.join('، ')
          return (
            <div key={job.id} className="bg-panel2 rounded-xl p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <b>{fmt(idx + 1)}. «{job.name}»</b>
                <span className={`text-xs rounded-full px-2 py-0.5 border ${active ? 'text-neon border-neon/50 bg-neon/10' : 'text-mute border-line'}`}>
                  {active ? 'در حال ساخت' : 'در انتظار'} • {fmt(job.remainingHours)} ساعت بازی مانده
                </span>
              </div>
              <div className="text-xs text-mute mt-1">{PRODUCTS.find((p) => p.id === job.baseId)?.name} ← {ings}</div>
              {active && (
                <div className="mt-2 h-2 bg-panel rounded-full overflow-hidden">
                  <div className="h-full bg-neon rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}
              <div className="mt-2">
                <Btn color="danger" onClick={() => { cancelCrafting(job.id); toast('ساخت لغو شد و مواد برگشت.', 'info') }}>لغو ساخت (بازگشت مواد)</Btn>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export function Crafting() {
  const game = useStore((s) => s.game)
  const stage = useStore((s) => s.stage)
  const craftWithIngredients = useStore((s) => s.craftWithIngredients)
  const toast = useStore((s) => s.toast)
  const [baseId, setBaseId] = useState('ink')
  const [slots, setSlots] = useState<string[]>([])

  const preview = useMemo(() => (slots.length ? computeCraft(baseId, slots, game.upgrades.quality * 5) : null), [baseId, slots, game.upgrades.quality])
  const knownCombo = preview ? game.discoveries.some((d) => d.key === preview.comboKey) : false
  const ownedEntries = Object.entries(game.ingredients).filter(([, n]) => n > 0)
  const usedCount = (id: string) => slots.filter((s) => s === id).length

  const addSlot = (id: string) => {
    if (slots.length >= 4) { toast('حداکثر ۴ ماده در هر ترکیب.', 'warn'); return }
    if (usedCount(id) >= (game.ingredients[id] ?? 0)) { toast('از این ماده بیشتر در انبار نداری.', 'warn'); return }
    setSlots([...slots, id])
  }
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= slots.length) return
    const next = [...slots]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    setSlots(next)
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="font-bold mb-1">ترکیب با مواد — ترتیب مهم است!</div>
        <p className="text-sm text-mute">۱ محصول پایه + ۱ تا ۴ ماده. خانه اول قوی‌ترین اثر را دارد.</p>
        <details className="text-xs text-mute mt-2">
          <summary className="cursor-pointer text-violet2">جزئیات</summary>
          <p className="mt-1">وزن خانه‌ها: ۱۰۰٪، ۶۰٪، ۳۵٪، ۲۰٪. ماده اول نام و ویژگی اصلی را می‌سازد؛ ماده آخر روی ماندگاری و محبوبیت اثر اضافه دارد. جفت‌های کنار هم هم‌افزایی یا ناسازگاری می‌سازند — «موز ← عسل» با «عسل ← موز» فرق دارد. هر ترکیب تازه «کشف» می‌شود و هنگام آماده‌شدن پاداش می‌دهد.</p>
        </details>
      </Card>
      <Card>
        <div className="font-bold mb-2">۱) محصول پایه (۱ واحد مصرف می‌شود)</div>
        <div className="flex flex-wrap gap-2">
          {PRODUCTS.filter((p) => p.unlockStage <= stage).map((p) => (
            <Btn key={p.id} color={baseId === p.id ? 'neon' : 'ghost'} onClick={() => setBaseId(p.id)}>
              {p.name} (موجودی {fmt(game.inventory[p.id]?.qty ?? 0)})
            </Btn>
          ))}
        </div>
      </Card>
      <Card>
        <div className="font-bold mb-2">۲) خانه‌های مواد (به‌ترتیب) — روی خانه بزن تا حذف شود</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((idx) => {
            const id = slots[idx]
            const def = id ? ingredientById(id) : undefined
            return (
              <div key={idx} className={`rounded-xl border p-2 text-center ${def ? 'border-violet2/60 bg-panel2' : 'border-dashed border-line'}`}>
                <div className="text-[11px] text-mute">خانه {fmt(idx + 1)} — اثر {fmt([100, 60, 35, 20][idx])}٪</div>
                {def ? (
                  <>
                    <button onClick={() => setSlots(slots.filter((_, i) => i !== idx))} className="mt-1 font-bold" title="حذف">
                      <span className="inline-block w-3 h-3 rounded ml-1 align-middle" style={{ background: def.color }} />{def.name}
                    </button>
                    <div className="flex justify-center gap-1 mt-2">
                      <Btn color="ghost" onClick={() => move(idx, -1)}>◀ قبلی</Btn>
                      <Btn color="ghost" onClick={() => move(idx, 1)}>بعدی ▶</Btn>
                    </div>
                  </>
                ) : <div className="text-mute text-sm mt-2">خالی</div>}
              </div>
            )
          })}
        </div>
        {slots.length > 0 && <div className="mt-2"><Btn color="danger" onClick={() => setSlots([])}>پاک‌کردن همه</Btn></div>}
        <div className="font-bold mt-4 mb-2">از انبار اضافه کن:</div>
        {ownedEntries.length === 0 && <p className="text-mute text-sm">انبار مواد خالی است؛ اول از «فروشگاه» خرید کن.</p>}
        <div className="flex flex-wrap gap-2">
          {ownedEntries.map(([id, n]) => {
            const def = ingredientById(id)!
            const left = n - usedCount(id)
            return (
              <Btn key={id} color="ghost" disabled={left <= 0 || slots.length >= 4} onClick={() => addSlot(id)}>
                <span className="inline-block w-3 h-3 rounded ml-1 align-middle" style={{ background: def.color }} />
                {def.name} (باقی‌مانده {fmt(left)})
              </Btn>
            )
          })}
        </div>
      </Card>
      {preview && (
        <Card>
          <div className="font-bold mb-1">پیش‌نمایش: «{preview.name}»</div>
          <div className="mb-2"><StatChips stats={preview.stats} /></div>
          <div className="mb-2"><DependencyBar value={preview.dependency} /></div>
          <div className="text-xs text-mute mb-2">وابستگی بالا: سفارش تکراری بیشتر، رضایت کمتر.</div>
          <div className="text-sm">ارزش تقریبی: <b className="text-neon">{fmt(preview.value)}</b> • کیفیت {fmt(preview.quality)} • کمیابی {fmt(preview.rarity)}/۱۰ • محبوبیت {fmt(preview.popularity)}</div>
          <div className="text-sm text-mute mt-1">
            {preview.synergies.length === 0 && 'هم‌افزایی خاصی برای این ترتیب پیدا نشد.'}
            {preview.synergies.length > 0 && (knownCombo
              ? `هم‌افزایی‌ها: ${[...new Set(preview.synergies.map((s) => s.name))].join('، ')}`
              : `هم‌افزایی ناشناخته ؟؟؟ (${fmt(new Set(preview.synergies.map((s) => s.name)).size)} مورد — بعد از ساخت آشکار می‌شود)`)}
          </div>
          <div className="text-sm text-mute"><b className="text-neon">رایگان</b> • {fmt(craftDurationHours(slots.length))} ساعت بازی • مواد الان مصرف می‌شود {knownCombo ? '• کشف‌شده' : '• کشف تازه = پاداش!'}</div>
          <div className="mt-3">
            <Btn onClick={() => {
              const e = craftWithIngredients(baseId, slots)
              toast(e ?? `در صف ساخت قرار گرفت (${fmt(craftDurationHours(slots.length))} ساعت بازی).`, e ? 'bad' : 'good')
              if (!e) setSlots([])
            }}>شروع ساخت (رایگان)</Btn>
          </div>
        </Card>
      )}
      <CraftQueue />
      <QuickCraftList />
      <Card>
        <div className="font-bold mb-2">دفتر کشف‌ها ({fmt(game.discoveries.length)} ترکیب کشف‌شده)</div>
        {game.discoveries.length === 0 && <p className="text-mute text-sm">هنوز ترکیبی کشف نکرده‌ای. اولین ترکیب را بساز!</p>}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {game.discoveries.map((d) => (
            <div key={d.key} className="bg-panel2 rounded-xl p-2 text-sm">
              <b>{d.name}</b> — ارزش {fmt(d.value)} • روز {fmt(d.day)}
              <div className="text-xs text-mute">{PRODUCTS.find((p) => p.id === d.baseId)?.name} ← {d.ingredientIds.map((id) => ingredientById(id)?.name ?? id).join(' ← ')}</div>
              <StatChips stats={d.stats as Partial<Record<GameStat, number>>} />
              <div className="mt-1"><DependencyBar value={computeCraft(d.baseId, d.ingredientIds).dependency} /></div>
              {d.synergyNames.length > 0 && <div className="text-xs text-violet2 mt-1">هم‌افزایی: {d.synergyNames.join('، ')}</div>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
