'use client'

import { useTradingStore } from '@/store/trading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const TYPE_LABELS: Record<string, string> = {
  market: '市价',
  limit: '限价',
  stop_market: '止损',
  take_profit_market: '止盈',
}

export function OrdersList() {
  const { orders, tradingMode, cancelOrder } = useTradingStore()
  const pendingOrders = orders.filter(
    (o) => o.status === 'pending' && o.mode === tradingMode
  )

  if (pendingOrders.length === 0) {
    return (
      <div className="text-center text-slate-500 text-sm py-8">
        暂无 {tradingMode === 'spot' ? '现货' : '合约'} 委托单
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400">
            <th className="text-left py-2 px-2">交易对</th>
            <th className="text-left py-2 px-2">类型</th>
            <th className="text-left py-2 px-2">方向</th>
            <th className="text-right py-2 px-2">价格</th>
            <th className="text-right py-2 px-2">金额(U)</th>
            {tradingMode === 'futures' && <th className="text-right py-2 px-2">杠杆</th>}
            <th className="text-right py-2 px-2">时间</th>
            <th className="text-right py-2 px-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {pendingOrders.map((order) => (
            <tr key={order.id} className="border-b border-slate-800 hover:bg-slate-800/40">
              <td className="py-2 px-2 font-mono">{order.symbol}</td>
              <td className="py-2 px-2">{TYPE_LABELS[order.type]}</td>
              <td className="py-2 px-2">
                <Badge
                  variant={order.direction === 'long' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {order.direction === 'long'
                    ? (tradingMode === 'spot' ? '买入' : '多')
                    : (tradingMode === 'spot' ? '做空' : '空')}
                </Badge>
              </td>
              <td className="py-2 px-2 text-right font-mono">
                {order.price
                  ? order.price.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : order.triggerPrice
                  ? order.triggerPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : '市价'}
              </td>
              <td className="py-2 px-2 text-right">{order.size.toFixed(0)}</td>
              {tradingMode === 'futures' && (
                <td className="py-2 px-2 text-right text-orange-400">{order.leverage}x</td>
              )}
              <td className="py-2 px-2 text-right text-slate-400">
                {new Date(order.createdAt).toLocaleTimeString('zh-CN')}
              </td>
              <td className="py-2 px-2 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => cancelOrder(order.id)}
                >
                  取消
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
