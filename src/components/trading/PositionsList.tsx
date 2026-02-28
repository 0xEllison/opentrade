'use client'

import { useTradingStore } from '@/store/trading'
import { Position } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function PnlCell({ value, pct }: { value: number; pct: number }) {
  const isPos = value >= 0
  return (
    <div className={isPos ? 'text-green-400' : 'text-red-400'}>
      <div className="font-mono text-sm">{isPos ? '+' : ''}{value.toFixed(2)}</div>
      <div className="text-xs">({isPos ? '+' : ''}{pct.toFixed(2)}%)</div>
    </div>
  )
}

export function PositionsList() {
  const { positions, tradingMode, closePositionById } = useTradingStore()
  const activePositions = positions.filter((p) => p.mode === tradingMode)
  const isFutures = tradingMode === 'futures'

  if (activePositions.length === 0) {
    return (
      <div className="text-center text-slate-500 text-sm py-8">
        暂无 {tradingMode === 'spot' ? '现货' : '合约'} 持仓
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400">
            <th className="text-left py-2 px-2">交易对</th>
            <th className="text-left py-2 px-2">方向</th>
            <th className="text-right py-2 px-2">金额(U)</th>
            {isFutures && <th className="text-right py-2 px-2">杠杆</th>}
            <th className="text-right py-2 px-2">开仓价</th>
            <th className="text-right py-2 px-2">{isFutures ? '标记价' : '当前价'}</th>
            {isFutures && <th className="text-right py-2 px-2">强平价</th>}
            <th className="text-right py-2 px-2">未实现盈亏</th>
            <th className="text-right py-2 px-2">止损</th>
            <th className="text-right py-2 px-2">止盈</th>
            <th className="text-right py-2 px-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {activePositions.map((pos) => (
            <tr key={pos.id} className="border-b border-slate-800 hover:bg-slate-800/40">
              <td className="py-2 px-2 font-mono">{pos.symbol}</td>
              <td className="py-2 px-2">
                <Badge
                  variant={pos.direction === 'long' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {pos.direction === 'long'
                    ? (tradingMode === 'spot' ? '买入' : '多')
                    : (tradingMode === 'spot' ? '做空' : '空')}
                </Badge>
              </td>
              <td className="py-2 px-2 text-right">{pos.size.toFixed(0)}</td>
              {isFutures && (
                <td className="py-2 px-2 text-right text-orange-400">{pos.leverage}x</td>
              )}
              <td className="py-2 px-2 text-right font-mono">
                {pos.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
              <td className="py-2 px-2 text-right font-mono">
                {pos.markPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
              {isFutures && (
                <td className="py-2 px-2 text-right font-mono text-orange-400">
                  {pos.liquidationPrice > 0
                    ? pos.liquidationPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : '—'}
                </td>
              )}
              <td className="py-2 px-2 text-right">
                <PnlCell value={pos.unrealizedPnl} pct={pos.unrealizedPnlPct} />
              </td>
              <td className="py-2 px-2 text-right text-red-400">
                {pos.stopLoss ? pos.stopLoss.toFixed(2) : '—'}
              </td>
              <td className="py-2 px-2 text-right text-green-400">
                {pos.takeProfit ? pos.takeProfit.toFixed(2) : '—'}
              </td>
              <td className="py-2 px-2 text-right">
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => closePositionById(pos.id, 'manual')}
                >
                  平仓
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
