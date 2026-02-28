import { NextResponse } from 'next/server'
import { HLWhale, HLWhalePos, LongShortRatio, WhaleTransfer, WhaleIntel } from '@/types'

// ── Hyperliquid: top traders + their open positions ───────────────────────────

interface HLLeaderEntry {
  ethAddress: string
  accountValue: string
  windowPnl: string
  allTimePnl: string
}

interface HLPosition {
  coin: string
  szi: string
  entryPx: string
  unrealizedPnl: string
  leverage: { value: number }
}

interface HLClearinghouseState {
  assetPositions: { position: HLPosition }[]
}

async function fetchHLWhales(): Promise<HLWhale[]> {
  const lbRes = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'leaderboard' }),
    signal: AbortSignal.timeout(10000),
  })
  if (!lbRes.ok) throw new Error(`HL leaderboard ${lbRes.status}`)
  const lbData = await lbRes.json()

  // HL leaderboard may nest rows differently — handle both shapes
  const rows: HLLeaderEntry[] =
    lbData.leaderboardRows ??
    lbData.rows ??
    (Array.isArray(lbData) ? lbData : [])

  console.log('[WhaleIntel] HL leaderboard rows count:', rows.length, 'sample:', JSON.stringify(rows[0] ?? {}))

  const top10 = rows.filter((r) => r.ethAddress).slice(0, 10)

  const whales = await Promise.all(
    top10.map(async (r, idx): Promise<HLWhale> => {
      const addr = r.ethAddress
      const shortAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`
      try {
        const posRes = await fetch('https://api.hyperliquid.xyz/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'clearinghouseState', user: addr }),
          signal: AbortSignal.timeout(8000),
        })
        if (!posRes.ok) throw new Error(`HL pos ${posRes.status}`)
        const posData: HLClearinghouseState = await posRes.json()

        const positions: HLWhalePos[] = (posData.assetPositions ?? [])
          .map(({ position: p }) => {
            const szi = parseFloat(p.szi)
            if (szi === 0) return null
            const entryPx = parseFloat(p.entryPx)
            return {
              coin: p.coin,
              direction: szi > 0 ? 'long' : 'short',
              size: Math.abs(szi) * entryPx,
              entryPrice: entryPx,
              unrealizedPnl: parseFloat(p.unrealizedPnl),
              leverage: p.leverage?.value ?? 1,
            } as HLWhalePos
          })
          .filter(Boolean) as HLWhalePos[]

        return {
          address: shortAddr,
          fullAddress: addr,
          rank: idx + 1,
          allTimePnl: parseFloat(r.allTimePnl ?? '0'),
          accountValue: parseFloat(r.accountValue ?? '0'),
          positions,
          updatedAt: Date.now(),
        }
      } catch {
        return {
          address: shortAddr,
          fullAddress: addr,
          rank: idx + 1,
          allTimePnl: parseFloat(r.allTimePnl ?? '0'),
          accountValue: parseFloat(r.accountValue ?? '0'),
          positions: [],
          updatedAt: Date.now(),
        }
      }
    })
  )
  return whales
}

// ── Binance long/short ratio ──────────────────────────────────────────────────

async function fetchLongShortRatios(): Promise<LongShortRatio[]> {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const res = await fetch(
        `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) throw new Error(`LS ${symbol} ${res.status}`)
      const data = await res.json()
      const item = data[0]
      return {
        symbol,
        longPct: parseFloat(item.longAccount) * 100,
        shortPct: parseFloat(item.shortAccount) * 100,
      } as LongShortRatio
    })
  )
  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<LongShortRatio>).value)
}

// ── Whale Alert public transactions ──────────────────────────────────────────

async function fetchWhaleTransfers(): Promise<WhaleTransfer[]> {
  try {
    const res = await fetch(
      'https://api.whale-alert.io/v1/transactions?api_key=free&min_value=500000&limit=20',
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    const txs: Record<string, unknown>[] = data.transactions ?? []

    return txs
      .filter((tx) =>
        ['bitcoin', 'ethereum', 'solana', 'binance-coin'].includes(tx.blockchain as string)
      )
      .slice(0, 15)
      .map((tx) => {
        const from = tx.from as Record<string, unknown>
        const to = tx.to as Record<string, unknown>
        const fromType = (from?.owner_type as string) ?? ''
        const toType = (to?.owner_type as string) ?? ''
        let type: WhaleTransfer['type'] = 'wallet_transfer'
        if (toType === 'exchange') type = 'exchange_deposit'
        else if (fromType === 'exchange') type = 'exchange_withdrawal'

        return {
          id: String(tx.id),
          symbol: String(tx.symbol ?? '').toUpperCase(),
          amountUsd: tx.amount_usd as number,
          from: (from?.owner as string) || (from?.address as string) || 'unknown',
          to: (to?.owner as string) || (to?.address as string) || 'unknown',
          type,
          timestamp: tx.timestamp as number,
          txHash: String(tx.hash ?? ''),
        } as WhaleTransfer
      })
  } catch {
    return []
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const [hlResult, lsResult, transferResult] = await Promise.allSettled([
      fetchHLWhales(),
      fetchLongShortRatios(),
      fetchWhaleTransfers(),
    ])

    const intel: WhaleIntel = {
      hlWhales: hlResult.status === 'fulfilled' ? hlResult.value : [],
      lsRatios: lsResult.status === 'fulfilled' ? lsResult.value : [],
      transfers: transferResult.status === 'fulfilled' ? transferResult.value : [],
      updatedAt: Date.now(),
    }

    return NextResponse.json(intel)
  } catch (e) {
    console.error('[WhaleIntel] Error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
