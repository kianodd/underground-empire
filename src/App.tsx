import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUpCircle, Briefcase, Factory, FastForward, LayoutDashboard, ListChecks, Map, Menu, Package,
  Pause, Play, Settings, ShieldAlert, ShoppingBag, Sparkles, Target, Users, Wallet, Wifi, WifiOff, X,
} from 'lucide-react'
import { Customers, Dashboard, Districts, Economy, Inventory, MissionsPage, Production, SalesListPage, Security, SettingsPage, StaffPage, UpgradesPage, fmt } from './ui/Pages'
import { Crafting, Shop } from './ui/ShopCraft'
import { advanceCrafting, ensureListing, useStore } from './game/store'
import { clearSave, deserialize, loadGame, saveGame, serialize } from './game/save'
import { inventoryUnits, netWorth, productName, productValue, storageCap } from './game/economy'
import { heatLevel } from './game/police'
import { stageName } from './game/progression'
import type { GameState } from './game/types'

type Page = 'dashboard' | 'districts' | 'customers' | 'inventory' | 'sales' | 'production' | 'shop' | 'crafting' | 'staff' | 'economy' | 'security' | 'missions' | 'upgrades' | 'settings'

const NAV: Array<{ id: Page; label: string; icon: React.ReactNode }> = [
  { id: 'dashboard', label: 'داشبورد', icon: <LayoutDashboard size={20} /> },
  { id: 'customers', label: 'مشتریان', icon: <Users size={20} /> },
  { id: 'production', label: 'تولید', icon: <Factory size={20} /> },
  { id: 'shop', label: 'فروشگاه', icon: <ShoppingBag size={20} /> },
  { id: 'inventory', label: 'انبار', icon: <Package size={20} /> },
  { id: 'sales', label: 'لیست فروش', icon: <ListChecks size={20} /> },
  { id: 'crafting', label: 'ترکیب', icon: <Sparkles size={20} /> },
  { id: 'districts', label: 'شهر', icon: <Map size={20} /> },
  { id: 'staff', label: 'نیروها', icon: <Briefcase size={20} /> },
  { id: 'economy', label: 'اقتصاد', icon: <Wallet size={20} /> },
  { id: 'security', label: 'امنیت', icon: <ShieldAlert size={20} /> },
  { id: 'missions', label: 'مأموریت‌ها', icon: <Target size={20} /> },
  { id: 'upgrades', label: 'ارتقاها', icon: <ArrowUpCircle size={20} /> },
  { id: 'settings', label: 'تنظیمات', icon: <Settings size={20} /> },
]

/** Offline progress: production + crafting completion, capped at 8 game-hours. */
function applyOfflineProgress(g: GameState): GameState {
  const elapsedSec = Math.floor((Date.now() - (g.lastSavedAt || Date.now())) / 1000)
  const hours = Math.min(8, Math.floor(elapsedSec / 3))
  if (hours <= 0 || (!g.productionQueue.length && !(g.craftingQueue?.length))) return g
  const ng = structuredClone(g)
  // v4: sequential crafting queue advances/completes offline (same 8h cap)
  advanceCrafting(ng, hours)
  for (const job of [...ng.productionQueue]) {
    job.hoursLeft -= hours
    if (job.hoursLeft <= 0) {
      ng.productionQueue = ng.productionQueue.filter((j) => j.id !== job.id)
      const room = Math.max(0, storageCap(ng) - inventoryUnits(ng))
      const add = Math.min(job.qty, room)
      if (add > 0) {
        const ex = ng.inventory[job.productId]
        ng.inventory[job.productId] = { qty: (ex?.qty ?? 0) + add, price: ex?.price ?? productValue(ng, job.productId) }
        ensureListing(ng, job.productId, ng.inventory[job.productId].price)
        ng.eventLog.unshift({ id: `off${job.id}`, day: ng.day, hour: ng.hour, text: `در غیاب تو تولید «${productName(ng, job.productId)}» ×${add} آماده شد.`, kind: 'good' })
      }
    }
  }
  return ng
}

