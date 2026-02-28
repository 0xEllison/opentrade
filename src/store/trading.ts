import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  TradingSymbol,
  TradingMode,
  Leverage,
  Candle,
  Position,
  Order,
  Trade,
  Signal,
  AiAnalysis,
  AccountInfo,
  OpenPositionParams,
  PlaceOrderParams,
  StrategyReport,
  WhaleIntel,
  NewsItem,
} from '@/types'
import {
  openPosition as engineOpen,
  closePosition as engineClose,
  placeOrder as enginePlaceOrder,
  processTick,
  calcUnrealizedPnl,
} from '@/lib/trading/engine'

const INITIAL_BALANCE = 10000

const initialAccount: AccountInfo = {
  balance: INITIAL_BALANCE,
  equity: INITIAL_BALANCE,
  usedMargin: 0,
  unrealizedPnl: 0,
  totalDeposited: INITIAL_BALANCE,
  totalWithdrawn: 0,
  equityHistory: [{ time: Date.now(), equity: INITIAL_BALANCE }],
}

interface TradingStore {
  // Mode
  tradingMode: TradingMode
  selectedInterval: string

  // Market state
  selectedSymbol: TradingSymbol
  selectedLeverage: Leverage
  candles: Record<TradingSymbol, Candle[]>
  markPrices: Record<TradingSymbol, number>

  // Account state
  account: AccountInfo
  positions: Position[]
  orders: Order[]
  trades: Trade[]
  signals: Signal[]

  // UI state
  isAnalyzing: boolean
  autoTradeEnabled: boolean
  strategyReport: StrategyReport | null
  isLoadingReport: boolean
  reportIntervalMin: number
  whaleIntel: WhaleIntel | null
  isLoadingWhales: boolean
  newsItems: NewsItem[]
  isLoadingNews: boolean

  // Actions
  setTradingMode: (mode: TradingMode) => void
  setSelectedInterval: (interval: string) => void
  setSymbol: (s: TradingSymbol) => void
  setLeverage: (l: Leverage) => void
  updateMarkPrice: (symbol: TradingSymbol, price: number) => void
  addCandle: (symbol: TradingSymbol, candle: Candle) => void
  setCandles: (symbol: TradingSymbol, candles: Candle[]) => void

  openPosition: (params: OpenPositionParams) => string | null
  closePositionById: (positionId: string, reason: Trade['closeReason']) => void
  placeOrder: (params: PlaceOrderParams) => string
  cancelOrder: (orderId: string) => void

  addSignal: (signal: Signal) => void
  updateSignalAnalysis: (signalId: string, analysis: AiAnalysis) => void

  setIsAnalyzing: (v: boolean) => void
  setAutoTradeEnabled: (v: boolean) => void
  setStrategyReport: (report: StrategyReport) => void
  setIsLoadingReport: (v: boolean) => void
  setReportIntervalMin: (min: number) => void
  setWhaleIntel: (intel: WhaleIntel) => void
  setIsLoadingWhales: (v: boolean) => void
  setNewsItems: (items: NewsItem[]) => void
  setIsLoadingNews: (v: boolean) => void

  deposit: (amount: number) => void
  withdraw: (amount: number) => void

  tickEngine: (symbol: TradingSymbol, price: number) => void
}

const emptyCandles = (): Record<TradingSymbol, Candle[]> => ({
  BTCUSDT: [],
  ETHUSDT: [],
  SOLUSDT: [],
  BNBUSDT: [],
})

const emptyPrices = (): Record<TradingSymbol, number> => ({
  BTCUSDT: 0,
  ETHUSDT: 0,
  SOLUSDT: 0,
  BNBUSDT: 0,
})

