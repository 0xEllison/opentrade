/**
 * EMA (Exponential Moving Average)
 */
export function calcEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return []
  const k = 2 / (period + 1)
  const result: number[] = []
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  result.push(ema)
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k)
    result.push(ema)
  }
  // Pad start with NaN to align with input array
  const padded = new Array(period - 1).fill(NaN).concat(result)
  return padded
}

/**
 * RSI (Relative Strength Index)
 */
export function calcRSI(prices: number[], period = 14): number[] {
  if (prices.length < period + 1) return []
  const result: number[] = new Array(period).fill(NaN)
  const gains: number[] = []
  const losses: number[] = []

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1]
    gains.push(diff > 0 ? diff : 0)
    losses.push(diff < 0 ? -diff : 0)
  }

  let avgGain = gains.reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.reduce((a, b) => a + b, 0) / period
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  }

  return result
}

/**
 * Bollinger Bands (20, 2)
 */
export function calcBollingerBands(
  prices: number[],
  period = 20,
  stdDevs = 2
): { upper: number[]; middle: number[]; lower: number[]; bandwidth: number[] } {
  const upper: number[] = []
  const middle: number[] = []
  const lower: number[] = []
  const bandwidth: number[] = []

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upper.push(NaN)
      middle.push(NaN)
      lower.push(NaN)
      bandwidth.push(NaN)
    } else {
      const slice = prices.slice(i - period + 1, i + 1)
      const sma = slice.reduce((a, b) => a + b, 0) / period
      const variance = slice.reduce((sum, p) => sum + (p - sma) ** 2, 0) / period
      const std = Math.sqrt(variance)
      const up = sma + stdDevs * std
      const lo = sma - stdDevs * std
      upper.push(up)
      middle.push(sma)
      lower.push(lo)
      bandwidth.push(sma > 0 ? ((up - lo) / sma) * 100 : 0)
    }
  }

  return { upper, middle, lower, bandwidth }
}

/**
 * ATR (Average True Range, period=14)
 */
export function calcATR(
  candles: { high: number; low: number; close: number }[],
  period = 14
): number[] {
  const result: number[] = []

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      result.push(NaN)
      continue
    }
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    )

    if (i < period) {
      result.push(NaN)
    } else if (i === period) {
      let sumTR = 0
      for (let j = 1; j <= period; j++) {
        sumTR += Math.max(
          candles[j].high - candles[j].low,
          Math.abs(candles[j].high - candles[j - 1].close),
          Math.abs(candles[j].low - candles[j - 1].close)
        )
      }
      result.push(sumTR / period)
    } else {
      result.push((result[i - 1] * (period - 1) + tr) / period)
    }
  }

  return result
}

/**
 * Volume Ratio: current volume vs N-period average
 */
export function calcVolumeRatio(volumes: number[], period = 20): number[] {
  const result: number[] = []
  for (let i = 0; i < volumes.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
    } else {
      const avg = volumes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
      result.push(avg > 0 ? volumes[i] / avg : 1)
    }
  }
  return result
}

/**
 * MACD (12, 26, 9)
 */
export function calcMACD(prices: number[]): {
  macd: number[]
  signal: number[]
  histogram: number[]
} {
  const ema12 = calcEMA(prices, 12)
  const ema26 = calcEMA(prices, 26)

  const macdLine: number[] = []
  for (let i = 0; i < prices.length; i++) {
    if (isNaN(ema12[i]) || isNaN(ema26[i])) {
      macdLine.push(NaN)
    } else {
      macdLine.push(ema12[i] - ema26[i])
    }
  }

  // Calculate signal line (9-period EMA of MACD)
  const validMacd = macdLine.filter((v) => !isNaN(v))
  const signalArr = calcEMA(validMacd, 9)

  // Align signal with original length
  const macdValidStart = macdLine.findIndex((v) => !isNaN(v))
  const signalFull: number[] = new Array(macdValidStart).fill(NaN)
  for (let i = 0; i < validMacd.length; i++) {
    signalFull.push(signalArr[i])
  }

  const histogram: number[] = []
  for (let i = 0; i < prices.length; i++) {
    if (isNaN(macdLine[i]) || isNaN(signalFull[i])) {
      histogram.push(NaN)
    } else {
      histogram.push(macdLine[i] - signalFull[i])
    }
  }

  return { macd: macdLine, signal: signalFull, histogram }
}
