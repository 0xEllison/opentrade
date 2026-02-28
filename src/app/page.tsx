'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTradingStore } from '@/store/trading'
import { BinanceWebSocket } from '@/lib/binance/websocket'
import { fetchKlines } from '@/lib/binance/rest'
import { detectSignals } from '@/lib/trading/signals'
import { analyzeSignal } from '@/lib/zhipuai/client'
import { sendSignalToTelegram } from '@/lib/telegram/notify'
import { TradingSymbol, TradingMode, Candle, Signal, AiAnalysis, StrategyReport } from '@/types'

// ─── Auto-trade decision engine ───────────────────────────────────────────────

type TradeAction = 'open' | 'close_and_open' | 'skip'

interface TradeDecision {
  action: TradeAction
  note: string
}

function decideTrade(
  analysis: AiAnalysis,
  signal: Signal,
  state: ReturnType<typeof useTradingStore.getState>
): TradeDecision {
  const dir = analysis.direction === 'long' ? '多' : '空'
  const riskLevel = state.strategyReport?.riskLevel ?? 'medium'

  // 1. AI 说观望
  if (analysis.direction === 'hold') {
    return { action: 'skip', note: 'AI判断当前观望，不开仓' }
  }

  // 2. 市场风险过高 → 提升置信度门槛
  if (riskLevel === 'extreme' && analysis.confidence < 9) {
    return { action: 'skip', note: `极端风险环境，置信度${analysis.confidence}/10不足以入场(需9+)` }
  }
  if (riskLevel === 'high' && analysis.confidence < 8) {
    return { action: 'skip', note: `高风险环境，置信度${analysis.confidence}/10不足(需8+)` }
  }

  // 3. 基础置信度门槛
  if (analysis.confidence < 6) {
    return { action: 'skip', note: `置信度${analysis.confidence}/10过低，放弃` }
  }

  // 4. 风险收益比检查
  const rr = analysis.riskReward ?? 0
  if (rr > 0 && rr < 1.5) {
    return { action: 'skip', note: `R:R ${rr.toFixed(1)}:1过低(需≥1.5:1)，放弃` }
  }

  // 5. 仓位暴露度检查 — 仓位过重时要求更高置信度
  const { equity, usedMargin } = state.account
  const marginPct = equity > 0 ? (usedMargin / equity) * 100 : 0
  if (marginPct > 60 && analysis.confidence < 8) {
    return { action: 'skip', note: `仓位已占权益${marginPct.toFixed(0)}%，需置信度≥8才加仓` }
  }
  if (marginPct > 80) {
    return { action: 'skip', note: `仓位过重(${marginPct.toFixed(0)}%)，拒绝开仓` }
  }

  // 6. 检查当前符号的现有仓位
  const existingPos = state.positions.find(
    (p) => p.symbol === signal.symbol && p.mode === state.tradingMode
  )

  if (existingPos) {
    if (existingPos.direction === analysis.direction) {
      // 同向持仓 → 不重复开仓，让仓位运行
      const posDir = existingPos.direction === 'long' ? '多' : '空'
      const pnlStr = existingPos.unrealizedPnl >= 0
        ? `+$${existingPos.unrealizedPnl.toFixed(2)}`
        : `-$${Math.abs(existingPos.unrealizedPnl).toFixed(2)}`
      return { action: 'skip', note: `已有${posDir}仓运行中(${pnlStr})，持仓勿动` }
    } else {
      // 反向信号 → 只有置信度≥8 且共振≥3才反手
      const confluence = analysis.confluence ?? 0
      if (analysis.confidence >= 8 && confluence >= 3) {
        return {
          action: 'close_and_open',
          note: `强反转信号(${analysis.confidence}/10，${confluence}指标共振)，平旧仓反手做${dir}`,
        }
      } else {
        return {
          action: 'skip',
          note: `反向${dir}信号不足(置信度${analysis.confidence}/10，共振${confluence}/5)，保留原仓`,
        }
      }
    }
  }

  // 7. 无持仓 → 开新仓
  const rrStr = rr > 0 ? ` R:R ${rr.toFixed(1)}` : ''
  const confluenceStr = analysis.confluence !== undefined ? ` 共振${analysis.confluence}/5` : ''
  return {
    action: 'open',
    note: `开${dir}仓 置信度${analysis.confidence}/10${rrStr}${confluenceStr}`,
  }
}

// ──────────────────────────────────────────────────────────────────────────────

