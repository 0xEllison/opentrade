'use client'

import { useState } from 'react'
import { useTradingStore } from '@/store/trading'
import { Badge } from '@/components/ui/badge'
import { Loader2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { MarketSentiment, RiskLevel } from '@/types'

const SENTIMENT_CONFIG: Record<MarketSentiment, { label: string; color: string }> = {
  bullish: { label: '看涨', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  bearish: { label: '看跌', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  neutral: { label: '中性', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
}

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: '低', color: 'text-green-400' },
  medium: { label: '中', color: 'text-yellow-400' },
  high: { label: '高', color: 'text-orange-400' },
  extreme: { label: '极高', color: 'text-red-400' },
}

const INTERVAL_OPTIONS = [5, 10, 15, 30, 60]

function FearGreedBar({ value }: { value: number }) {
  const color = value <= 25 ? 'text-red-400' : value <= 45 ? 'text-orange-400' : value <= 55 ? 'text-yellow-400' : value <= 75 ? 'text-green-400' : 'text-green-300'
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-slate-500">FGI</span>
      <span className={`text-xs font-bold ${color}`}>{value}</span>
      <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export function StrategyReportSummary() {
  const { strategyReport, isLoadingReport } = useTradingStore()

  if (isLoadingReport && !strategyReport) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>生成中...</span>
      </div>
    )
  }

  if (!strategyReport) {
    return <div className="text-xs text-slate-500 py-1">暂无报告</div>
  }

  const { sentiment, riskLevel, fearGreed, tradingBias, generatedAt } = strategyReport
  const sentimentCfg = SENTIMENT_CONFIG[sentiment]
  const riskCfg = RISK_CONFIG[riskLevel]

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={`text-[10px] px-1.5 py-0 border ${sentimentCfg.color}`}>{sentimentCfg.label}</Badge>
        <span className={`text-[10px] font-semibold ${riskCfg.color}`}>风险{riskCfg.label}</span>
        <FearGreedBar value={fearGreed.value} />
      </div>
      {tradingBias && <p className="text-xs text-slate-400 italic truncate">{tradingBias}</p>}
      <div className="text-[10px] text-slate-600">
        {new Date(generatedAt).toLocaleTimeString('zh-CN')} 更新
        {isLoadingReport && <Loader2 className="inline h-2.5 w-2.5 animate-spin ml-1 text-blue-400" />}
      </div>
    </div>
  )
}

export function StrategyReportPanel({ onRefresh }: { onRefresh: () => void }) {
  const { strategyReport, isLoadingReport, reportIntervalMin, setReportIntervalMin } = useTradingStore()
  const [showNews, setShowNews] = useState(false)

  if (isLoadingReport && !strategyReport) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-slate-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>正在生成策略报告...</span>
      </div>
    )
  }

  if (!strategyReport) {
    return (
      <div className="text-center py-8">
        <div className="text-slate-500 text-sm mb-2">暂无报告</div>
        <button onClick={onRefresh} className="text-xs text-blue-400 hover:text-blue-300">立即生成</button>
      </div>
    )
  }

  const { sentiment, riskLevel, keyEvents, macroFactors, tradingBias, summary, fearGreed, newsItems, generatedAt } = strategyReport
  const sentimentCfg = SENTIMENT_CONFIG[sentiment]
  const riskCfg = RISK_CONFIG[riskLevel]

  return (
    <div className="space-y-3 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`text-xs border ${sentimentCfg.color}`}>{sentimentCfg.label}</Badge>
          <span className={`text-xs font-semibold ${riskCfg.color}`}>风险{riskCfg.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onRefresh} disabled={isLoadingReport}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-300 disabled:opacity-50 transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingReport ? 'animate-spin' : ''}`} />
          </button>
          <select value={reportIntervalMin} onChange={(e) => setReportIntervalMin(Number(e.target.value))}
            className="text-[10px] bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-slate-400 outline-none">
            {INTERVAL_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}分钟</option>
            ))}
          </select>
        </div>
      </div>

      <FearGreedBar value={fearGreed.value} />

      <div className="rounded-md bg-slate-800/50 border border-slate-700 p-2">
        <p className="text-xs text-slate-300 leading-relaxed">{summary}</p>
      </div>

      {keyEvents.length > 0 && (
        <div>
          <span className="text-xs text-slate-400">关键事件</span>
          <ul className="mt-1 space-y-0.5">
            {keyEvents.map((e, i) => (
              <li key={i} className="text-xs text-slate-300 flex gap-1">
                <span className="text-blue-400 shrink-0">•</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {macroFactors && (
        <div>
          <span className="text-xs text-slate-400">宏观因素</span>
          <p className="text-xs text-slate-300 mt-1">{macroFactors}</p>
        </div>
      )}

      {tradingBias && (
        <div>
          <span className="text-xs text-slate-400">交易偏好</span>
          <p className="text-xs text-slate-300 mt-1 italic">{tradingBias}</p>
        </div>
      )}

      {newsItems.length > 0 && (
        <div>
          <button onClick={() => setShowNews(!showNews)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors">
            快讯来源 ({newsItems.length})
            {showNews ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showNews && (
            <ul className="mt-1 space-y-1.5 max-h-40 overflow-y-auto">
              {newsItems.map((n, i) => (
                <li key={i} className="text-xs">
                  <span className={
                    n.source === 'jin10' ? 'text-orange-400' :
                    n.source === 'blockbeats' ? 'text-blue-400' :
                    'text-slate-500'
                  }>
                    [{n.source === 'jin10' ? '金十' : n.source === 'blockbeats' ? '律动' : '宏观'}]
                  </span>{' '}
                  {n.link ? (
                    <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{n.title}</a>
                  ) : (
                    <span className="text-slate-300">{n.title}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="text-[10px] text-slate-600">
        更新于 {new Date(generatedAt).toLocaleString('zh-CN')}
      </div>
    </div>
  )
}