export const useTradingStore = create<TradingStore>()(
  persist(
    (set, get) => ({
      tradingMode: 'spot',
      selectedInterval: '5m',
      selectedSymbol: 'BTCUSDT',
      selectedLeverage: 10,
      candles: emptyCandles(),
      markPrices: emptyPrices(),

      account: initialAccount,
      positions: [],
      orders: [],
      trades: [],
      signals: [],

      isAnalyzing: false,
      autoTradeEnabled: true,
      strategyReport: null,
      isLoadingReport: false,
      reportIntervalMin: 10,
      whaleIntel: null,
      isLoadingWhales: false,
      newsItems: [],
      isLoadingNews: false,

      setTradingMode: (mode) => set({ tradingMode: mode }),
      setSelectedInterval: (interval) => set({ selectedInterval: interval }),
      setSymbol: (s) => set({ selectedSymbol: s }),
      setLeverage: (l) => set({ selectedLeverage: l }),

      setCandles: (symbol, candles) =>
        set((state) => ({
          candles: { ...state.candles, [symbol]: candles },
        })),

      addCandle: (symbol, candle) =>
        set((state) => {
          const existing = state.candles[symbol]
          const last = existing[existing.length - 1]
          let updated: Candle[]
          if (last && last.time === candle.time) {
            updated = [...existing.slice(0, -1), candle]
          } else {
            updated = [...existing, candle].slice(-500)
          }
          return { candles: { ...state.candles, [symbol]: updated } }
        }),

      updateMarkPrice: (symbol, price) =>
        set((state) => ({
          markPrices: { ...state.markPrices, [symbol]: price },
        })),

      openPosition: (params) => {
        const state = get()
        const result = engineOpen(params, state.account)
        if (!result) return null
        const { position, updatedAccount } = result

        const equity = updatedAccount.balance + updatedAccount.usedMargin
        const newAccount = { ...updatedAccount, equity }

        set((s) => ({
          positions: [...s.positions, position],
          account: newAccount,
        }))
        return position.id
      },

      closePositionById: (positionId, reason) => {
        const state = get()
        const position = state.positions.find((p) => p.id === positionId)
        if (!position) return
        const markPrice = state.markPrices[position.symbol] || position.entryPrice
        const { trade, updatedAccount } = engineClose(position, markPrice, reason, state.account)

        const remainingPositions = state.positions.filter((p) => p.id !== positionId)
        const totalUnrealized = remainingPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0)
        const equity = updatedAccount.balance + updatedAccount.usedMargin + totalUnrealized
        const newAccount = {
          ...updatedAccount,
          equity,
          unrealizedPnl: totalUnrealized,
          equityHistory: [
            ...updatedAccount.equityHistory.slice(-200),
            { time: Date.now(), equity },
          ],
        }

        const updatedOrders = state.orders.map((o) =>
          o.positionId === positionId && o.status === 'pending'
            ? { ...o, status: 'cancelled' as const }
            : o
        )

        set({
          positions: remainingPositions,
          trades: [...state.trades, trade],
          account: newAccount,
          orders: updatedOrders,
        })
      },

      placeOrder: (params) => {
        const order = enginePlaceOrder(params)
        set((s) => ({ orders: [...s.orders, order] }))
        return order.id
      },

      cancelOrder: (orderId) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId && o.status === 'pending'
              ? { ...o, status: 'cancelled' as const }
              : o
          ),
        })),

      addSignal: (signal) =>
        set((s) => ({ signals: [signal, ...s.signals].slice(0, 50) })),

      updateSignalAnalysis: (signalId, analysis) =>
        set((s) => ({
          signals: s.signals.map((sig) =>
            sig.id === signalId ? { ...sig, aiAnalysis: analysis } : sig
          ),
        })),

      setIsAnalyzing: (v) => set({ isAnalyzing: v }),
      setAutoTradeEnabled: (v) => set({ autoTradeEnabled: v }),
      setStrategyReport: (report) => set({ strategyReport: report }),
      setIsLoadingReport: (v) => set({ isLoadingReport: v }),
      setReportIntervalMin: (min) => set({ reportIntervalMin: min }),
      setWhaleIntel: (intel) => set({ whaleIntel: intel }),
      setIsLoadingWhales: (v) => set({ isLoadingWhales: v }),
      setNewsItems: (items) => set({ newsItems: items }),
      setIsLoadingNews: (v) => set({ isLoadingNews: v }),

      deposit: (amount) =>
        set((s) => ({
          account: {
            ...s.account,
            balance: s.account.balance + amount,
            equity: s.account.equity + amount,
            totalDeposited: s.account.totalDeposited + amount,
          },
        })),

      withdraw: (amount) =>
        set((s) => {
          if (s.account.balance < amount) return s
          return {
            account: {
              ...s.account,
              balance: s.account.balance - amount,
              equity: s.account.equity - amount,
              totalWithdrawn: s.account.totalWithdrawn + amount,
            },
          }
        }),

      tickEngine: (symbol, price) => {
        const state = get()

        let totalUnrealized = 0
        const updatedPositions = state.positions.map((p) => {
          if (p.symbol !== symbol) {
            totalUnrealized += p.unrealizedPnl
            return p
          }
          const unrealizedPnl = calcUnrealizedPnl(
            p.direction,
            p.entryPrice,
            price,
            p.size,
            p.leverage
          )
          const unrealizedPnlPct = (unrealizedPnl / p.size) * 100
          totalUnrealized += unrealizedPnl
          return { ...p, markPrice: price, unrealizedPnl, unrealizedPnlPct }
        })

        const newEquity = state.account.balance + state.account.usedMargin + totalUnrealized
        const newAccount = {
          ...state.account,
          unrealizedPnl: totalUnrealized,
          equity: newEquity,
        }

        set({ positions: updatedPositions, account: newAccount })

        const { positionsToClose, ordersToFill, stopLossUpdates } = processTick(
          symbol,
          price,
          updatedPositions,
          state.orders
        )

        // Apply trailing stop loss updates
        if (stopLossUpdates.length > 0) {
          set((s) => ({
            positions: s.positions.map((p) => {
              const update = stopLossUpdates.find((u) => u.positionId === p.id)
              return update ? { ...p, stopLoss: update.newStopLoss } : p
            }),
          }))
        }

        for (const { orderId, fillPrice } of ordersToFill) {
          const order = state.orders.find((o) => o.id === orderId)
          if (!order) continue
          if (order.type === 'limit' && !order.positionId) {
            get().openPosition({
              symbol: order.symbol,
              mode: order.mode,
              direction: order.direction,
              size: order.size,
              leverage: order.leverage,
              entryPrice: fillPrice,
            })
          }
          set((s) => ({
            orders: s.orders.map((o) =>
              o.id === orderId
                ? { ...o, status: 'filled' as const, filledAt: Date.now(), filledPrice: fillPrice }
                : o
            ),
          }))
        }

        for (const { positionId, reason } of positionsToClose) {
          get().closePositionById(positionId, reason)
        }
      },
    }),
    {
      name: 'opentrade-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tradingMode: state.tradingMode,
        selectedInterval: state.selectedInterval,
        account: state.account,
        positions: state.positions,
        orders: state.orders,
        trades: state.trades,
        selectedSymbol: state.selectedSymbol,
        selectedLeverage: state.selectedLeverage,
        autoTradeEnabled: state.autoTradeEnabled,
        strategyReport: state.strategyReport,
        reportIntervalMin: state.reportIntervalMin,
      }),
    }
  )
)
