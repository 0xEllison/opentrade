'use client'

import { useTradingStore } from '@/store/trading'
import { Signal, SignalType } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

const SIGNAL_LABELS: Record<SignalType, string> = {
  golden_cross: '金叉',
  death_cross: '死叉',
  rsi_oversold: 'RSI超卖',
  rsi_overbought: 'RSI超买',
  macd_bullish: 'MACD金叉',
  macd_bearish: 'MACD死叉',
  bb_breakout_up: 'BB上轨突破',
  bb_breakout_down: 'BB下轨跌破',
  volume_surge: '量能异动',
}

const SIGNAL_COLORS: Record<SignalType, string> = {
  golden_cross: 'text-green-400',
  death_cross: 'text-red-400',
  rsi_oversold: 'text-blue-400',
  rsi_overbought: 'text-orange-400',
  macd_bullish: 'text-green-400',
  macd_bearish: 'text-red-400',
  bb_breakout_up: 'text-emerald-400',
  bb_breakout_down: 'text-rose-400',
  volume_surge: 'text-purple-400',
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 8 ? 'bg-green-500' :
    value >= 6 ? 'bg-yellow-500' :
    value >= 4 ? 'bg-orange-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 10}%` }} />
      </div>
      <span className="text-xs font-bold text-yellow-400 w-5 text-right">{value}</span>
    </div>
  )
}

function SignalCard({ signal }: { signal: Signal }) {
  const ai = signal.aiAnalysis
  const ind = signal.indicators
  const directionColor =
    ai?.direction === 'long' ? 'text-green-400' :
    ai?.direction === 'short' ? 'text-red-400' : 'text-yellow-400'
  const directionLabel =
    ai?.direction === 'long' ? '做多 ▲' :
    ai?.direction === 'short' ? '做空 ▼' : '观望 —'
  const timeframeLabel =
    ai?.timeframe === 'short' ? '短线' :
    ai?.timeframe === 'medium' ? '波段' :
    ai?.timeframe === 'long' ? '长线' : ''

  const bbPct = ind.bbUpper > 0 && ind.bbLower > 0
    ? ((signal.price - ind.bbLower) / (ind.bbUpper - ind.bbLower) * 100).toFixed(0)
    : null

  // Decision badge config
  const decisionConfig = ai?.decisionAction === 'open'
    ? { label: '已开仓', color: 'bg-green-900/50 text-green-400 border-green-800' }
    : ai?.decisionAction === 'close_and_open'
    ? { label: '反手开仓', color: 'bg-purple-900/50 text-purple-400 border-purple-800' }
    : ai?.decisionAction === 'skip'
    ? { label: '跳过', color: 'bg-slate-800 text-slate-500 border-slate-700' }
    : null

  return (
    <div className="rounded-md border border-slate-700 bg-slate-800/50 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400">{signal.symbol}</span>
          <span className={`text-xs font-semibold ${SIGNAL_COLORS[signal.type]}`}>
            {SIGNAL_LABELS[signal.type]}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {new Date(signal.time * 1000).toLocaleTimeString('zh-CN')}
        </span>
      </div>

      {/* Core indicators */}
      <div className="text-xs text-slate-400 grid grid-cols-3 gap-x-2 gap-y-0.5">
        <span>价格: <span className="text-slate-200">${signal.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
        <span>RSI: <span className={ind.rsi < 30 ? 'text-blue-400' : ind.rsi > 70 ? 'text-orange-400' : 'text-slate-200'}>{ind.rsi.toFixed(1)}</span></span>
        <span>量比: <span className={ind.volumeRatio > 2 ? 'text-purple-400' : 'text-slate-200'}>{ind.volumeRatio > 0 ? `${ind.volumeRatio.toFixed(1)}x` : 'N/A'}</span></span>
        {bbPct !== null && (
          <span>BB位: <span className="text-slate-200">{bbPct}%</span></span>
        )}
        {ind.atr > 0 && (
          <span>ATR: <span className="text-slate-200">{ind.atr.toFixed(2)}</span></span>
        )}
        <span>EMA: <span className={ind.ema7 > ind.ema25 ? 'text-green-400' : 'text-red-400'}>{ind.ema7 > ind.ema25 ? '多排' : '空排'}</span></span>
      </div>

      {/* AI Analysis */}
      {ai ? (
        <div className="space-y-1.5 border-t border-slate-700 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-bold text-sm ${directionColor}`}>{directionLabel}</span>
            {timeframeLabel && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 border-slate-600 text-slate-400">{timeframeLabel}</Badge>
            )}
            {ai.confluence !== undefined && (
              <span className="text-[10px] text-slate-500">共振{ai.confluence}/5</span>
            )}
            {/* Decision badge */}
            {decisionConfig && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${decisionConfig.color}`}>
                {decisionConfig.label}
              </span>
            )}
          </div>

          <ConfidenceBar value={ai.confidence} />

          <div className="text-xs flex gap-3 flex-wrap">
            <span className="text-slate-400">入场: <span className="text-slate-200">${ai.entryPrice.toFixed(2)}</span></span>
            <span className="text-red-400">SL: {ai.stopLoss > 0 ? `$${ai.stopLoss.toFixed(2)}` : '—'}</span>
            <span className="text-green-400">TP: {ai.takeProfit > 0 ? `$${ai.takeProfit.toFixed(2)}` : '—'}</span>
            {ai.riskReward !== undefined && ai.riskReward > 0 && (
              <span className={`text-xs ${ai.riskReward >= 2 ? 'text-green-400' : 'text-orange-400'}`}>
                R:R {ai.riskReward.toFixed(1)}
              </span>
            )}
          </div>

          {/* AI reasoning */}
          <p className="text-xs text-slate-300 leading-relaxed">{ai.reasoning}</p>

          {/* Decision note — show even when skipped */}
          {ai.decisionNote && (
            <div className={`text-[10px] px-2 py-1 rounded leading-relaxed ${
              ai.decisionAction === 'open' || ai.decisionAction === 'close_and_open'
                ? 'bg-green-950/40 text-green-400'
                : 'bg-slate-900/60 text-slate-500'
            }`}>
              决策: {ai.decisionNote}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>AI分析中...</span>
        </div>
      )}
    </div>
  )
}

export function SignalPanel() {
  const { signals, isAnalyzing } = useTradingStore()

  return (
    <div className="h-full overflow-y-auto space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-300">操盘信号日志</span>
        {isAnalyzing && (
          <div className="flex items-center gap-1 text-xs text-blue-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>AI分析中</span>
          </div>
        )}
      </div>
      {signals.length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-8">
          等待信号触发...
        </div>
      ) : (
        signals.map((s) => <SignalCard key={s.id} signal={s} />)
      )}
    </div>
  )
}
