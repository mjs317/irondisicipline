const MAX_PROMPT_CHARS = 32000

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

  const prompt = body?.prompt
  if (typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: { message: 'Missing or invalid prompt' } })
    return
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    res.status(400).json({ error: { message: `Prompt exceeds ${MAX_PROMPT_CHARS} characters` } })
    return
  }

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
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
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
