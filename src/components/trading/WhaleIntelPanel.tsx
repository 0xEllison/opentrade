'use client'

import { useState } from 'react'
import { useTradingStore } from '@/store/trading'
import { HLWhale, LongShortRatio, WhaleTransfer } from '@/types'
import { Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

// ── Long/Short ratio bar ──────────────────────────────────────────────────────

function LSBar({ ratio }: { ratio: LongShortRatio }) {
  const longPct = ratio.longPct.toFixed(1)
  const shortPct = ratio.shortPct.toFixed(1)
  const bullish = ratio.longPct >= 50
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-slate-400">{ratio.symbol.replace('USDT', '')}</span>
        <span>
          <span className="text-green-400">{longPct}%多</span>
          <span className="text-slate-600 mx-1">/</span>
          <span className="text-red-400">{shortPct}%空</span>
        </span>
      </div>
      <div className="h-1 bg-red-500/60 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500/80 rounded-full"
          style={{ width: `${ratio.longPct}%` }}
        />
      </div>
      {!bullish && ratio.shortPct - ratio.longPct > 10 && (
        <p className="text-[10px] text-orange-400">空头占优，注意做多风险</p>
      )}
    </div>
  )
}

// ── Single whale card ─────────────────────────────────────────────────────────

function WhaleCard({ whale }: { whale: HLWhale }) {
  const [expanded, setExpanded] = useState(false)
  const pnlColor = whale.allTimePnl >= 0 ? 'text-green-400' : 'text-red-400'
  const pnlStr = whale.allTimePnl >= 0
    ? `+$${(whale.allTimePnl / 1000).toFixed(0)}k`
    : `-$${(Math.abs(whale.allTimePnl) / 1000).toFixed(0)}k`
  const acctStr = `$${(whale.accountValue / 1000).toFixed(0)}k`

  // Summarise positions: dominant direction
  const longs = whale.positions.filter((p) => p.direction === 'long')
  const shorts = whale.positions.filter((p) => p.direction === 'short')
  const longNotional = longs.reduce((s, p) => s + p.size, 0)
  const shortNotional = shorts.reduce((s, p) => s + p.size, 0)
  const dominant = longNotional >= shortNotional ? 'long' : 'short'
  const dominantColor = dominant === 'long' ? 'text-green-400' : 'text-red-400'
  const dominantLabel = dominant === 'long' ? '偏多' : '偏空'

  return (
    <div className="rounded border border-slate-700 bg-slate-800/40 p-2 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">#{whale.rank}</span>
          <span className="font-mono text-xs text-slate-300">{whale.address}</span>
          {whale.positions.length > 0 && (
            <span className={`text-[10px] font-semibold ${dominantColor}`}>{dominantLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono ${pnlColor}`}>{pnlStr}</span>
          <span className="text-[10px] text-slate-500">{acctStr}</span>
          {whale.positions.length > 0 && (
            <button onClick={() => setExpanded(!expanded)} className="text-slate-500 hover:text-slate-300">
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>

      {whale.positions.length === 0 && (
        <p className="text-[10px] text-slate-600">暂无持仓</p>
      )}

      {expanded && whale.positions.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-slate-700/50">
          {whale.positions
            .sort((a, b) => b.size - a.size)
            .slice(0, 6)
            .map((pos, i) => {
              const pnlC = pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'
              const dirC = pos.direction === 'long' ? 'text-green-400' : 'text-red-400'
              const dirL = pos.direction === 'long' ? '多' : '空'
              const sizeStr = pos.size >= 1000000
                ? `$${(pos.size / 1000000).toFixed(1)}M`
                : `$${(pos.size / 1000).toFixed(0)}k`
              const pnlStr2 = pos.unrealizedPnl >= 0
                ? `+$${(pos.unrealizedPnl / 1000).toFixed(1)}k`
                : `-$${(Math.abs(pos.unrealizedPnl) / 1000).toFixed(1)}k`
              return (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-semibold ${dirC}`}>{dirL}</span>
                    <span className="text-slate-300">{pos.coin}</span>
                    <span className="text-slate-500">{pos.leverage}x</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{sizeStr}</span>
                    <span className={pnlC}>{pnlStr2}</span>
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

// ── Whale transfers ───────────────────────────────────────────────────────────

function TransferRow({ tx }: { tx: WhaleTransfer }) {
  const typeLabel =
    tx.type === 'exchange_deposit' ? '存入交易所' :
    tx.type === 'exchange_withdrawal' ? '从交易所提取' : '钱包转账'
  const typeColor =
    tx.type === 'exchange_deposit' ? 'text-red-400' :
    tx.type === 'exchange_withdrawal' ? 'text-green-400' : 'text-slate-400'
  const amtStr = tx.amountUsd >= 1000000
    ? `$${(tx.amountUsd / 1000000).toFixed(1)}M`
    : `$${(tx.amountUsd / 1000).toFixed(0)}k`
  const time = new Date(tx.timestamp * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex items-center justify-between text-[10px] py-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400 font-mono">{tx.symbol}</span>
        <span className={typeColor}>{typeLabel}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-200 font-mono">{amtStr}</span>
        <span className="text-slate-600">{time}</span>
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function WhaleIntelPanel({ onRefresh }: { onRefresh: () => void }) {
  const { whaleIntel, isLoadingWhales } = useTradingStore()
  const [tab, setTab] = useState<'whales' | 'ls' | 'transfers'>('whales')

  if (isLoadingWhales && !whaleIntel) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-slate-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>加载鲸鱼情报...</span>
      </div>
    )
  }

  if (!whaleIntel) {
    return (
      <div className="text-center py-8">
        <div className="text-slate-500 text-sm mb-2">暂无数据</div>
        <button onClick={onRefresh} className="text-xs text-blue-400 hover:text-blue-300">立即加载</button>
      </div>
    )
  }

  const { hlWhales, lsRatios, transfers, updatedAt } = whaleIntel

  // Aggregate HL whale sentiment
  let totalLong = 0, totalShort = 0
  for (const w of hlWhales) {
    for (const p of w.positions) {
      if (p.direction === 'long') totalLong += p.size
      else totalShort += p.size
    }
  }
  const totalNotional = totalLong + totalShort
  const whaleLongPct = totalNotional > 0 ? (totalLong / totalNotional * 100).toFixed(0) : '—'
  const whaleShortPct = totalNotional > 0 ? (totalShort / totalNotional * 100).toFixed(0) : '—'

  return (
    <div className="space-y-3 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-300">鲸鱼情报</span>
        <div className="flex items-center gap-2">
          {isLoadingWhales && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
          <button onClick={onRefresh} disabled={isLoadingWhales}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-300 disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Aggregate sentiment */}
      {totalNotional > 0 && (
        <div className="rounded border border-slate-700 bg-slate-800/40 p-2 space-y-1">
          <div className="text-[10px] text-slate-400">HL Top10 综合仓位</div>
          <div className="flex gap-3 text-xs">
            <span className="text-green-400">多 {whaleLongPct}%</span>
            <span className="text-red-400">空 {whaleShortPct}%</span>
            <span className="text-slate-500">
              总敞口 ${(totalNotional / 1000000).toFixed(1)}M
            </span>
          </div>
          <div className="h-1 bg-red-500/60 rounded-full overflow-hidden">
            <div className="h-full bg-green-500/80 rounded-full" style={{ width: `${whaleLongPct}%` }} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1">
        {(['whales', 'ls', 'transfers'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              tab === t ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {t === 'whales' ? `大户(${hlWhales.length})` : t === 'ls' ? `多空比(${lsRatios.length})` : `大额转账(${transfers.length})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'whales' && (
        <div className="space-y-1.5">
          {hlWhales.length === 0
            ? <p className="text-xs text-slate-500 text-center py-4">暂无数据</p>
            : hlWhales.map((w) => <WhaleCard key={w.fullAddress} whale={w} />)
          }
        </div>
      )}

      {tab === 'ls' && (
        <div className="space-y-2">
          {lsRatios.length === 0
            ? <p className="text-xs text-slate-500 text-center py-4">暂无数据</p>
            : lsRatios.map((r) => <LSBar key={r.symbol} ratio={r} />)
          }
        </div>
      )}

      {tab === 'transfers' && (
        <div className="divide-y divide-slate-700/50">
          {transfers.length === 0
            ? <p className="text-xs text-slate-500 text-center py-4">暂无大额转账数据</p>
            : transfers.map((tx) => <TransferRow key={tx.id} tx={tx} />)
          }
        </div>
      )}

      <div className="text-[10px] text-slate-600">
        更新于 {new Date(updatedAt).toLocaleTimeString('zh-CN')}
      </div>
    </div>
  )
}
