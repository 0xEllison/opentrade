'use client'

import { useTradingStore } from '@/store/trading'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

export function PnlChart() {
  const { account } = useTradingStore()
  const history = account.equityHistory

  const data = history.map((h) => ({
    time: new Date(h.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    equity: parseFloat(h.equity.toFixed(2)),
  }))

  const initial = data[0]?.equity ?? 10000
  const current = data[data.length - 1]?.equity ?? initial
  const pnl = current - initial
  const pnlPct = ((pnl / initial) * 100).toFixed(2)

  return (
    <div className="h-full">
      <div className="mb-2 flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">初始资金: ${initial.toLocaleString()}</span>
        <span className={pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
          总盈亏: {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnl >= 0 ? '+' : ''}{pnlPct}%)
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis
            dataKey="time"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            domain={['auto', 'auto']}
            tickFormatter={(v) => `$${v.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(v: number) => [`$${v.toLocaleString()}`, '权益']}
          />
          <ReferenceLine y={initial} stroke="#475569" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="equity"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
