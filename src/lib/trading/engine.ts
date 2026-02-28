import {
  Position, Order, Trade, TradingSymbol, AccountInfo,
  OpenPositionParams, PlaceOrderParams, Leverage, TradingMode
} from '@/types'

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function calcLiquidationPrice(
  entryPrice: number,
  direction: 'long' | 'short',
  leverage: Leverage,
  mode: TradingMode
): number {
  if (mode === 'spot') return 0  // no liquidation in spot
  if (direction === 'long') {
    return entryPrice * (1 - 1 / leverage + 0.004)
  } else {
    return entryPrice * (1 + 1 / leverage - 0.004)
  }
}

export function calcUnrealizedPnl(
  direction: 'long' | 'short',
  entryPrice: number,
  markPrice: number,
  size: number,
  leverage: Leverage
): number {
  if (direction === 'long') {
    return ((markPrice - entryPrice) / entryPrice) * size * leverage
  } else {
    return ((entryPrice - markPrice) / entryPrice) * size * leverage
  }
}

export function openPosition(
  params: OpenPositionParams,
  account: AccountInfo
): { position: Position; updatedAccount: AccountInfo } | null {
  if (account.balance < params.size) return null

  const position: Position = {
    id: genId(),
    symbol: params.symbol,
    mode: params.mode,
    direction: params.direction,
    size: params.size,
    leverage: params.leverage,
    entryPrice: params.entryPrice,
    markPrice: params.entryPrice,
    liquidationPrice: calcLiquidationPrice(params.entryPrice, params.direction, params.leverage, params.mode),
    stopLoss: params.stopLoss,
    takeProfit: params.takeProfit,
    trailingStop: params.trailingStop,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    openTime: Date.now(),
  }

  const updatedAccount: AccountInfo = {
    ...account,
    balance: account.balance - params.size,
    usedMargin: account.usedMargin + params.size,
  }

  return { position, updatedAccount }
}

export function closePosition(
  position: Position,
  exitPrice: number,
  closeReason: Trade['closeReason'],
  account: AccountInfo
): { trade: Trade; updatedAccount: AccountInfo; updatedPositions: Position[] } {
  const pnl = calcUnrealizedPnl(
    position.direction,
    position.entryPrice,
    exitPrice,
    position.size,
    position.leverage
  )
  const pnlPct = (pnl / position.size) * 100

  const trade: Trade = {
    id: genId(),
    symbol: position.symbol,
    mode: position.mode,
    direction: position.direction,
    entryPrice: position.entryPrice,
    exitPrice,
    size: position.size,
    leverage: position.leverage,
    realizedPnl: pnl,
    realizedPnlPct: pnlPct,
    openTime: position.openTime,
    closeTime: Date.now(),
    closeReason,
  }

  const returnedMargin = position.size + pnl
  const updatedAccount: AccountInfo = {
    ...account,
    balance: account.balance + Math.max(0, returnedMargin),
    usedMargin: Math.max(0, account.usedMargin - position.size),
    equityHistory: [
      ...account.equityHistory,
      { time: Date.now(), equity: account.equity + pnl },
    ],
  }

  return { trade, updatedAccount, updatedPositions: [] }
}

export function placeOrder(params: PlaceOrderParams): Order {
  return {
    id: genId(),
    symbol: params.symbol,
    mode: params.mode,
    type: params.type,
    direction: params.direction,
    price: params.price,
    triggerPrice: params.triggerPrice,
    size: params.size,
    leverage: params.leverage,
    status: 'pending',
    createdAt: Date.now(),
    positionId: params.positionId,
  }
}

interface EngineTickResult {
  positionsToClose: Array<{ positionId: string; exitPrice: number; reason: Trade['closeReason'] }>
  ordersToFill: Array<{ orderId: string; fillPrice: number }>
  stopLossUpdates: Array<{ positionId: string; newStopLoss: number }>
}