import { CandlestickChart } from '@/components/chart/CandlestickChart'
import { PnlChart } from '@/components/chart/PnlChart'
import { SymbolSelector } from '@/components/trading/SymbolSelector'
import { SignalPanel } from '@/components/trading/SignalPanel'
import { IntelCenter } from '@/components/trading/IntelCenter'
import { MobileLayout } from '@/components/MobileLayout'
import { PositionsList } from '@/components/trading/PositionsList'
import { OrdersList } from '@/components/trading/OrdersList'
import { TradeHistory } from '@/components/trading/TradeHistory'
import { CapitalManager } from '@/components/capital/CapitalManager'
import { StrategyReportPanel } from '@/components/trading/StrategyReportPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

const SYMBOLS: TradingSymbol[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']

export default function TradingPage() {
  const store = useTradingStore()
  const wsRef = useRef<BinanceWebSocket | null>(null)
  const processedSignalIds = useRef(new Set<string>())
  const signalQueueRef = useRef<Signal[]>([])
  const processingRef = useRef(false)

  const { tradingMode, selectedInterval } = useTradingStore((s) => ({
    tradingMode: s.tradingMode,
    selectedInterval: s.selectedInterval,
  }))

  // Load klines for all symbols
  const loadKlines = useCallback(async (mode: TradingMode, interval: string) => {
    for (const symbol of SYMBOLS) {
      try {
        const candles = await fetchKlines(symbol, interval, 200, mode)
        store.setCandles(symbol, candles)
      } catch (e) {
        console.error(`Failed to load klines for ${symbol}`, e)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Connect WebSocket for given mode
  const connectWS = useCallback((mode: TradingMode) => {
    if (wsRef.current) {
      wsRef.current.disconnect()
      wsRef.current = null
    }

    const interval = useTradingStore.getState().selectedInterval
    const ws = new BinanceWebSocket(
      mode,
      SYMBOLS,
      // onKline
      (symbol: TradingSymbol, candle: Candle, isClosed: boolean) => {
        store.addCandle(symbol, candle)
        if (isClosed) {
          const candles = useTradingStore.getState().candles[symbol]
          const newSignals = detectSignals(symbol, candles)
          for (const sig of newSignals) {
            store.addSignal(sig)
            triggerAiAnalysis(sig)
          }
        }
      },
      // onPrice
      (symbol: TradingSymbol, price: number) => {
        store.updateMarkPrice(symbol, price)
        store.tickEngine(symbol, price)
      },
      interval
    )

    ws.connect()
    wsRef.current = ws
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load
  useEffect(() => {
    const state = useTradingStore.getState()
    loadKlines(state.tradingMode, state.selectedInterval)
    connectWS(state.tradingMode)
    return () => {
      wsRef.current?.disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reconnect when tradingMode changes
  const prevModeRef = useRef<TradingMode>(tradingMode)
  useEffect(() => {
    if (prevModeRef.current === tradingMode) return
    prevModeRef.current = tradingMode
    console.log(`[Mode] Switching to ${tradingMode}`)
    loadKlines(tradingMode, selectedInterval)
    connectWS(tradingMode)
  }, [tradingMode, loadKlines, connectWS])

  // Reload klines and reconnect WS when interval changes
  useEffect(() => {
    const mode = useTradingStore.getState().tradingMode
    loadKlines(mode, selectedInterval)
    connectWS(mode)
  }, [selectedInterval, loadKlines, connectWS])

  // Fetch strategy report periodically
  const fetchReport = useCallback(async () => {
    store.setIsLoadingReport(true)
    try {
      const res = await fetch('/api/strategy-report')
      if (res.ok) {
        const report: StrategyReport = await res.json()
        store.setStrategyReport(report)
      }
    } catch (e) {
      console.error('[StrategyReport] Fetch failed', e)
    } finally {
      store.setIsLoadingReport(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const reportIntervalMin = useTradingStore((s) => s.reportIntervalMin)
  useEffect(() => {
    fetchReport()
    const interval = setInterval(fetchReport, reportIntervalMin * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchReport, reportIntervalMin])

  // Fetch whale intel periodically (every 5 minutes)
  const fetchWhaleIntel = useCallback(async () => {
    store.setIsLoadingWhales(true)
    try {
      const res = await fetch('/api/whale-intel')
      if (res.ok) {
        const intel = await res.json()
        store.setWhaleIntel(intel)
      }
    } catch (e) {
      console.error('[WhaleIntel] Fetch failed', e)
    } finally {
      store.setIsLoadingWhales(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchWhaleIntel()
    const interval = setInterval(fetchWhaleIntel, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchWhaleIntel])

  // Fetch news independently every 2 minutes
  const fetchNews = useCallback(async () => {
    store.setIsLoadingNews(true)
    try {
      const res = await fetch('/api/news')
      if (res.ok) {
        const data = await res.json()
        store.setNewsItems(data.items ?? [])
      }
    } catch (e) {
      console.error('[News] Fetch failed', e)
    } finally {
      store.setIsLoadingNews(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchNews()
    const interval = setInterval(fetchNews, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchNews])

  // Signal analysis queue
  const processSignalQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    while (signalQueueRef.current.length > 0) {
      const signal = signalQueueRef.current.shift()!
      store.setIsAnalyzing(true)

      // Small delay between analyses to avoid rate-limiting ZhipuAI
      await new Promise((r) => setTimeout(r, 800))

      try {
        const state = useTradingStore.getState()
        const candles = state.candles[signal.symbol]
        const currentPrice = signal.price
        const candle1hAgo = candles[Math.max(0, candles.length - 60)]
        const candle24hAgo = candles[Math.max(0, candles.length - 1440)]
        const change1h = candle1hAgo ? ((currentPrice - candle1hAgo.close) / candle1hAgo.close) * 100 : 0
        const change24h = candle24hAgo ? ((currentPrice - candle24hAgo.close) / candle24hAgo.close) * 100 : 0

        const report = state.strategyReport
        const mode = state.tradingMode
        let strategyContext: string | undefined
        if (report) {
          strategyContext = `交易模式: ${mode === 'spot' ? '现货(无杠杆)' : `合约(${state.selectedLeverage}x杠杆)`}, 市场情绪: ${report.sentiment}, 风险等级: ${report.riskLevel}, 恐惧贪婪指数: ${report.fearGreed.value}/100 (${report.fearGreed.classification}), 交易偏好: ${report.tradingBias}, 宏观因素: ${report.macroFactors}`
        }

        const analysis = await analyzeSignal(signal, change1h, change24h, strategyContext)
        if (!analysis) continue

        store.updateSignalAnalysis(signal.id, analysis)

        const latestState = useTradingStore.getState()

        if (!latestState.autoTradeEnabled) continue

        // ── Decision engine ─────────────────────────────────────────
        const decision = decideTrade(analysis, signal, latestState)

        if (decision.action === 'skip') {
          const finalAnalysis = {
            ...analysis,
            decisionNote: decision.note,
            decisionAction: 'skip' as const,
          }
          store.updateSignalAnalysis(signal.id, finalAnalysis)
          continue
        }

        // Close existing position first (close_and_open case)
        if (decision.action === 'close_and_open') {
          const pos = useTradingStore.getState().positions.find(
            (p) => p.symbol === signal.symbol && p.mode === latestState.tradingMode
          )
          if (pos) useTradingStore.getState().closePositionById(pos.id, 'manual')
        }

        // Open new position
        const freshState = useTradingStore.getState()
        const tradeSize = Math.min(freshState.account.balance * 0.1, 500)
        const leverage = freshState.tradingMode === 'spot' ? 1 : freshState.selectedLeverage

        if (tradeSize >= 10 && analysis.direction !== 'hold') {
          // Use current market price as actual entry (AI's price may be stale after API round-trip)
          const actualEntry = freshState.markPrices[signal.symbol] || analysis.entryPrice
          const isLong = analysis.direction === 'long'
          const atr = signal.indicators.atr || actualEntry * 0.005  // fallback: 0.5% of price

          // SL must be in correct direction AND at least 0.5× ATR away from entry
          // — prevents instant-trigger from stale AI price or market microstructure noise
          const slDistanceOk = isLong
            ? actualEntry - analysis.stopLoss >= atr * 0.5
            : analysis.stopLoss - actualEntry >= atr * 0.5
          const validSL = analysis.stopLoss > 0 && slDistanceOk

          // TP must be in correct direction AND at least 1× ATR away from entry
          const tpDistanceOk = isLong
            ? analysis.takeProfit - actualEntry >= atr
            : actualEntry - analysis.takeProfit >= atr
          const validTP = analysis.takeProfit > 0 && tpDistanceOk

          const posId = freshState.openPosition({
            symbol: signal.symbol,
            mode: freshState.tradingMode,
            direction: analysis.direction,
            size: tradeSize,
            leverage,
            entryPrice: actualEntry,
            stopLoss: validSL ? analysis.stopLoss : undefined,
            takeProfit: validTP ? analysis.takeProfit : undefined,
            trailingStop: atr,  // store ATR for trailing stop logic
          })

          // Build note suffix if SL/TP were sanitized
          const sanitizeNote = [
            !validSL && analysis.stopLoss > 0 ? 'SL方向错误已忽略' : '',
            !validTP && analysis.takeProfit > 0 ? 'TP方向错误已忽略' : '',
          ].filter(Boolean).join('，')

          const finalAnalysis = {
            ...analysis,
            // Overwrite with actual values used — prevents misleading display
            entryPrice: actualEntry,
            stopLoss: validSL ? analysis.stopLoss : 0,
            takeProfit: validTP ? analysis.takeProfit : 0,
            autoTraded: !!posId,
            decisionNote: decision.note + (sanitizeNote ? `（${sanitizeNote}）` : ''),
            decisionAction: (posId ? decision.action : 'skip') as AiAnalysis['decisionAction'],
          }

          store.updateSignalAnalysis(signal.id, finalAnalysis)
          sendSignalToTelegram(signal, finalAnalysis)
        }
      } catch (e) {
        console.error('[AI] Analysis failed', e)
      }
    }

    store.setIsAnalyzing(false)
    processingRef.current = false
  }, [store])

  const triggerAiAnalysis = useCallback((signal: Signal) => {
    if (processedSignalIds.current.has(signal.id)) return
    processedSignalIds.current.add(signal.id)
    signalQueueRef.current.push(signal)
    processSignalQueue()
  }, [processSignalQueue])

  const { positions, orders, trades, account, autoTradeEnabled, setAutoTradeEnabled, selectedSymbol, markPrices } = store

  const activeCount = positions.filter((p) => p.mode === tradingMode).length
  const pendingOrderCount = orders.filter((o) => o.status === 'pending' && o.mode === tradingMode).length

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-blue-400">OpenTrade</h1>
          <div className="hidden md:block"><SymbolSelector /></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs">
            <span className="text-slate-400">余额 </span>
            <span className="font-mono font-semibold">${account.balance.toFixed(2)}</span>
            <span className="hidden sm:inline text-slate-400 ml-2">权益 </span>
            <span className={`hidden sm:inline font-mono font-semibold ${account.equity >= account.totalDeposited - account.totalWithdrawn ? 'text-green-400' : 'text-red-400'}`}>
              ${account.equity.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 hidden sm:inline">AI自动</span>
            <Switch checked={autoTradeEnabled} onCheckedChange={setAutoTradeEnabled} />
            <Badge variant={autoTradeEnabled ? 'default' : 'secondary'} className="text-xs px-1.5 py-0">
              {autoTradeEnabled ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>
      </header>

      {/* Mobile: symbol selector row */}
      <div className="md:hidden px-2 py-1.5 border-b border-border shrink-0 overflow-x-auto">
        <SymbolSelector />
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden md:flex flex-1 overflow-hidden min-h-0">
        {/* Left area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-border">
          {/* Top 60%: Chart + Intel */}
          <div className="flex border-b border-border" style={{ height: '60%' }}>
            <div className="w-1/2 border-r border-border overflow-hidden">
              <CandlestickChart />
            </div>
            <div className="w-1/2 overflow-hidden">
              <IntelCenter onRefreshReport={fetchReport} onRefreshWhales={fetchWhaleIntel} onRefreshNews={fetchNews} />
            </div>
          </div>
          {/* Bottom 40%: Tabs */}
          <div className="flex flex-col overflow-hidden" style={{ height: '40%' }}>
            <Tabs defaultValue="positions" className="flex flex-col h-full">
              <TabsList className="shrink-0 w-full justify-start h-7 gap-0 p-0.5 rounded-none border-b border-border bg-transparent">
                <TabsTrigger value="positions" className="text-xs h-6 px-3 rounded">
                  持仓{activeCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">{activeCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="orders" className="text-xs h-6 px-3 rounded">
                  委托{pendingOrderCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">{pendingOrderCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs h-6 px-3 rounded">历史</TabsTrigger>
                <TabsTrigger value="pnl" className="text-xs h-6 px-3 rounded">收益</TabsTrigger>
                <TabsTrigger value="strategy" className="text-xs h-6 px-3 rounded">策略</TabsTrigger>
                <TabsTrigger value="capital" className="text-xs h-6 px-3 rounded">资金</TabsTrigger>
              </TabsList>
              <div className="flex-1 overflow-y-auto">
                <TabsContent value="positions" className="mt-0 h-full"><PositionsList /></TabsContent>
                <TabsContent value="orders" className="mt-0"><OrdersList /></TabsContent>
                <TabsContent value="history" className="mt-0"><TradeHistory /></TabsContent>
                <TabsContent value="pnl" className="mt-0 h-full"><PnlChart /></TabsContent>
                <TabsContent value="strategy" className="mt-0"><StrategyReportPanel onRefresh={fetchReport} /></TabsContent>
                <TabsContent value="capital" className="mt-0"><CapitalManager /></TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
        {/* Right: Signal panel */}
        <div className="w-72 shrink-0 overflow-hidden">
          <div className="h-full overflow-hidden p-3">
            <SignalPanel />
          </div>
        </div>
      </div>

      {/* ── Mobile layout ── */}
      <MobileLayout
        activeCount={activeCount}
        pendingOrderCount={pendingOrderCount}
        fetchReport={fetchReport}
        fetchWhaleIntel={fetchWhaleIntel}
        fetchNews={fetchNews}
      />
    </div>
  )
}
