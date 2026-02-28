import { Signal, AiAnalysis } from '@/types'

const ZHIPU_API = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const ZHIPU_MODEL = 'glm-4-flash'
const ZHIPU_KEY = '212d1aac54784b09ac5c70d2d2d7fec1.dtHA0ilK5rAUYXmg'

const SYSTEM_PROMPT = `你是一位拥有10年实战经验的顶级加密货币合约交易员，精通短线和波段操作。

你的分析框架（按重要性排序）：
1. 趋势判断：EMA排列（EMA7>EMA25=多头，否则空头），价格相对布林带位置
2. 动量确认：MACD方向与RSI区间，量价配合（成交量比>1.5倍为有效信号）
3. 波动性评估：ATR确定止损位置（多单止损=入场价-1.5×ATR，空单=入场价+1.5×ATR）
4. 风险收益比：目标不低于1:2（止盈距离≥2×止损距离）
5. 市场情绪：结合恐惧贪婪指数和宏观环境调整仓位偏好

信号可信度评估（confidence 1-10）：
- 8-10分：多个指标共振，趋势明确，量价配合，直接入场
- 6-7分：主要指标支持，但有一定不确定性，谨慎入场
- 4-5分：信号较弱或指标矛盾，建议观望
- 1-3分：逆势信号，风险极高，直接持有现金

务必严格按JSON格式回复，不输出任何其他内容。`

const SIGNAL_LABELS: Record<string, string> = {
  golden_cross: 'EMA7上穿EMA25金叉（短期趋势反转向上）',
  death_cross: 'EMA7下穿EMA25死叉（短期趋势反转向下）',
  rsi_oversold: 'RSI超卖区域(<30)，潜在超卖反弹',
  rsi_overbought: 'RSI超买区域(>70)，潜在超买回调',
  macd_bullish: 'MACD柱状图金叉，动量转多',
  macd_bearish: 'MACD柱状图死叉，动量转空',
  bb_breakout_up: '价格有量突破布林带上轨，强势多头信号',
  bb_breakout_down: '价格有量跌破布林带下轨，强势空头信号',
  volume_surge: '成交量异常放大(>3倍均量)，主力资金介入',
}

function getBBPosition(price: number, upper: number, middle: number, lower: number): string {
  if (upper <= 0 || lower <= 0) return '数据不足'
  const bandwidth = upper - lower
  if (bandwidth <= 0) return '震荡收窄'
  const pct = (price - lower) / bandwidth
  if (pct > 0.9) return `布林带上轨附近(${(pct * 100).toFixed(0)}%)`
  if (pct > 0.6) return `布林带中上区间(${(pct * 100).toFixed(0)}%)`
  if (pct > 0.4) return `布林带中轨附近(${(pct * 100).toFixed(0)}%)`
  if (pct > 0.1) return `布林带中下区间(${(pct * 100).toFixed(0)}%)`
  return `布林带下轨附近(${(pct * 100).toFixed(0)}%)`
}

export async function analyzeSignal(
  signal: Signal,
  change1h: number,
  change24h: number,
  strategyContext?: string
): Promise<AiAnalysis | null> {
  const { indicators: ind } = signal
  const trend = ind.ema7 > ind.ema25 ? '多头排列（EMA7>EMA25）' : '空头排列（EMA7<EMA25）'
  const bbPos = getBBPosition(signal.price, ind.bbUpper, ind.bbMiddle, ind.bbLower)
  const macdMomentum = ind.macd > ind.macdSignal
    ? `多头动量（MACD柱>0: ${(ind.macd - ind.macdSignal).toFixed(4)}）`
    : `空头动量（MACD柱<0: ${(ind.macd - ind.macdSignal).toFixed(4)}）`
  const volStr = ind.volumeRatio > 0
    ? `${ind.volumeRatio.toFixed(1)}x均量（${ind.volumeRatio > 2 ? '放量' : ind.volumeRatio > 1.2 ? '温和放量' : '缩量'}）`
    : '数据不足'
  const atrStr = ind.atr > 0 ? `${ind.atr.toFixed(2)} USDT` : '数据不足'
  const atrSlLong = ind.atr > 0 ? (signal.price - ind.atr * 1.5).toFixed(2) : 'N/A'
  const atrSlShort = ind.atr > 0 ? (signal.price + ind.atr * 1.5).toFixed(2) : 'N/A'

  const userPrompt = `== 交易对分析请求 ==
交易对: ${signal.symbol} | 当前价格: ${signal.price.toFixed(2)} USDT
触发信号: ${SIGNAL_LABELS[signal.type] ?? signal.type}

== 技术指标全览 ==
趋势结构: ${trend}
  • EMA7: ${ind.ema7.toFixed(2)} | EMA25: ${ind.ema25.toFixed(2)}
  • 布林带: 上轨=${ind.bbUpper > 0 ? ind.bbUpper.toFixed(2) : 'N/A'} | 中轨=${ind.bbMiddle > 0 ? ind.bbMiddle.toFixed(2) : 'N/A'} | 下轨=${ind.bbLower > 0 ? ind.bbLower.toFixed(2) : 'N/A'}
  • 价格位置: ${bbPos}
动量指标:
  • RSI(14): ${ind.rsi.toFixed(1)} ${ind.rsi < 30 ? '⚠️超卖' : ind.rsi > 70 ? '⚠️超买' : '正常区间'}
  • MACD: ${macdMomentum}
量能分析:
  • 成交量比: ${volStr}
  • ATR(14): ${atrStr}
  • ATR参考止损: 多单=${atrSlLong} | 空单=${atrSlShort}
价格变动:
  • 1小时: ${change1h >= 0 ? '+' : ''}${change1h.toFixed(2)}%
  • 24小时: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%
${strategyContext ? `\n== 当前市场环境 ==\n${strategyContext}\n` : ''}
== 操盘要求 ==
1. 判断当前信号是否与趋势方向一致
2. 确认成交量是否支撑信号
3. 基于ATR计算动态止损（建议1.5×ATR）
4. 确保风险收益比≥1:2
5. 给出confluence（共振指标数量，0-5）

请严格按以下JSON格式回复：
{
  "direction": "long" | "short" | "hold",
  "confidence": 1-10,
  "entryPrice": number,
  "stopLoss": number,
  "takeProfit": number,
  "confluence": 0-5,
  "riskReward": number,
  "timeframe": "short" | "medium" | "long",
  "reasoning": "详细分析（120字以内，包含趋势/量能/风险收益判断）"
}`

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userPrompt, systemPrompt: SYSTEM_PROMPT }),
      signal: AbortSignal.timeout(35000),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      console.error('[ZhipuAI] API returned', res.status, errBody)
      throw new Error(`API error: ${res.status}`)
    }
    const data = await res.json()
    return { ...data, autoTraded: false }
  } catch (e) {
    console.error('[ZhipuAI] Error', e)
    return null
  }
}

export { ZHIPU_API, ZHIPU_MODEL, ZHIPU_KEY }
