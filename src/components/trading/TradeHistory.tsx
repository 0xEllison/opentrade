'use client'

import { useTradingStore } from '@/store/trading'
import { Badge } from '@/components/ui/badge'

const CLOSE_REASON_LABELS: Record<string, string> = {
  manual: '手动',
  stop_loss: '止损',
  take_profit: '止盈',
  trailing_stop: '追踪止损',
  liquidation: '强平',
}

export function TradeHistory() {
  const { trades } = useTradingStore()

  if (trades.length === 0) {
    return <div className="text-center text-slate-500 text-sm py-8">暂无历史记录</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400">
            <th className="text-left py-2 px-2">模式</th>
            <th className="text-left py-2 px-2">交易对</th>
            <th className="text-left py-2 px-2">方向</th>
            <th className="text-right py-2 px-2">开仓价</th>
            <th className="text-right py-2 px-2">平仓价</th>
            <th className="text-right py-2 px-2">金额(U)</th>
            <th className="text-right py-2 px-2">杠杆</th>
            <th className="text-right py-2 px-2">实现盈亏</th>
            <th className="text-right py-2 px-2">原因</th>
            <th className="text-right py-2 px-2">时间</th>
          </tr>
        </thead>
        <tbody>
          {[...trades].reverse().map((trade) => {
            const pnlPos = trade.realizedPnl >= 0
            const isSpot = trade.mode === 'spot'
            return (
              <tr key={trade.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                <td className="py-2 px-2">
                  <span className={`text-[10px] font-semibold ${isSpot ? 'text-blue-400' : 'text-orange-400'}`}>
                    {isSpot ? '现货' : '合约'}
                  </span>
                </td>
                <td className="py-2 px-2 font-mono">{trade.symbol}</td>
                <td className="py-2 px-2">
                  <Badge
                    variant={trade.direction === 'long' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {trade.direction === 'long'
                      ? (isSpot ? '买入' : '多')
                      : (isSpot ? '做空' : '空')}
                  </Badge>
                </td>
                <td className="py-2 px-2 text-right font-mono">
                  {trade.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-2 text-right font-mono">
                  {trade.exitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-2 text-right">{trade.size.toFixed(0)}</td>
                <td className="py-2 px-2 text-right">
                  {isSpot ? <span className="text-slate-500">1x</span> : <span className="text-orange-400">{trade.leverage}x</span>}
                </td>
                <td className={`py-2 px-2 text-right font-mono ${pnlPos ? 'text-green-400' : 'text-red-400'}`}>
                  {pnlPos ? '+' : ''}{trade.realizedPnl.toFixed(2)}
                  <span className="text-xs ml-1 opacity-70">
                    ({pnlPos ? '+' : ''}{trade.realizedPnlPct.toFixed(2)}%)
                  </span>
                </td>
                <td className="py-2 px-2 text-right">
                  <Badge
                    variant={trade.closeReason === 'liquidation' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {CLOSE_REASON_LABELS[trade.closeReason]}
                  </Badge>
                </td>
                <td className="py-2 px-2 text-right text-slate-400">
                  <div>{new Date(trade.openTime).toLocaleTimeString('zh-CN')}</div>
                  <div>{new Date(trade.closeTime).toLocaleTimeString('zh-CN')}</div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
