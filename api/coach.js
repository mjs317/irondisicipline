const MAX_PROMPT_CHARS = 32000
const MAX_MESSAGES_CHARS = 48000

const JSON_COACH_SYSTEM = `You are a strength coach. Respond with ONLY valid JSON (no markdown) in this exact shape:
{
  "grade": "A" | "B" | "C" | "D",
  "summary": "one sentence",
  "bullets": ["string", "string"],
  "risks": ["string"],
  "next_session_focus": "string"
}
Be direct and specific. Use short strings in arrays.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).setHeader('Allow', 'POST').end()
    return
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    res.status(503).json({ error: { message: 'Coach is not configured (missing ANTHROPIC_API_KEY).' } })
    return
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      res.status(400).json({ error: { message: 'Invalid JSON body' } })
      return
    }
  }

  const useMessages = Array.isArray(body?.messages) && body.messages.length > 0
  let messages
  if (useMessages) {
    const serialized = JSON.stringify(body.messages)
    if (serialized.length > MAX_MESSAGES_CHARS) {
      res.status(400).json({ error: { message: `messages exceed ${MAX_MESSAGES_CHARS} characters` } })
      return
    }
    messages = body.messages
  } else {
    const prompt = body?.prompt
    if (typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: { message: 'Missing or invalid prompt' } })
      return
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      res.status(400).json({ error: { message: `Prompt exceeds ${MAX_PROMPT_CHARS} characters` } })
      return
    }
    messages = [{ role: 'user', content: prompt }]
  }

  const jsonMode = Boolean(body?.jsonMode)
  const system = typeof body?.systemPrompt === 'string' && body.systemPrompt.trim()
    ? body.systemPrompt.trim()
    : (jsonMode ? JSON_COACH_SYSTEM : undefined)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: jsonMode ? 1500 : 1000,
        ...(system ? { system } : {}),
        messages
      })
    })

    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      res.status(502).json({
        error: { message: `Coach service returned non-JSON (${response.status})` }
      })
      return
    }

    if (!response.ok) {
      const msg = data?.error?.message || data?.message || `Upstream error (${response.status})`
      res.status(response.status >= 400 && response.status < 600 ? response.status : 502).json({
        error: { message: msg }
      })
      return
    }

    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: { message: err.message || 'Coach request failed' } })
  }
}
