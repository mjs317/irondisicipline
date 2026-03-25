const MAX_BODY_CHARS = 64000

const SYSTEM = `You are a strength coach planning working weights for the next training week.
The athlete follows a fixed 4-day program (hypertrophy or strength phase). Use recent session data and PRs to suggest conservative, achievable working weights (RPE 8-9 on main lifts unless noted).
Respond with ONLY valid JSON (no markdown, no prose) matching this exact shape:
{
  "phase": "hypertrophy" | "strength",
  "notes": "one short string with overall rationale",
  "suggestions": [
    {
      "dayIndex": 0,
      "exerciseId": "bench_press",
      "sets": [ { "index": 0, "weightLb": 185 }, { "index": 1, "weightLb": 185 } ]
    }
  ]
}
Rules:
- dayIndex is 0-3 for the four days.
- exerciseId must match the program exactly.
- Include only scored/main lifts where weight matters (same exercises that have score:true in the program when provided).
- Omit exercises you have no basis for; partial suggestions are OK.
- weightLb must be a number (no strings).
- sets array length should match programmed sets for that exercise when possible.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).setHeader('Allow', 'POST').end()
    return
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    res.status(503).json({ error: { message: 'Planner not configured (missing ANTHROPIC_API_KEY).' } })
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

  const raw = JSON.stringify(body || {})
  if (raw.length > MAX_BODY_CHARS) {
    res.status(400).json({ error: { message: `Body exceeds ${MAX_BODY_CHARS} characters` } })
    return
  }

  const phase = body?.phase
  if (phase !== 'hypertrophy' && phase !== 'strength') {
    res.status(400).json({ error: { message: 'phase must be hypertrophy or strength' } })
    return
  }

  const userBlock = [
    `Phase: ${phase}`,
    '',
    'PROGRAM_OUTLINE_JSON:',
    typeof body.programOutline === 'string' ? body.programOutline : JSON.stringify(body.programOutline || {}),
    '',
    'RECENT_SESSIONS_JSON (newest first, truncated):',
    typeof body.recentSessions === 'string' ? body.recentSessions : JSON.stringify(body.recentSessions || []),
    '',
    'PERSONAL_RECORDS_JSON:',
    typeof body.prsSnapshot === 'string' ? body.prsSnapshot : JSON.stringify(body.prsSnapshot || {})
  ].join('\n')

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
        max_tokens: 4096,
        system: SYSTEM,
        messages: [{ role: 'user', content: userBlock }]
      })
    })

    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      res.status(502).json({ error: { message: `Planner returned non-JSON (${response.status})` } })
      return
    }

    if (!response.ok) {
      const msg = data?.error?.message || data?.message || `Upstream error (${response.status})`
      res.status(response.status >= 400 && response.status < 600 ? response.status : 502).json({
        error: { message: msg }
      })
      return
    }

    const rawText = data?.content?.[0]?.text
    if (!rawText) {
      res.status(502).json({ error: { message: 'Empty planner response' } })
      return
    }

    let parsed
    try {
      const trimmed = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
      parsed = JSON.parse(trimmed)
    } catch (e) {
      res.status(502).json({ error: { message: 'Planner did not return valid JSON', raw: rawText.slice(0, 500) } })
      return
    }

    res.status(200).json({ plan: parsed, rawMessage: data })
  } catch (err) {
    res.status(500).json({ error: { message: err.message || 'Plan request failed' } })
  }
}
