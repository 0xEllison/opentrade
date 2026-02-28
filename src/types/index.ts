export type TradingSymbol = 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT' | 'BNBUSDT'
export type TradingMode = 'spot' | 'futures'
export type Direction = 'long' | 'short'
export type Leverage = 1 | 10 | 20
export type OrderType = 'market' | 'limit' | 'stop_market' | 'take_profit_market'
export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'expired'
export type SignalType =
  | 'golden_cross'
  | 'death_cross'
  | 'rsi_oversold'
  | 'rsi_overbought'
  | 'macd_bullish'
  | 'macd_bearish'
  | 'bb_breakout_up'
  | 'bb_breakout_down'
  | 'volume_surge'

export interface Candle {
  time: number       // unix seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Position {
  id: string
  symbol: TradingSymbol
  mode: TradingMode
  direction: Direction
  size: number           // USDT margin
  leverage: Leverage
  entryPrice: number
  markPrice: number
  liquidationPrice: number  // 0 for spot (no liquidation)
  stopLoss?: number
  takeProfit?: number
  trailingStop?: number
  unrealizedPnl: number
  unrealizedPnlPct: number
  openTime: number
}

export interface Order {
  id: string
  symbol: TradingSymbol
  mode: TradingMode
  type: OrderType
  direction: Direction
  price?: number
  triggerPrice?: number
  size: number
  leverage: Leverage
  status: OrderStatus
  createdAt: number
  filledAt?: number
  filledPrice?: number
  positionId?: string
}

export interface Trade {
  id: string
  symbol: TradingSymbol
  mode: TradingMode
  direction: Direction
  entryPrice: number
  exitPrice: number
  size: number
  leverage: Leverage
  realizedPnl: number
  realizedPnlPct: number
  openTime: number
  closeTime: number
  closeReason: 'manual' | 'stop_loss' | 'take_profit' | 'trailing_stop' | 'liquidation'
}

export interface Signal {
  id: string
  symbol: TradingSymbol
  type: SignalType
  time: number
  price: number
  indicators: {
    ema7: number
    ema25: number
    rsi: number
    macd: number
    macdSignal: number
    bbUpper: number
    bbMiddle: number
    bbLower: number
    atr: number
    volumeRatio: number
  }
  aiAnalysis?: AiAnalysis
}

export interface AiAnalysis {
  direction: Direction | 'hold'
  confidence: number
  entryPrice: number
  stopLoss: number
  takeProfit: number
  reasoning: string
  autoTraded: boolean
  confluence?: number
  riskReward?: number
  timeframe?: 'short' | 'medium' | 'long'
  // Decision outcome when autoTradeEnabled
  decisionNote?: string   // e.g. "已有多仓，持仓中" / "入场：置信度8/10"
  decisionAction?: 'open' | 'close_and_open' | 'skip' | 'pending'
}

export interface AccountInfo {
  balance: number
  equity: number
  usedMargin: number
  unrealizedPnl: number
  totalDeposited: number
  totalWithdrawn: number
  equityHistory: { time: number; equity: number }[]
}

export interface OpenPositionParams {
  symbol: TradingSymbol
  mode: TradingMode
  direction: Direction
  size: number
  leverage: Leverage
  entryPrice: number
  stopLoss?: number
  takeProfit?: number
  trailingStop?: number
}

export interface PlaceOrderParams {
  symbol: TradingSymbol
  mode: TradingMode
  type: OrderType
  direction: Direction
  price?: number
  triggerPrice?: number
  size: number
  leverage: Leverage
  positionId?: string
}

export interface HLWhalePos {
  coin: string
  direction: 'long' | 'short'
  size: number        // USD notional
  entryPrice: number
  unrealizedPnl: number
  leverage: number
}

export interface HLWhale {
  address: string     // shortened display
  fullAddress: string
  rank: number
  allTimePnl: number
  accountValue: number
  positions: HLWhalePos[]
  updatedAt: number
}

export interface LongShortRatio {
  symbol: string
  longPct: number
  shortPct: number
}

export interface WhaleTransfer {
  id: string
  symbol: string
  amountUsd: number
  from: string
  to: string
  type: 'exchange_deposit' | 'exchange_withdrawal' | 'wallet_transfer'
  timestamp: number
  txHash: string
}

export interface WhaleIntel {
  hlWhales: HLWhale[]
  lsRatios: LongShortRatio[]
  transfers: WhaleTransfer[]
  updatedAt: number
}

export interface NewsItem {
  title: string
  source: 'jin10' | 'jin10-macro' | 'blockbeats'
  pubDate: string
  summary: string
  link: string
}

export interface FearGreedData {
  value: number
  classification: string
  timestamp: number
}

export type MarketSentiment = 'bullish' | 'bearish' | 'neutral'
export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme'

export interface StrategyReport {
  id: string
  generatedAt: number
  sentiment: MarketSentiment
  riskLevel: RiskLevel
  keyEvents: string[]
  macroFactors: string
  tradingBias: string
  summary: string
  fearGreed: FearGreedData
  newsItems: NewsItem[]
}