export default function App() {
  const game = useStore((s) => s.game)
  const stage = useStore((s) => s.stage)
  const loaded = useStore((s) => s.loaded)
  const toasts = useStore((s) => s.toasts)
  const tick = useStore((s) => s.tick)
  const setSpeed = useStore((s) => s.setSpeed)
  const setGame = useStore((s) => s.setGame)
  const toast = useStore((s) => s.toast)
  const dismissToast = useStore((s) => s.dismissToast)
  const resetGame = useStore((s) => s.resetGame)
  const importGame = useStore((s) => s.importGame)
  const [page, setPage] = useState<Page>('dashboard')
  const [moreOpen, setMoreOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // load save once
  useEffect(() => {
    let alive = true
    loadGame().then((g) => {
      if (!alive) return
      if (g) setGame(applyOfflineProgress(g))
      else setGame(useStore.getState().game)
    })
    return () => { alive = false }
  }, [setGame])

  // game clock
  useEffect(() => {
    if (!loaded || game.speed === 0) return
    const ms = game.speed === 3 ? 1000 : 3000
    const t = setInterval(tick, ms)
    return () => clearInterval(t)
  }, [loaded, game.speed, tick])

  // autosave: debounced on change + periodic + on hide/unload
  useEffect(() => {
    if (!loaded) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void saveGame(useStore.getState().game) }, 800)
  }, [game, loaded])

  useEffect(() => {
    const periodic = setInterval(() => { void saveGame(useStore.getState().game) }, 15000)
    const onVis = () => { if (document.visibilityState === 'hidden') void saveGame(useStore.getState().game) }
    const onUnload = () => { void saveGame(useStore.getState().game) }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      clearInterval(periodic)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const onExport = useCallback(() => {
    const blob = new Blob([serialize(useStore.getState().game)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'underground-empire-save.json'
    a.click()
    URL.revokeObjectURL(a.href)
    toast('فایل ذخیره دانلود شد.', 'good')
  }, [toast])

  const onImport = useCallback(async (f: File) => {
    const text = await f.text()
    const g = deserialize(text)
    if (!g) { toast('فایل ذخیره معتبر نیست.', 'bad'); return }
    importGame(g)
    void saveGame(g)
    toast('ذخیره بازی وارد شد.', 'good')
  }, [importGame, toast])

  const onReset = useCallback(() => {
    if (!window.confirm('مطمئنی؟ همه پیشرفت بازی پاک می‌شود و از صفر شروع می‌کنی.')) return
    void clearSave()
    resetGame()
    toast('بازی از صفر شروع شد.', 'info')
  }, [resetGame, toast])

  const hl = heatLevel(game.heat)
  const mobileMain = NAV.slice(0, 4)
  const mobileMore = NAV.slice(4)

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />
      case 'districts': return <Districts />
      case 'customers': return <Customers />
      case 'inventory': return <Inventory />
      case 'sales': return <SalesListPage />
      case 'production': return <Production />
      case 'shop': return <Shop />
      case 'crafting': return <Crafting />
      case 'staff': return <StaffPage />
      case 'economy': return <Economy />
      case 'security': return <Security />
      case 'missions': return <MissionsPage />
      case 'upgrades': return <UpgradesPage />
      case 'settings': return <SettingsPage onExport={onExport} onImport={onImport} onReset={onReset} />
    }
  }

  if (!loaded) {
    return <div className="min-h-screen bg-ink flex items-center justify-center text-neon font-black text-xl">در حال بارگذاری امپراتوری زیرزمینی…</div>
  }

  return (
    <div className="min-h-screen bg-ink text-cream font-vazir">
      {/* header */}
      <header className="sticky top-0 z-40 bg-ink/90 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-3 py-2 flex items-center gap-3 flex-wrap">
          <div className="font-black text-neon">امپراتوری زیرزمینی</div>
          <div className="text-sm">روز {fmt(game.day)} • ساعت {fmt(game.hour)}:۰۰</div>
          <div className="text-sm">💰 {fmt(game.cash)}</div>
          <div className="text-sm hidden sm:block">ارزش شبکه: {fmt(netWorth(game))}</div>
          <div className="text-sm hidden sm:block text-violet2">اعتبار {fmt(game.reputation)}</div>
          <div className="text-sm" style={{ color: hl.color }}>Heat {fmt(game.heat)}٪</div>
          <div className="text-sm hidden md:block text-warn">{stageName(stage)}</div>
          <div className="mr-auto flex items-center gap-1">
            <button aria-label="توقف" onClick={() => setSpeed(0)} className={`p-2 rounded-lg ${game.speed === 0 ? 'bg-neon text-black' : 'bg-panel2'}`}><Pause size={16} /></button>
            <button aria-label="سرعت معمولی" onClick={() => setSpeed(1)} className={`p-2 rounded-lg ${game.speed === 1 ? 'bg-neon text-black' : 'bg-panel2'}`}><Play size={16} /></button>
            <button aria-label="سرعت سریع" onClick={() => setSpeed(3)} className={`p-2 rounded-lg ${game.speed === 3 ? 'bg-neon text-black' : 'bg-panel2'}`}><FastForward size={16} /></button>
            <span className="p-2 text-mute" title={online ? 'آنلاین' : 'آفلاین'}>{online ? <Wifi size={16} /> : <WifiOff size={16} />}</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex">
        {/* desktop sidebar */}
        <aside className="hidden md:flex flex-col gap-1 w-52 shrink-0 p-3 sticky top-14 self-start">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-right ${page === n.id ? 'bg-neon text-black font-bold' : 'bg-panel hover:bg-panel2'}`}>
              {n.icon}{n.label}
              {n.id === 'customers' && game.orders.length > 0 && <span className="mr-auto bg-danger text-white text-xs rounded-full px-2">{fmt(game.orders.length)}</span>}
            </button>
          ))}
        </aside>

        <main className="flex-1 p-3 pb-24 md:pb-6 min-w-0">
          <h1 className="font-black text-xl mb-3">{NAV.find((n) => n.id === page)?.label}</h1>
          {renderPage()}
        </main>
      </div>

      {/* mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-panel border-t border-line flex">
        {mobileMain.map((n) => (
          <button key={n.id} onClick={() => { setPage(n.id); setMoreOpen(false) }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] relative ${page === n.id ? 'text-neon' : 'text-mute'}`}>
            {n.icon}{n.label}
            {n.id === 'customers' && game.orders.length > 0 && <span className="absolute top-1 left-3 bg-danger text-white text-[10px] rounded-full px-1.5">{fmt(game.orders.length)}</span>}
          </button>
        ))}
        <button onClick={() => setMoreOpen(!moreOpen)} className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] ${moreOpen ? 'text-neon' : 'text-mute'}`}>
          {moreOpen ? <X size={20} /> : <Menu size={20} />}بیشتر
        </button>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed bottom-16 inset-x-3 z-40 bg-panel border border-line rounded-2xl p-3 grid grid-cols-2 gap-2">
          {mobileMore.map((n) => (
            <button key={n.id} onClick={() => { setPage(n.id); setMoreOpen(false) }}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${page === n.id ? 'bg-neon text-black font-bold' : 'bg-panel2'}`}>
              {n.icon}{n.label}
            </button>
          ))}
        </div>
      )}

      {/* toasts */}
      <div className="fixed bottom-20 md:bottom-4 right-3 z-50 space-y-2 max-w-[90vw]">
        {toasts.map((t) => (
          <div key={t.id} onClick={() => dismissToast(t.id)}
            className={`toast-in cursor-pointer rounded-xl px-4 py-3 text-sm border ${t.kind === 'good' ? 'bg-neon/15 border-neon/50 text-neon' : t.kind === 'bad' ? 'bg-danger/15 border-danger/50 text-danger' : t.kind === 'warn' ? 'bg-warn/15 border-warn/50 text-warn' : 'bg-panel2 border-line'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}
