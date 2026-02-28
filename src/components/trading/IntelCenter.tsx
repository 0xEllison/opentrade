'use client'

import { useState } from 'react'
import { useTradingStore } from '@/store/trading'
import { Loader2, RefreshCw } from 'lucide-react'

// ── News feed ─────────────────────────────────────────────────────────────────

function NewsFeed() {
  const { newsItems, isLoadingNews } = useTradingStore()
  const items = newsItems

  if (isLoadingNews && items.length === 0) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center text-slate-500 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" /><span>加载中...</span>
      </div>
    )
  }
  if (items.length === 0) return <p className="text-xs text-slate-500 py-6 text-center">暂无快讯</p>

  return (
    <div className="space-y-1.5">
      {items.map((n, i) => {
        const sourceColor =
          n.source === 'jin10' ? 'text-orange-400 bg-orange-400/10' :
          n.source === 'blockbeats' ? 'text-blue-400 bg-blue-400/10' :
          'text-slate-400 bg-slate-400/10'
        const sourceLabel =
          n.source === 'jin10' ? '金十' :
          n.source === 'blockbeats' ? '律动' : '宏观'
        return (
          <div key={i} className="flex gap-2 py-1.5 border-b border-slate-800/60 last:border-0">
            <span className={`text-[9px] px-1 py-0.5 rounded shrink-0 h-fit mt-0.5 font-semibold ${sourceColor}`}>
              {sourceLabel}
            </span>
            <div className="min-w-0">
              {n.link ? (
                <a href={n.link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-slate-200 hover:text-blue-400 leading-snug line-clamp-2 transition-colors">
                  {n.title}
                </a>
              ) : (
                <p className="text-xs text-slate-200 leading-snug line-clamp-2">{n.title}</p>
              )}
              {n.pubDate && (
                <span className="text-[10px] text-slate-600">{n.pubDate}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Whale movements ───────────────────────────────────────────────────────────

function WhaleMovements() {
  const { whaleIntel, isLoadingWhales } = useTradingStore()

  if (isLoadingWhales && !whaleIntel) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center text-slate-500 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" /><span>加载中...</span>
      </div>
    )
  }
  if (!whaleIntel) return <p className="text-xs text-slate-500 py-6 text-center">暂无数据</p>

  const { hlWhales, transfers } = whaleIntel

  // Aggregate HL positions
  const positionSummary: Record<string, { long: number; short: number }> = {}
  for (const w of hlWhales) {
    for (const p of w.positions) {
      if (!positionSummary[p.coin]) positionSummary[p.coin] = { long: 0, short: 0 }
      if (p.direction === 'long') positionSummary[p.coin].long += p.size
      else positionSummary[p.coin].short += p.size
    }
  }
  const coins = Object.entries(positionSummary)
    .sort((a, b) => (b[1].long + b[1].short) - (a[1].long + a[1].short))
    .slice(0, 6)

  return (
    <div className="space-y-3">
      {/* HL aggregate by coin */}
      {coins.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">HL Top10 持仓分布</p>
          <div className="space-y-1.5">
            {coins.map(([coin, { long, short }]) => {
              const total = long + short
              const longPct = total > 0 ? (long / total * 100) : 50
              const totalStr = total >= 1e6 ? `$${(total / 1e6).toFixed(1)}M` : `$${(total / 1000).toFixed(0)}k`
              return (
                <div key={coin} className="space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-300 font-mono">{coin}</span>
                    <div className="flex gap-2">
                      <span className="text-green-400">{longPct.toFixed(0)}%多</span>
                      <span className="text-slate-500">{totalStr}</span>
                    </div>
                  </div>
                  <div className="h-1 bg-red-500/40 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500/70 rounded-full" style={{ width: `${longPct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Individual whale top positions */}
      <div>
        <p className="text-[10px] text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">大户最新开仓</p>
        <div className="space-y-1">
          {(() => {
            const whalePosItems = hlWhales
              .filter((w) => w.positions.length > 0)
              .slice(0, 5)
              .flatMap((w) =>
                w.positions
                  .sort((a, b) => b.size - a.size)
                  .slice(0, 2)
                  .map((p, i) => ({ w, p, key: `${w.fullAddress}-${i}` }))
              )
              .slice(0, 8)

            if (whalePosItems.length > 0) {
              return whalePosItems.map(({ w, p, key }) => {
                const dirColor = p.direction === 'long' ? 'text-green-400' : 'text-red-400'
                const pnlColor = p.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'
                const sizeStr = p.size >= 1e6 ? `$${(p.size / 1e6).toFixed(1)}M` : `$${(p.size / 1000).toFixed(0)}k`
                const pnlStr = p.unrealizedPnl >= 0
                  ? `+$${(p.unrealizedPnl / 1000).toFixed(1)}k`
                  : `-$${(Math.abs(p.unrealizedPnl) / 1000).toFixed(1)}k`
                return (
                  <div key={key} className="flex items-center justify-between text-[10px] py-0.5 border-b border-slate-800/40 last:border-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600">#{w.rank}</span>
                      <span className={`font-semibold ${dirColor}`}>{p.direction === 'long' ? '多' : '空'}</span>
                      <span className="text-slate-300 font-mono">{p.coin}</span>
                      <span className="text-slate-500">{p.leverage}x</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">{sizeStr}</span>
                      <span className={pnlColor}>{pnlStr}</span>
                    </div>
                  </div>
                )
              })
            }

            // Fallback: show L/S ratio as proxy for whale sentiment
            const lsRatios = whaleIntel?.lsRatios ?? []
            if (lsRatios.length > 0) {
              return (
                <div className="space-y-2 pt-0.5">
                  <p className="text-[10px] text-slate-600">HL持仓数据加载中，显示Binance多空比作为参考</p>
                  {lsRatios.map((r) => {
                    const dominant = r.longPct >= r.shortPct ? 'long' : 'short'
                    const domColor = dominant === 'long' ? 'text-green-400' : 'text-red-400'
                    const domLabel = dominant === 'long' ? '偏多' : '偏空'
                    return (
                      <div key={r.symbol} className="flex items-center justify-between text-[10px] py-0.5 border-b border-slate-800/40 last:border-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${domColor}`}>{domLabel}</span>
                          <span className="text-slate-300 font-mono">{r.symbol.replace('USDT', '')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-green-400">{r.longPct.toFixed(1)}%</span>
                          <span className="text-slate-600">/</span>
                          <span className="text-red-400">{r.shortPct.toFixed(1)}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }

            return <p className="text-xs text-slate-600 text-center py-2">暂无持仓数据</p>
          })()}
        </div>
      </div>

      {/* Large transfers */}
      {transfers.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">大额链上转账</p>
          <div className="space-y-1">
            {transfers.slice(0, 6).map((tx) => {
              const typeColor = tx.type === 'exchange_deposit' ? 'text-red-400' : tx.type === 'exchange_withdrawal' ? 'text-green-400' : 'text-slate-400'
              const typeLabel = tx.type === 'exchange_deposit' ? '存入所' : tx.type === 'exchange_withdrawal' ? '提出所' : '转账'
              const amtStr = tx.amountUsd >= 1e6 ? `$${(tx.amountUsd / 1e6).toFixed(1)}M` : `$${(tx.amountUsd / 1000).toFixed(0)}k`
              return (
                <div key={tx.id} className="flex items-center justify-between text-[10px] py-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-mono">{tx.symbol}</span>
                    <span className={typeColor}>{typeLabel}</span>
                  </div>
                  <span className="text-slate-200 font-mono">{amtStr}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Market data ───────────────────────────────────────────────────────────────

function MarketData() {
  const { strategyReport, whaleIntel } = useTradingStore()
  const lsRatios = whaleIntel?.lsRatios ?? []
  const fg = strategyReport?.fearGreed

  return (
    <div className="space-y-3">
      {/* Fear & Greed */}
      {fg && (
        <div className="rounded border border-slate-700 bg-slate-800/40 p-2.5 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">恐惧贪婪指数</span>
            <span className={`text-sm font-bold ${fg.value <= 25 ? 'text-red-400' : fg.value <= 45 ? 'text-orange-400' : fg.value <= 55 ? 'text-yellow-400' : fg.value <= 75 ? 'text-green-400' : 'text-green-300'}`}>
              {fg.value}
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
              style={{ width: `${fg.value}%` }} />
          </div>
          <p className="text-[10px] text-slate-400">{fg.classification}</p>
        </div>
      )}

      {/* Long/Short ratios */}
      {lsRatios.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">Binance 多空比</p>
          <div className="space-y-2">
            {lsRatios.map((r) => (
              <div key={r.symbol} className="space-y-0.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-300">{r.symbol.replace('USDT', '')}</span>
                  <span>
                    <span className="text-green-400">{r.longPct.toFixed(1)}%</span>
                    <span className="text-slate-600 mx-1">/</span>
                    <span className="text-red-400">{r.shortPct.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="h-1.5 bg-red-500/40 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500/70 rounded-full" style={{ width: `${r.longPct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategy summary */}
      {strategyReport && (
        <div className="rounded border border-slate-700 bg-slate-800/40 p-2.5 space-y-1.5">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">AI策略研判</p>
          <p className="text-xs text-slate-300 leading-relaxed">{strategyReport.summary}</p>
          {strategyReport.tradingBias && (
            <p className="text-xs text-blue-400 italic">{strategyReport.tradingBias}</p>
          )}
          {strategyReport.keyEvents.length > 0 && (
            <ul className="space-y-0.5">
              {strategyReport.keyEvents.map((e, i) => (
                <li key={i} className="text-[10px] text-slate-400 flex gap-1">
                  <span className="text-blue-400 shrink-0">•</span><span>{e}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type IntelTab = 'news' | 'whales' | 'market'

export function IntelCenter({ onRefreshReport, onRefreshWhales, onRefreshNews }: {
  onRefreshReport: () => void
  onRefreshWhales: () => void
  onRefreshNews: () => void
}) {
  const [tab, setTab] = useState<IntelTab>('news')
  const { isLoadingReport, isLoadingWhales, isLoadingNews, strategyReport, whaleIntel } = useTradingStore()
  const isLoading = tab === 'news' ? isLoadingNews : tab === 'market' ? isLoadingReport : isLoadingWhales

  const onRefresh = tab === 'news' ? onRefreshNews : tab === 'whales' ? onRefreshWhales : onRefreshReport

  const tabs: { key: IntelTab; label: string }[] = [
    { key: 'news', label: '消息流' },
    { key: 'whales', label: '巨鲸' },
    { key: 'market', label: '市场' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex gap-0.5">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${
                tab === t.key
                  ? 'bg-slate-700 text-slate-100 font-semibold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {isLoading && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 disabled:opacity-40 transition-colors">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Updated time */}
      <div className="px-3 py-1 text-[10px] text-slate-700 border-b border-border/50 shrink-0">
        {tab === 'news'
          ? `每2分钟自动刷新`
          : tab === 'whales' && whaleIntel
          ? `更新 ${new Date(whaleIntel.updatedAt).toLocaleTimeString('zh-CN')}`
          : strategyReport
          ? `更新 ${new Date(strategyReport.generatedAt).toLocaleTimeString('zh-CN')}`
          : ''}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {tab === 'news' && <NewsFeed />}
        {tab === 'whales' && <WhaleMovements />}
        {tab === 'market' && <MarketData />}
      </div>
    </div>
  )
}
