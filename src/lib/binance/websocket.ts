import { Candle, TradingMode, TradingSymbol } from '@/types'

const FUTURES_WS = 'wss://fstream.binance.com/stream'
const SPOT_WS = 'wss://stream.binance.com/stream'

export type KlineHandler = (symbol: TradingSymbol, candle: Candle, isClosed: boolean) => void
export type PriceHandler = (symbol: TradingSymbol, price: number) => void

export class BinanceWebSocket {
  private ws: WebSocket | null = null
  private mode: TradingMode
  private symbols: TradingSymbol[]
  private interval: string
  private onKline: KlineHandler
  private onPrice: PriceHandler
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = true

  constructor(
    mode: TradingMode,
    symbols: TradingSymbol[],
    onKline: KlineHandler,
    onPrice: PriceHandler,
    interval = '1m'
  ) {
    this.mode = mode
    this.symbols = symbols
    this.onKline = onKline
    this.onPrice = onPrice
    this.interval = interval
  }

  connect() {
    const wsBase = this.mode === 'futures' ? FUTURES_WS : SPOT_WS

    const streams = this.symbols.flatMap((s) => {
      const sym = s.toLowerCase()
      return this.mode === 'futures'
        ? [`${sym}@kline_${this.interval}`, `${sym}@markPrice@1s`]
        : [`${sym}@kline_${this.interval}`, `${sym}@miniTicker`]
    })

    const url = `${wsBase}?streams=${streams.join('/')}`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      console.log(`[WS] Connected to Binance ${this.mode} stream`)
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (!msg.data || !msg.stream) return

        const stream: string = msg.stream
        const data = msg.data

        if (stream.includes('@kline_')) {
          const symbol = data.s as TradingSymbol
          const k = data.k
          const candle: Candle = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          }
          this.onKline(symbol, candle, k.x)
        } else if (this.mode === 'futures' && stream.includes('@markPrice')) {
          // Futures: use mark price
          const symbol = data.s as TradingSymbol
          const price = parseFloat(data.p)
          this.onPrice(symbol, price)
        } else if (this.mode === 'spot' && stream.includes('@miniTicker')) {
          // Spot: use last close price
          const symbol = data.s as TradingSymbol
          const price = parseFloat(data.c)
          this.onPrice(symbol, price)
        }
      } catch (e) {
        console.error('[WS] Parse error', e)
      }
    }

    this.ws.onclose = () => {
      console.log(`[WS] Disconnected from ${this.mode} stream`)
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000)
      }
    }

    this.ws.onerror = (err) => {
      console.error('[WS] Error', err)
    }
  }

  disconnect() {
    this.shouldReconnect = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