export function processTick(
  symbol: TradingSymbol,
  markPrice: number,
  positions: Position[],
  orders: Order[]
): EngineTickResult {
  const positionsToClose: EngineTickResult['positionsToClose'] = []
  const ordersToFill: EngineTickResult['ordersToFill'] = []
  const stopLossUpdates: EngineTickResult['stopLossUpdates'] = []

  // Check pending orders
  for (const order of orders) {
    if (order.symbol !== symbol || order.status !== 'pending') continue

    if (order.type === 'limit' && order.price !== undefined) {
      const triggered =
        order.direction === 'long'
          ? markPrice <= order.price
          : markPrice >= order.price
      if (triggered) {
        ordersToFill.push({ orderId: order.id, fillPrice: order.price })
      }
    }

    if (
      (order.type === 'stop_market' || order.type === 'take_profit_market') &&
      order.triggerPrice !== undefined
    ) {
      const triggered =
        order.type === 'stop_market'
          ? (order.direction === 'long'
              ? markPrice <= order.triggerPrice
              : markPrice >= order.triggerPrice)
          : (order.direction === 'long'
              ? markPrice >= order.triggerPrice
              : markPrice <= order.triggerPrice)
      if (triggered) {
        ordersToFill.push({ orderId: order.id, fillPrice: markPrice })
      }
    }
  }

  // Check positions for SL/TP/Liquidation
  for (let pos of positions) {
    if (pos.symbol !== symbol) continue

    // Liquidation check (spot positions have liquidationPrice === 0, skip)
    if (pos.liquidationPrice > 0) {
      const liqTriggered =
        pos.direction === 'long'
          ? markPrice <= pos.liquidationPrice
          : markPrice >= pos.liquidationPrice
      if (liqTriggered) {
        positionsToClose.push({ positionId: pos.id, exitPrice: markPrice, reason: 'liquidation' })
        continue
      }
    }

    // Trailing stop loss: move SL up as price moves in our favor
    // Uses ATR-based steps: breakeven at 1×ATR profit, then trail at 0.5×ATR steps
    if (pos.stopLoss !== undefined && pos.trailingStop !== undefined && pos.trailingStop > 0) {
      const atr = pos.trailingStop  // trailingStop field stores ATR reference value
      const isLong = pos.direction === 'long'
      const profitDist = isLong
        ? markPrice - pos.entryPrice
        : pos.entryPrice - markPrice

      let newSL: number | undefined

      if (profitDist >= atr * 2) {
        // Lock in at least 1×ATR profit: trail at markPrice - 1.5×ATR
        const trailSL = isLong
          ? markPrice - atr * 1.5
          : markPrice + atr * 1.5
        // Only move SL in favorable direction
        if (isLong && trailSL > pos.stopLoss) newSL = trailSL
        if (!isLong && trailSL < pos.stopLoss) newSL = trailSL
      } else if (profitDist >= atr) {
        // Move to breakeven
        const breakevenSL = isLong
          ? pos.entryPrice + atr * 0.1
          : pos.entryPrice - atr * 0.1
        if (isLong && breakevenSL > pos.stopLoss) newSL = breakevenSL
        if (!isLong && breakevenSL < pos.stopLoss) newSL = breakevenSL
      }

      if (newSL !== undefined) {
        stopLossUpdates.push({ positionId: pos.id, newStopLoss: newSL })
        // Use updated SL for this tick's check
        pos = { ...pos, stopLoss: newSL }
      }
    }

    // Stop loss
    if (pos.stopLoss !== undefined) {
      const slTriggered =
        pos.direction === 'long'
          ? markPrice <= pos.stopLoss
          : markPrice >= pos.stopLoss
      if (slTriggered) {
        positionsToClose.push({ positionId: pos.id, exitPrice: markPrice, reason: 'stop_loss' })
        continue
      }
    }

    // Take profit
    if (pos.takeProfit !== undefined) {
      const tpTriggered =
        pos.direction === 'long'
          ? markPrice >= pos.takeProfit
          : markPrice <= pos.takeProfit
      if (tpTriggered) {
        positionsToClose.push({ positionId: pos.id, exitPrice: markPrice, reason: 'take_profit' })
        continue
      }
    }
  }

  return { positionsToClose, ordersToFill, stopLossUpdates }
}
