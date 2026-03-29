export const EXPORT_VERSION = 1

export function buildExportPayload({ userId, prs, history, setsByPhase, metconByPhase, logDate, coachContext }) {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    userId,
    personalRecords: prs,
    workoutSessions: history,
    todayLog: {
      log_date: logDate,
      sets_data: setsByPhase,
      metcon_sel: metconByPhase,
      ...(coachContext != null ? { coach_context: coachContext } : {})
    }
  }
}

export function downloadJson(obj, filename = 'iron-discipline-backup.json') {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function downloadMarkdown(text, filename = 'iron-discipline-history.md') {
  const blob = new Blob([text], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function formatExName(exId, exerciseNames) {
  if (exerciseNames[exId]) return exerciseNames[exId]
  return exId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function formatCoachCtx(raw) {
  if (!raw || typeof raw !== 'object') return null
  const parts = []
  const sleepH = raw.sleepHours != null && String(raw.sleepHours).trim() !== '' ? String(raw.sleepHours).trim() : null
  const sleepFeel = ['great', 'good', 'ok', 'poor', 'bad'].includes(raw.sleepFeel) ? raw.sleepFeel : null
  if (sleepH) parts.push(`Sleep: ${sleepH}h${sleepFeel ? ` (${sleepFeel})` : ''}`)
  else if (sleepFeel) parts.push(`Sleep: ${sleepFeel}`)

  const runMiles = raw.runMiles != null && String(raw.runMiles).trim() !== '' ? String(raw.runMiles).trim() : null
  let runType = raw.runType || null
  if (!runType && ['low', 'normal', 'high'].includes(raw.running)) {
    runType = raw.running === 'low' ? 'easy' : raw.running === 'high' ? 'intervals' : 'tempo'
  }
  if (runType && runType !== 'off') {
    parts.push(`Run: ${runMiles ? runMiles + ' mi ' : ''}${runType}`)
  } else if (runMiles) {
    parts.push(`Run: ${runMiles} mi`)
  }

  if (raw.deload) parts.push('DELOAD')
  if (raw.race) parts.push('RACE DAY')
  return parts.length > 0 ? parts.join(' | ') : null
}

export function buildMarkdownExport({ sessions, prs, exerciseNames, stats }) {
  const lines = []

  // Header
  const dates = sessions.map(s => s.session_date).filter(Boolean).sort()
  const earliest = dates[0] || '—'
  const latest = dates[dates.length - 1] || '—'
  lines.push(`# Iron Discipline — Workout History Export`)
  lines.push(`Exported: ${new Date().toISOString().slice(0, 10)} | Sessions: ${sessions.length} | Range: ${earliest} → ${latest}`)
  lines.push('')

  // Summary Stats
  lines.push('## Summary')
  lines.push(`- Est. Tonnage: ${stats.totalTonnage.toLocaleString()} lb`)
  lines.push(`- Current Streak: ${stats.streak} consecutive training days`)
  const weekEntries = Object.entries(stats.weeklyFrequency).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12)
  if (weekEntries.length) {
    lines.push(`- Sessions/Week (recent): ${weekEntries.map(([w, c]) => `${w}: ${c}`).join(', ')}`)
  }
  lines.push('')

  // Personal Records
  const prEntries = Object.entries(prs).filter(([, v]) => v && v.weight)
  if (prEntries.length) {
    lines.push('## Personal Records')
    lines.push('| Exercise | Weight (lb) | Date |')
    lines.push('|----------|-------------|------|')
    prEntries
      .sort((a, b) => formatExName(a[0], exerciseNames).localeCompare(formatExName(b[0], exerciseNames)))
      .forEach(([exId, pr]) => {
        lines.push(`| ${formatExName(exId, exerciseNames)} | ${pr.weight} | ${pr.date || '—'} |`)
      })
    lines.push('')
  }

  // Exercise Trends
  const trendEntries = Object.entries(stats.trends).filter(([, arr]) => arr && arr.length)
  if (trendEntries.length) {
    lines.push('## Exercise Trends (Recent Best Weights)')
    trendEntries
      .sort((a, b) => formatExName(a[0], exerciseNames).localeCompare(formatExName(b[0], exerciseNames)))
      .forEach(([exId, dataPoints]) => {
        lines.push(`### ${formatExName(exId, exerciseNames)}`)
        lines.push('| Date | Weight (lb) |')
        lines.push('|------|-------------|')
        dataPoints.forEach(d => {
          lines.push(`| ${d.date} | ${d.maxWeight} |`)
        })
        lines.push('')
      })
  }

  // Full Session Log
  lines.push('## Session Log (All Sessions — Newest First)')
  lines.push('')

  sessions.forEach((session, idx) => {
    const dayNum = (session.day_idx != null ? session.day_idx + 1 : '?')
    const dayName = session.day_name || '—'
    const phase = session.phase || '—'
    lines.push(`### ${session.session_date} — Day ${dayNum}: ${dayName} (${phase})`)

    const ctxLine = formatCoachCtx(session.coach_context)
    if (ctxLine) lines.push(ctxLine)

    const sd = session.sets_data || {}
    const setRows = []
    Object.entries(sd).forEach(([key, sets]) => {
      const exId = key.split('__')[1] || key
      const exName = formatExName(exId, exerciseNames)
      if (Array.isArray(sets)) {
        sets.forEach((s, i) => {
          const w = s.weight != null && s.weight !== '' ? s.weight : '—'
          const r = s.reps != null && s.reps !== '' ? s.reps : '—'
          setRows.push(`| ${exName} | ${i + 1} | ${w} | ${r} | ${s.done ? 'Yes' : 'No'} |`)
        })
      }
    })

    if (setRows.length) {
      lines.push('| Exercise | Set | Weight (lb) | Reps | Done |')
      lines.push('|----------|-----|-------------|------|------|')
      setRows.forEach(r => lines.push(r))
    } else {
      lines.push('No sets logged.')
    }

    const ms = session.metcon_sel || {}
    const metconKey = Object.keys(ms).find(k => ms[k])
    if (metconKey && ms[metconKey]) {
      lines.push(`Finisher: ${ms[metconKey].replace('metcon_', 'FINISHER ').toUpperCase()}`)
    }

    lines.push('')
    if (idx < sessions.length - 1) lines.push('---')
    lines.push('')
  })

  return lines.join('\n')
}

export function validateImportPayload(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Not an object' }
  if (raw.version != null && raw.version !== EXPORT_VERSION) {
    return { ok: false, error: `Expected export version ${EXPORT_VERSION}` }
  }
  return { ok: true, data: raw }
}
