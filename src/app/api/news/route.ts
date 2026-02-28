import { NextResponse } from 'next/server'
import { NewsItem } from '@/types'

interface Jin10FlashItem {
  id: string
  time: string
  type: number
  data: { content: string; title?: string; source?: string; source_link?: string }
  important: number
  channel: number[]
}

async function fetchJin10(): Promise<NewsItem[]> {
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
  for (const item of items) {
    if (item.type !== 0) continue
    const content = (item.data.content || '').replace(/<[^>]+>/g, '').trim()
    if (!content || content.length < 10) continue
    if (content.includes('lock') || content.includes('VIP')) continue

    const isCrypto = /BTC|ETH|比特币|以太坊|加密|币|crypto|token|链|web3|defi|nft|solana|sol|bnb|xrp|ripple/i.test(content)
    const isMacro = /美联储|央行|CPI|GDP|非农|利率|通胀|就业|PMI|关税|贸易|制裁|欧佩克|原油|黄金|美元|降息|加息|货币政策|特朗普|拜登|政府|SEC|监管|合规/i.test(content)

    if ((isCrypto || isMacro || item.important === 1) && news.length < 20) {
      news.push({
        title: content.slice(0, 80),
        source: isCrypto ? 'jin10' : 'jin10-macro',
        pubDate: item.time,
        summary: content.slice(0, 200),
        link: item.data.source_link || '',
      })
    }
  }
  return news
}

async function fetchBlockBeats(): Promise<NewsItem[]> {
  const res = await fetch('https://api.theblockbeats.news/v1/open-api/home-xml', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`BlockBeats ${res.status}`)
  const xml = await res.text()

  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  const news: NewsItem[] = []

  for (const item of items) {
    if (news.length >= 15) break
    const title = (item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ?? [])[1]?.trim()
    const desc = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ?? [])[1]
      ?.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
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

export async function GET() {
  const [jin10Result, bbResult] = await Promise.allSettled([
    fetchJin10(),
    fetchBlockBeats(),
  ])

  const jin10 = jin10Result.status === 'fulfilled' ? jin10Result.value : []
  const bb = bbResult.status === 'fulfilled' ? bbResult.value : []

  // Merge and sort by pubDate descending
  const all = [...bb, ...jin10]

  return NextResponse.json({ items: all, updatedAt: Date.now() }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
