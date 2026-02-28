import { Candle, Signal, SignalType, TradingSymbol } from '@/types'
import { calcEMA, calcRSI, calcMACD, calcBollingerBands, calcATR, calcVolumeRatio } from './indicators'

// Cooldown: same signal type must wait 30 candles before firing again
const SIGNAL_COOLDOWN = 30
const signalCooldowns = new Map<string, number>() // key: `${symbol}_${type}`

function cooldownKey(symbol: TradingSymbol, type: SignalType): string {
  return `${symbol}_${type}`
}

function isOnCooldown(symbol: TradingSymbol, type: SignalType, currentIndex: number): boolean {
  const key = cooldownKey(symbol, type)
  const lastFired = signalCooldowns.get(key)
  if (lastFired === undefined) return false
  return currentIndex - lastFired < SIGNAL_COOLDOWN
}

function markFired(symbol: TradingSymbol, type: SignalType, index: number) {
  signalCooldowns.set(cooldownKey(symbol, type), index)
}

export function detectSignals(symbol: TradingSymbol, candles: Candle[]): Signal[] {
  if (candles.length < 35) return []

  const closes = candles.map((c) => c.close)
  const volumes = candles.map((c) => c.volume)
  const ema7 = calcEMA(closes, 7)
  const ema25 = calcEMA(closes, 25)
  const rsi = calcRSI(closes, 14)
  const { macd, signal } = calcMACD(closes)
  const bb = calcBollingerBands(closes, 20, 2)
  const atr = calcATR(candles, 14)
  const volRatio = calcVolumeRatio(volumes, 20)

  const signals: Signal[] = []
  const len = candles.length
  const i = len - 1
  const prevI = i - 1

  const e7 = ema7[i]
  const e25 = ema25[i]
  const pe7 = ema7[prevI]
  const pe25 = ema25[prevI]
  const rsiVal = rsi[i]
  const macdVal = macd[i]
  const signalVal = signal[i]
  const prevMacd = macd[prevI]
  const prevSignal = signal[prevI]
  const bbUpper = bb.upper[i]
  const bbMiddle = bb.middle[i]
  const bbLower = bb.lower[i]
  const prevBbUpper = bb.upper[prevI]
  const prevBbLower = bb.lower[prevI]
  const atrVal = atr[i]
  const volRatioVal = volRatio[i]

  if (isNaN(e7) || isNaN(e25) || isNaN(pe7) || isNaN(pe25)) return []
  if (isNaN(rsiVal)) return []

  const currentPrice = candles[i].close
  const prevPrice = candles[prevI].close
  const currentTime = candles[i].time

  const baseIndicators = {
    ema7: e7,
    ema25: e25,
    rsi: rsiVal,
    macd: isNaN(macdVal) ? 0 : macdVal,
    macdSignal: isNaN(signalVal) ? 0 : signalVal,
    bbUpper: isNaN(bbUpper) ? 0 : bbUpper,
    bbMiddle: isNaN(bbMiddle) ? 0 : bbMiddle,
    bbLower: isNaN(bbLower) ? 0 : bbLower,
    atr: isNaN(atrVal) ? 0 : atrVal,
    volumeRatio: isNaN(volRatioVal) ? 1 : volRatioVal,
  }

  // Golden Cross: EMA7 crosses above EMA25
  if (pe7 < pe25 && e7 > e25 && !isOnCooldown(symbol, 'golden_cross', i)) {
    markFired(symbol, 'golden_cross', i)
    signals.push({
      id: `${symbol}_golden_cross_${currentTime}`,
      symbol,
      type: 'golden_cross',
      time: currentTime,
      price: currentPrice,
      indicators: baseIndicators,
    })
  }

  // Death Cross: EMA7 crosses below EMA25
  if (pe7 > pe25 && e7 < e25 && !isOnCooldown(symbol, 'death_cross', i)) {
    markFired(symbol, 'death_cross', i)
    signals.push({
      id: `${symbol}_death_cross_${currentTime}`,
      symbol,
      type: 'death_cross',
      time: currentTime,
      price: currentPrice,
      indicators: baseIndicators,
    })
  }

  // RSI Oversold: RSI < 30
  if (rsiVal < 30 && !isOnCooldown(symbol, 'rsi_oversold', i)) {
    markFired(symbol, 'rsi_oversold', i)
    signals.push({
      id: `${symbol}_rsi_oversold_${currentTime}`,
      symbol,
      type: 'rsi_oversold',
      time: currentTime,
      price: currentPrice,
      indicators: baseIndicators,
    })
  }

  // RSI Overbought: RSI > 70
  if (rsiVal > 70 && !isOnCooldown(symbol, 'rsi_overbought', i)) {
    markFired(symbol, 'rsi_overbought', i)
    signals.push({
      id: `${symbol}_rsi_overbought_${currentTime}`,
      symbol,
      type: 'rsi_overbought',
      time: currentTime,
      price: currentPrice,
      indicators: baseIndicators,
    })
  }

  // MACD Bullish Cross
  if (
    !isNaN(prevMacd) &&
    !isNaN(prevSignal) &&
    !isNaN(macdVal) &&
    !isNaN(signalVal) &&
    prevMacd < prevSignal &&
    macdVal > signalVal &&
    !isOnCooldown(symbol, 'macd_bullish', i)
  ) {
    markFired(symbol, 'macd_bullish', i)
    signals.push({
      id: `${symbol}_macd_bullish_${currentTime}`,
      symbol,
      type: 'macd_bullish',
      time: currentTime,
      price: currentPrice,
      indicators: baseIndicators,
    })
  }

  // MACD Bearish Cross
  if (
    !isNaN(prevMacd) &&
    !isNaN(prevSignal) &&
    !isNaN(macdVal) &&
    !isNaN(signalVal) &&
    prevMacd > prevSignal &&
    macdVal < signalVal &&
    !isOnCooldown(symbol, 'macd_bearish', i)
  ) {
    markFired(symbol, 'macd_bearish', i)
    signals.push({
      id: `${symbol}_macd_bearish_${currentTime}`,
      symbol,
      type: 'macd_bearish',
      time: currentTime,
      price: currentPrice,
      indicators: baseIndicators,
    })
  }

  // BB Breakout Up: price breaks above upper band with volume
  if (
    !isNaN(bbUpper) &&
    !isNaN(prevBbUpper) &&
    prevPrice <= prevBbUpper &&
    currentPrice > bbUpper &&
    !isNaN(volRatioVal) &&
    volRatioVal > 1.5 &&
    !isOnCooldown(symbol, 'bb_breakout_up', i)
  ) {
    markFired(symbol, 'bb_breakout_up', i)
    signals.push({
      id: `${symbol}_bb_breakout_up_${currentTime}`,
      symbol,
      type: 'bb_breakout_up',
      time: currentTime,
      price: currentPrice,
      indicators: baseIndicators,
    })
  }

  // BB Breakout Down: price breaks below lower band with volume
  if (
    !isNaN(bbLower) &&
    !isNaN(prevBbLower) &&
    prevPrice >= prevBbLower &&
    currentPrice < bbLower &&
    !isNaN(volRatioVal) &&
    volRatioVal > 1.5 &&
    !isOnCooldown(symbol, 'bb_breakout_down', i)
  ) {
    markFired(symbol, 'bb_breakout_down', i)
    signals.push({
      id: `${symbol}_bb_breakout_down_${currentTime}`,
      symbol,
      type: 'bb_breakout_down',
      time: currentTime,
      price: currentPrice,
      indicators: baseIndicators,
    })
  }

  // Volume Surge: volume > 3x average without another signal in last 30 candles
  if (
    !isNaN(volRatioVal) &&
    volRatioVal > 3.0 &&
    !isOnCooldown(symbol, 'volume_surge', i)
  ) {
    markFired(symbol, 'volume_surge', i)
    signals.push({
      id: `${symbol}_volume_surge_${currentTime}`,
      symbol,
      type: 'volume_surge',
      time: currentTime,
      price: currentPrice,
      indicators: baseIndicators,
    })
  }

  return signals
}

export function getSignalLabel(type: SignalType): string {
  const labels: Record<SignalType, string> = {
    golden_cross: '金叉',
    death_cross: '死叉',
    rsi_oversold: 'RSI超卖',
    rsi_overbought: 'RSI超买',
    macd_bullish: 'MACD金叉',
    macd_bearish: 'MACD死叉',
    bb_breakout_up: 'BB上轨突破',
    bb_breakout_down: 'BB下轨跌破',
    volume_surge: '成交量异动',
  }
  return labels[type]
}
