import { Candle, TradingMode, TradingSymbol } from '@/types'

const FUTURES_URL = 'https://fapi.binance.com/fapi/v1'
const SPOT_URL = 'https://api.binance.com/api/v3'

export async function fetchKlines(
  symbol: TradingSymbol,
  interval = '1m',
  limit = 200,
  mode: TradingMode = 'spot'
): Promise<Candle[]> {
  const base = mode === 'futures' ? FUTURES_URL : SPOT_URL
  const url = `${base}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Binance klines error: ${res.status}`)
  const data: [number, string, string, string, string, string, ...unknown[]][] = await res.json()
  return data.map((d) => ({
    time: Math.floor(d[0] / 1000),
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  }))
}

export async function fetchMarkPrice(symbol: TradingSymbol): Promise<number> {
  const url = `${FUTURES_URL}/premiumIndex?symbol=${symbol}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Binance mark price error: ${res.status}`)
  const data = await res.json()
  return parseFloat(data.markPrice)
}

export async function fetchSpotPrice(symbol: TradingSymbol): Promise<number> {
  const url = `${SPOT_URL}/ticker/price?symbol=${symbol}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Binance spot price error: ${res.status}`)
  const data = await res.json()
  return parseFloat(data.price)
}
