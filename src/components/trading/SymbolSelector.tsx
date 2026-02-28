'use client'

import { useTradingStore } from '@/store/trading'
import { TradingSymbol, Leverage } from '@/types'
import { Button } from '@/components/ui/button'

const SYMBOLS: TradingSymbol[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
const LEVERAGES: Leverage[] = [10, 20]
const INTERVALS = ['5m', '15m', '30m', '1h', '4h', '1d']

export function SymbolSelector() {
  const {
    selectedSymbol, selectedLeverage, markPrices,
    setSymbol, setLeverage, tradingMode, setTradingMode,
    selectedInterval, setSelectedInterval,
  } = useTradingStore()

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Mode toggle */}
      <div className="flex rounded-md border border-slate-700 overflow-hidden">
        <button
          onClick={() => setTradingMode('spot')}
          className={`px-3 py-1 text-xs font-semibold transition-colors ${
            tradingMode === 'spot' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-400 hover:text-slate-300'
          }`}
        >现货</button>
        <button
          onClick={() => setTradingMode('futures')}
          className={`px-3 py-1 text-xs font-semibold transition-colors ${
            tradingMode === 'futures' ? 'bg-orange-600 text-white' : 'bg-transparent text-slate-400 hover:text-slate-300'
          }`}
        >合约</button>
      </div>

      {/* Symbol selector */}
      <div className="flex gap-1">
        {SYMBOLS.map((s) => (
          <Button key={s} variant={selectedSymbol === s ? 'default' : 'outline'} size="sm"
            onClick={() => setSymbol(s)} className="text-xs h-7 px-2">
            {s.replace('USDT', '')}
            {markPrices[s] > 0 && (
              <span className="ml-1 text-muted-foreground">
                ${markPrices[s].toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Interval selector */}
      <div className="flex rounded-md border border-slate-700 overflow-hidden">
        {INTERVALS.map((iv) => (
          <button key={iv} onClick={() => setSelectedInterval(iv)}
            className={`px-2 py-1 text-xs font-mono transition-colors ${
              selectedInterval === iv
                ? 'bg-slate-600 text-white'
                : 'bg-transparent text-slate-400 hover:text-slate-300'
            }`}>
            {iv}
          </button>
        ))}
      </div>

      {/* Leverage (futures only) */}
      {tradingMode === 'futures' && (
        <div className="flex gap-1">
          {LEVERAGES.map((l) => (
            <Button key={l} variant={selectedLeverage === l ? 'default' : 'outline'} size="sm"
              onClick={() => setLeverage(l)} className="text-xs h-7 px-2">
              {l}x
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
