'use client'

import { useState } from 'react'
import { useTradingStore } from '@/store/trading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function CapitalSummary() {
  const { account } = useTradingStore()
  const pnlTotal = account.equity - account.totalDeposited + account.totalWithdrawn
  const pnlPct = account.totalDeposited > 0 ? (pnlTotal / account.totalDeposited) * 100 : 0
  const pnlPos = pnlTotal >= 0

  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
      <span className="text-slate-400">权益 <span className="font-mono font-semibold text-slate-200">${account.equity.toFixed(2)}</span></span>
      <span className="text-slate-400">余额 <span className="font-mono font-semibold text-slate-200">${account.balance.toFixed(2)}</span></span>
      <span className="text-slate-400">保证金 <span className="font-mono text-slate-300">${account.usedMargin.toFixed(2)}</span></span>
      <span className={`font-mono font-semibold ${pnlPos ? 'text-green-400' : 'text-red-400'}`}>
        {pnlPos ? '+' : ''}{pnlTotal.toFixed(2)} ({pnlPos ? '+' : ''}{pnlPct.toFixed(1)}%)
      </span>
    </div>
  )
}

export function CapitalManager() {
  const { account, deposit, withdraw } = useTradingStore()
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit')

  const handleSubmit = () => {
    const val = parseFloat(amount)
    if (isNaN(val) || val <= 0) return
    if (mode === 'deposit') {
      deposit(val)
    } else {
      withdraw(val)
    }
    setAmount('')
  }

  const pnlTotal = account.equity - account.totalDeposited + account.totalWithdrawn
  const pnlPct = account.totalDeposited > 0 ? (pnlTotal / account.totalDeposited) * 100 : 0
  const pnlPos = pnlTotal >= 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md bg-slate-800 p-2">
          <div className="text-xs text-slate-400">总权益</div>
          <div className="font-mono font-semibold">${account.equity.toFixed(2)}</div>
        </div>
        <div className="rounded-md bg-slate-800 p-2">
          <div className="text-xs text-slate-400">可用余额</div>
          <div className="font-mono font-semibold">${account.balance.toFixed(2)}</div>
        </div>
        <div className="rounded-md bg-slate-800 p-2">
          <div className="text-xs text-slate-400">已用保证金</div>
          <div className="font-mono">${account.usedMargin.toFixed(2)}</div>
        </div>
        <div className="rounded-md bg-slate-800 p-2">
          <div className="text-xs text-slate-400">总盈亏</div>
          <div className={`font-mono font-semibold ${pnlPos ? 'text-green-400' : 'text-red-400'}`}>
            {pnlPos ? '+' : ''}{pnlTotal.toFixed(2)}
            <span className="text-xs ml-1">({pnlPos ? '+' : ''}{pnlPct.toFixed(2)}%)</span>
          </div>
        </div>
      </div>

      <div className="flex gap-1">
        <Button
          variant={mode === 'deposit' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 text-xs"
          onClick={() => setMode('deposit')}
        >
          充值
        </Button>
        <Button
          variant={mode === 'withdraw' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 text-xs"
          onClick={() => setMode('withdraw')}
        >
          提取
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="金额 (USDT)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={handleSubmit} className="h-8 text-xs px-3">
          确认
        </Button>
      </div>

      <div className="text-xs text-slate-500 space-y-1">
        <div>累计充值: ${account.totalDeposited.toFixed(2)}</div>
        <div>累计提取: ${account.totalWithdrawn.toFixed(2)}</div>
      </div>
    </div>
  )
}
