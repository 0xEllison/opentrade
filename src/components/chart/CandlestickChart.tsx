'use client'

import { useEffect, useRef } from 'react'
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, LineData } from 'lightweight-charts'
import { useTradingStore } from '@/store/trading'
import { calcEMA, calcRSI } from '@/lib/trading/indicators'

export function CandlestickChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const ema7SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const ema25SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  const { selectedSymbol, candles } = useTradingStore()
  const symbolCandles = candles[selectedSymbol]

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#1e293b' },
      timeScale: { borderColor: '#1e293b', timeVisible: true },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    const ema7Series = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 1,
      title: 'EMA7',
    })

    const ema25Series = chart.addLineSeries({
      color: '#8b5cf6',
      lineWidth: 1,
      title: 'EMA25',
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    ema7SeriesRef.current = ema7Series
    ema25SeriesRef.current = ema25Series

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  useEffect(() => {
    if (!candleSeriesRef.current || !ema7SeriesRef.current || !ema25SeriesRef.current) return
    if (symbolCandles.length === 0) return

    const candleData: CandlestickData[] = symbolCandles.map((c) => ({
      time: c.time as unknown as CandlestickData['time'],
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))

    candleSeriesRef.current.setData(candleData)

    const closes = symbolCandles.map((c) => c.close)
    const ema7 = calcEMA(closes, 7)
    const ema25 = calcEMA(closes, 25)

    const ema7Data: LineData[] = symbolCandles
      .map((c, i) => ({ time: c.time as unknown as LineData['time'], value: ema7[i] }))
      .filter((d) => !isNaN(d.value))

    const ema25Data: LineData[] = symbolCandles
      .map((c, i) => ({ time: c.time as unknown as LineData['time'], value: ema25[i] }))
      .filter((d) => !isNaN(d.value))

    ema7SeriesRef.current.setData(ema7Data)
    ema25SeriesRef.current.setData(ema25Data)
  }, [symbolCandles])

  // Update last candle in real-time
  useEffect(() => {
    if (!candleSeriesRef.current || symbolCandles.length === 0) return
    const last = symbolCandles[symbolCandles.length - 1]
    candleSeriesRef.current.update({
      time: last.time as unknown as CandlestickData['time'],
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
    })
  }, [symbolCandles])

  return (
    <div className="w-full h-full">
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  )
}
