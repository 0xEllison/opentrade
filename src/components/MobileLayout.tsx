'use client'

import { useState } from 'react'
import { CandlestickChart } from '@/components/chart/CandlestickChart'
import { PnlChart } from '@/components/chart/PnlChart'
import { SignalPanel } from '@/components/trading/SignalPanel'
import { IntelCenter } from '@/components/trading/IntelCenter'
import { PositionsList } from '@/components/trading/PositionsList'
import { OrdersList } from '@/components/trading/OrdersList'
import { TradeHistory } from '@/components/trading/TradeHistory'
import { StrategyReportPanel } from '@/components/trading/StrategyReportPanel'
import { CapitalManager } from '@/components/capital/CapitalManager'
import { Badge } from '@/components/ui/badge'
import { BarChart2, Newspaper, Bell, Briefcase, Settings } from 'lucide-react'

type MobileTab = 'chart' | 'intel' | 'signals' | 'positions' | 'more'

interface Props {
  activeCount: number
  pendingOrderCount: number
  fetchReport: () => void
  fetchWhaleIntel: () => void
  fetchNews: () => void
}

export function MobileLayout({ activeCount, pendingOrderCount, fetchReport, fetchWhaleIntel, fetchNews }: Props) {
  const [tab, setTab] = useState<MobileTab>('chart')
  const [subTab, setSubTab] = useState('positions')

  const navItems: { key: MobileTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'chart', label: 'K线', icon: <BarChart2 className="h-5 w-5" /> },
    { key: 'intel', label: '情报', icon: <Newspaper className="h-5 w-5" /> },
    { key: 'signals', label: '信号', icon: <Bell className="h-5 w-5" /> },
    { key: 'positions', label: '持仓', icon: <Briefcase className="h-5 w-5" />, badge: activeCount },
    { key: 'more', label: '更多', icon: <Settings className="h-5 w-5" /> },
  ]

  return (
    <div className="md:hidden flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Content area */}
      <div className="flex-1 overflow-hidden">

        {/* Chart tab */}
        {tab === 'chart' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-hidden">
              <CandlestickChart />
            </div>
          </div>
        )}

        {/* Intel tab */}
        {tab === 'intel' && (
          <div className="h-full overflow-hidden">
            <IntelCenter
              onRefreshReport={fetchReport}
              onRefreshWhales={fetchWhaleIntel}
              onRefreshNews={fetchNews}
            />
          </div>
        )}

        {/* Signals tab */}
        {tab === 'signals' && (
          <div className="h-full overflow-y-auto p-3">
            <SignalPanel />
          </div>
        )}

        {/* Positions tab */}
        {tab === 'positions' && (
          <div className="h-full flex flex-col">
            {/* Sub tabs */}
            <div className="flex border-b border-border shrink-0 overflow-x-auto">
              {[
                { key: 'positions', label: '持仓', badge: activeCount },
                { key: 'orders', label: '委托', badge: pendingOrderCount },
                { key: 'history', label: '历史' },
                { key: 'pnl', label: '收益' },
              ].map((t) => (
                <button key={t.key} onClick={() => setSubTab(t.key)}
                  className={`flex items-center gap-1 px-4 py-2 text-xs shrink-0 border-b-2 transition-colors ${
                    subTab === t.key
                      ? 'border-blue-400 text-blue-400'
                      : 'border-transparent text-slate-400'
                  }`}>
                  {t.label}
                  {t.badge && t.badge > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{t.badge}</Badge>
                  )}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {subTab === 'positions' && <PositionsList />}
              {subTab === 'orders' && <OrdersList />}
              {subTab === 'history' && <TradeHistory />}
              {subTab === 'pnl' && <PnlChart />}
            </div>
          </div>
        )}

        {/* More tab */}
        {tab === 'more' && (
          <div className="h-full flex flex-col">
            <div className="flex border-b border-border shrink-0 overflow-x-auto">
              {[
                { key: 'strategy', label: '市场策略' },
                { key: 'capital', label: '资金管理' },
              ].map((t) => (
                <button key={t.key} onClick={() => setSubTab(t.key)}
                  className={`px-4 py-2 text-xs shrink-0 border-b-2 transition-colors ${
                    subTab === t.key
                      ? 'border-blue-400 text-blue-400'
                      : 'border-transparent text-slate-400'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {subTab === 'strategy' && <StrategyReportPanel onRefresh={fetchReport} />}
              {subTab === 'capital' && <CapitalManager />}
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="shrink-0 border-t border-border bg-background">
        <div className="flex">
          {navItems.map((item) => (
            <button key={item.key} onClick={() => {
              setTab(item.key)
              if (item.key === 'more') setSubTab('strategy')
              if (item.key === 'positions') setSubTab('positions')
            }}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 relative transition-colors ${
                tab === item.key ? 'text-blue-400' : 'text-slate-500'
              }`}>
              {item.icon}
              <span className="text-[10px]">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="absolute top-1.5 right-1/4 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
