import { Signal, AiAnalysis } from '@/types'

const BOT_TOKEN = '8598269722:AAHBvUWKK5EZSgPRPGkDuD776U9KPU3jdek'
const CHAT_ID = '7409232756'
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`

function formatSignalMessage(signal: Signal, analysis: AiAnalysis): string {
  const dirEmoji =
    analysis.direction === 'long' ? '🟢' :
    analysis.direction === 'short' ? '🔴' : '🟡'
  const actionEmoji =
    analysis.decisionAction === 'open' ? '✅ 已开仓' :
    analysis.decisionAction === 'close_and_open' ? '🔄 反手开仓' :
    '⏸ 跳过'

  const SIGNAL_LABELS: Record<string, string> = {
    golden_cross: 'EMA金叉',
    death_cross: 'EMA死叉',
    rsi_oversold: 'RSI超卖',
    rsi_overbought: 'RSI超买',
    macd_bullish: 'MACD金叉',
    macd_bearish: 'MACD死叉',
    bb_breakout_up: 'BB上轨突破',
    bb_breakout_down: 'BB下轨跌破',
    volume_surge: '量能异动',
  }

  const ind = signal.indicators
  const rrStr = analysis.riskReward ? ` | R:R ${analysis.riskReward.toFixed(1)}` : ''
  const confluenceStr = analysis.confluence !== undefined ? ` | 共振 ${analysis.confluence}/5` : ''
  const timeframeStr = analysis.timeframe
    ? ` | ${analysis.timeframe === 'short' ? '短线' : analysis.timeframe === 'medium' ? '波段' : '长线'}`
    : ''

  const lines = [
    `${dirEmoji} *${signal.symbol}* — ${SIGNAL_LABELS[signal.type] ?? signal.type}`,
    ``,
    `💰 价格: \`$${signal.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}\``,
    `📊 置信度: ${analysis.confidence}/10${rrStr}${confluenceStr}${timeframeStr}`,
    ``,
    `📈 入场: \`$${analysis.entryPrice.toFixed(2)}\``,
    `🛑 止损: \`$${analysis.stopLoss.toFixed(2)}\``,
    `🎯 止盈: \`$${analysis.takeProfit.toFixed(2)}\``,
    ``,
    `📉 RSI: ${ind.rsi.toFixed(1)} | 量比: ${ind.volumeRatio > 0 ? `${ind.volumeRatio.toFixed(1)}x` : 'N/A'} | EMA: ${ind.ema7 > ind.ema25 ? '多排' : '空排'}`,
    ``,
    `🤖 分析: ${analysis.reasoning}`,
    ``,
    `${actionEmoji}${analysis.decisionNote ? ` — ${analysis.decisionNote}` : ''}`,
    ``,
    `🕐 ${new Date(signal.time * 1000).toLocaleString('zh-CN')}`,
  ]

  return lines.join('\n')
}

export async function sendSignalToTelegram(signal: Signal, analysis: AiAnalysis): Promise<void> {
  try {
    const text = formatSignalMessage(signal, analysis)
    await fetch(TG_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(8000),
    })
  } catch (e) {
    console.error('[Telegram] Failed to send signal', e)
  }
}
