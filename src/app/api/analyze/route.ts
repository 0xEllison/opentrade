import { NextRequest, NextResponse } from 'next/server'

const ZHIPU_API = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const ZHIPU_MODEL = 'glm-4-flash'
const ZHIPU_KEY = '212d1aac54784b09ac5c70d2d2d7fec1.dtHA0ilK5rAUYXmg'

const DEFAULT_SYSTEM =
  '你是一位专业的加密货币合约交易员。根据提供的实时市场数据和技术信号，给出交易建议。严格按照JSON格式回复，不要输出任何其他内容。'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function callZhipu(body: object, attempt = 1): Promise<Response> {
  const res = await fetch(ZHIPU_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ZHIPU_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error(`[ZhipuAI] HTTP ${res.status} (attempt ${attempt}):`, errText)

    // Retry on 429 (rate limit) or 5xx server errors, up to 3 attempts
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      const delay = attempt * 2000  // 2s, 4s
      console.log(`[ZhipuAI] Retrying in ${delay}ms...`)
      await sleep(delay)
      return callZhipu(body, attempt + 1)
    }

    // Return a synthetic Response so caller can read the error
    return new Response(errText, { status: res.status })
  }

  return res
}

export async function POST(req: NextRequest) {
  const { userPrompt, systemPrompt } = await req.json()

  const body = {
    model: ZHIPU_MODEL,
    messages: [
      {
        role: 'system',
        content: systemPrompt || DEFAULT_SYSTEM,
      },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 800,
  }

  try {
    const res = await callZhipu(body)

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: res.status })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    // Extract JSON from content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[ZhipuAI] No JSON in response:', content)
      return NextResponse.json({ error: 'No JSON in response', raw: content }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (e) {
    console.error('[ZhipuAI] Exception:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
