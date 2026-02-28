import { NextResponse } from 'next/server'
import { NewsItem, FearGreedData, StrategyReport } from '@/types'

const ZHIPU_API = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const ZHIPU_MODEL = 'glm-4-flash'
const ZHIPU_KEY = '212d1aac54784b09ac5c70d2d2d7fec1.dtHA0ilK5rAUYXmg'

interface Jin10FlashItem {
  id: string
  time: string
  type: number
  data: { content: string; title?: string; source?: string; source_link?: string }
  important: number
  channel: number[]
}

async function fetchJin10Flash(): Promise<{ news: NewsItem[]; macroNews: NewsItem[] }> {
  const res = await fetch('https://www.jin10.com/flash_newest.js', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Jin10 ${res.status}`)
  const raw = await res.text()
  const jsonStr = raw.replace(/^var newest = /, '').replace(/;$/, '')
  const items: Jin10FlashItem[] = JSON.parse(jsonStr)

  const news: NewsItem[] = []
  const macroNews: NewsItem[] = []

  for (const item of items) {
    if (item.type !== 0) continue
    const content = (item.data.content || '').replace(/<[^>]+>/g, '').trim()
    if (!content || content.length < 10) continue
    if (item.data.content?.includes('lock') || item.data.content?.includes('VIP')) continue

    const newsItem: NewsItem = {
      title: content.slice(0, 80),
      source: item.important === 1 ? 'jin10' : 'jin10-macro',
      pubDate: item.time,
      summary: content.slice(0, 200),
      link: item.data.source_link || '',
    }

    const isCrypto = /BTC|ETH|比特币|以太坊|加密|币|crypto|token|链|web3|defi|nft|solana|sol|bnb|xrp|ripple/i.test(content)
    const isMacro = /美联储|央行|CPI|GDP|非农|利率|通胀|就业|PMI|关税|贸易|制裁|欧佩克|原油|黄金|美元|降息|加息|货币政策|特朗普|拜登|政府|SEC|监管|合规/i.test(content)

    if (isCrypto && news.length < 12) {
      newsItem.source = 'jin10'
      news.push(newsItem)
    } else if ((isMacro || item.important === 1) && macroNews.length < 10) {
      newsItem.source = 'jin10-macro'
      macroNews.push(newsItem)
    }
  }

  return { news, macroNews }
}

async function fetchBlockBeats(): Promise<NewsItem[]> {
  const res = await fetch('https://api.theblockbeats.news/v1/open-api/home-xml', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`BlockBeats ${res.status}`)
  const xml = await res.text()

  // Extract <item> blocks
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  const news: NewsItem[] = []

  for (const item of items) {
    if (news.length >= 15) break

    const title = (item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ?? [])[1]?.trim()
    const desc = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ?? [])[1]
      ?.replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const pubDate = (item.match(/<pubDate><!\[CDATA\[([\s\S]*?)\]\]><\/pubDate>/) ?? [])[1]?.trim()
      ?? (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ?? [])[1]?.trim()
    const link = (item.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/) ?? [])[1]?.trim()
      ?? (item.match(/<guid><!\[CDATA\[([\s\S]*?)\]\]><\/guid>/) ?? [])[1]?.trim()

    if (!title || !desc) continue

    news.push({
      title: title.slice(0, 80),
      source: 'blockbeats',
      pubDate: pubDate ?? '',
      summary: desc.slice(0, 200),
      link: link ?? '',
    })
  }

  return news
}

async function fetchFearGreed(): Promise<FearGreedData> {
  const res = await fetch('https://api.alternative.me/fng/', { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`FNG ${res.status}`)
  const data = await res.json()
  const item = data.data?.[0]
  return {
    value: Number(item.value),
    classification: item.value_classification,
    timestamp: Number(item.timestamp) * 1000,
  }
}

interface OIData {
  symbol: string
  openInterest: string
  time: number
}

async function fetchBinanceOpenInterest(): Promise<string> {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
  const results: string[] = []

  await Promise.allSettled(
    symbols.map(async (symbol) => {
      const res = await fetch(
        `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) return
      const data: OIData = await res.json()
      const oi = parseFloat(data.openInterest)
      results.push(`${symbol}: ${oi.toLocaleString(undefined, { maximumFractionDigits: 0 })} 张`)
    })
  )

  return results.length > 0 ? results.join(' | ') : '数据获取失败'
}

interface HLLeaderEntry {
  ethAddress: string
  accountValue: string
  windowPnl: string
  allTimePnl: string
  vlm: string
  prize: number
  rankingByPnl?: number
}

async function fetchHyperliquidWhales(): Promise<string> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'leaderboard' }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HL ${res.status}`)
    const data = await res.json()

    // leaderboardRows is an array ranked by PnL
    const rows: HLLeaderEntry[] = data.leaderboardRows ?? []
    if (rows.length === 0) return '暂无数据'

    // Take top 5 traders
    const top5 = rows.slice(0, 5)
    const lines = top5.map((r, idx) => {
      const addr = r.ethAddress ? `${r.ethAddress.slice(0, 6)}...${r.ethAddress.slice(-4)}` : '未知'
      const pnl = parseFloat(r.windowPnl ?? '0')
      const allTimePnl = parseFloat(r.allTimePnl ?? '0')
      const pnlStr = pnl >= 0 ? `+$${(pnl / 1000).toFixed(0)}k` : `-$${(Math.abs(pnl) / 1000).toFixed(0)}k`
      const atStr = allTimePnl >= 0 ? `+$${(allTimePnl / 1000).toFixed(0)}k` : `-$${(Math.abs(allTimePnl) / 1000).toFixed(0)}k`
      return `Top${idx + 1} ${addr}: 近期${pnlStr} 总计${atStr}`
    })

    return lines.join('\n')
  } catch {
    return '连接失败'
  }
}

async function fetchLongShortRatios(): Promise<string> {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
  const results: string[] = []
  await Promise.allSettled(
    symbols.map(async (symbol) => {
      const res = await fetch(
        `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) return
      const data = await res.json()
      const item = data[0]
      if (!item) return
      const longPct = (parseFloat(item.longAccount) * 100).toFixed(1)
      const shortPct = (parseFloat(item.shortAccount) * 100).toFixed(1)
      results.push(`${symbol.replace('USDT', '')}: 多${longPct}% / 空${shortPct}%`)
    })
  )
  return results.length > 0 ? results.join(' | ') : '数据获取失败'
}

export async function GET() {
  try {
    const [flashResult, fngResult, oiResult, hlResult, bbResult, lsResult] = await Promise.allSettled([
      fetchJin10Flash(),
      fetchFearGreed(),
      fetchBinanceOpenInterest(),
      fetchHyperliquidWhales(),
      fetchBlockBeats(),
      fetchLongShortRatios(),
    ])

    const { news, macroNews } = flashResult.status === 'fulfilled'
      ? flashResult.value
      : { news: [], macroNews: [] }

    const fearGreed: FearGreedData = fngResult.status === 'fulfilled'
      ? fngResult.value
      : { value: 50, classification: 'Neutral', timestamp: Date.now() }

    const openInterest = oiResult.status === 'fulfilled' ? oiResult.value : '数据获取失败'
    const hlWhales = hlResult.status === 'fulfilled' ? hlResult.value : '连接失败'
    const bbNews = bbResult.status === 'fulfilled' ? bbResult.value : []
    const lsRatios = lsResult.status === 'fulfilled' ? lsResult.value : '数据获取失败'

    const allNews = [...news, ...macroNews, ...bbNews]

    const cryptoSection = news.length > 0
      ? news.map((n, i) => `${i + 1}. [${n.pubDate}] ${n.summary}`).join('\n')
      : '暂无加密货币相关快讯'

    const macroSection = macroNews.length > 0
      ? macroNews.map((n, i) => `${i + 1}. [${n.pubDate}] ${n.summary}`).join('\n')
      : '暂无宏观经济快讯'

    const bbSection = bbNews.length > 0
      ? bbNews.map((n, i) => `${i + 1}. [${n.pubDate}] ${n.title} — ${n.summary}`).join('\n')
      : '暂无律动快讯'

    const userPrompt = `你是一位资深加密货币操盘手，每天监控市场动态、链上数据和大户行为。请根据以下多维度数据生成今日操盘策略报告。

## 市场情绪指标
恐惧贪婪指数: ${fearGreed.value}/100 (${fearGreed.classification})
解读: ${fearGreed.value <= 25 ? '极度恐惧，历史上往往是抄底机会，但需要等待企稳信号' : fearGreed.value <= 45 ? '恐惧区间，市场悲观情绪较重，谨慎做多' : fearGreed.value <= 55 ? '中性区间，市场方向不明，等待催化剂' : fearGreed.value <= 75 ? '贪婪区间，市场亢奋，注意高位风险' : '极度贪婪，市场过热，需要控制仓位甚至考虑做空'}

## Binance 合约持仓量（反映市场多空博弈强度）
${openInterest}

## Binance 多空比（散户情绪参考）
${lsRatios}

## Hyperliquid 顶级交易员动态（头部资金流向参考）
${hlWhales}

## 律动BlockBeats 最新快讯（加密行业一手资讯）
${bbSection}

## 金十数据 加密货币快讯
${cryptoSection}

## 宏观经济与政策快讯（影响风险资产走势）
${macroSection}

请综合分析以上数据，生成专业操盘策略报告。严格按照以下JSON格式回复：
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "riskLevel": "low" | "medium" | "high" | "extreme",
  "keyEvents": ["最重要事件1（含时间/数据）", "关键事件2", "关键事件3"],
  "macroFactors": "宏观因素综合分析（120字以内，含政策面、美元走势、流动性环境）",
  "tradingBias": "今日操盘偏好（60字以内，明确多空方向和重点币种）",
  "summary": "综合市场研判（250字以内，含趋势判断、大户动向、风险提示、具体策略建议）"
}`

    const aiRes = await fetch(ZHIPU_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ZHIPU_KEY}`,
      },
      body: JSON.stringify({
        model: ZHIPU_MODEL,
        messages: [
          {
            role: 'system',
            content: '你是一位顶级加密货币操盘手兼市场分析师，专注于合约交易和宏观研判。你的分析综合考虑链上数据、大户行为、宏观环境和技术面，给出专业的操盘策略建议。严格按JSON格式回复，不输出其他内容。',
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1200,
      }),
    })

    if (!aiRes.ok) {
      const err = await aiRes.text()
      return NextResponse.json({ error: err }, { status: aiRes.status })
    }

    const aiData = await aiRes.json()
    const content = aiData.choices?.[0]?.message?.content ?? ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'No JSON in AI response', raw: content }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])

    const report: StrategyReport = {
      id: `report-${Date.now()}`,
      generatedAt: Date.now(),
      sentiment: parsed.sentiment || 'neutral',
      riskLevel: parsed.riskLevel || 'medium',
      keyEvents: parsed.keyEvents || [],
      macroFactors: parsed.macroFactors || '',
      tradingBias: parsed.tradingBias || '',
      summary: parsed.summary || '',
      fearGreed,
      newsItems: allNews,
    }

    return NextResponse.json(report)
  } catch (e) {
    console.error('[StrategyReport] Error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
