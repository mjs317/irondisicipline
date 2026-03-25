/** Resolve storage key and set count for an exercise on a given program day. */
export function findSetKeyForExercise(phasesObj, phaseKey, dayIdx, exerciseId) {
  const day = phasesObj[phaseKey]?.[dayIdx]
  if (!day) return null
  for (const c of day.circuits) {
    if (c.isMetcon) continue
    if (c.exercises.some(e => e.id === exerciseId)) {
      return { key: `${c.id}__${exerciseId}`, totalSets: c.sets }
    }
  }
  return null
}

/** Compact outline of programmed days/exercises for AI planning. */
export function buildProgramOutline(phasesObj, phaseKey) {
  const days = phasesObj[phaseKey]
  if (!days) return []
  return days.map((day, dayIdx) => ({
    dayIndex: dayIdx,
    name: day.name,
    exercises: day.circuits.flatMap(c =>
      c.isMetcon
        ? []
        : c.exercises.map(ex => ({
            id: ex.id,
            name: ex.name,
            target: ex.target,
            score: Boolean(ex.score),
            sets: c.sets,
            circuitId: c.id
          }))
    )
  }))
}

/**
 * Max weight per exercise_id from all workout_sessions.sets_data (done sets only).
 * Keys are "circuitId__exerciseId"; exercise id is everything after first "__".
 */
export function recalculatePrsFromSessions(sessions) {
  const best = {}
  if (!Array.isArray(sessions)) return best
  for (const s of sessions) {
    const sd = s.sets_data
    if (!sd || typeof sd !== 'object') continue
    const sessionDate = s.session_date || ''
    for (const [key, rows] of Object.entries(sd)) {
      const idx = key.indexOf('__')
      if (idx === -1) continue
      const exId = key.slice(idx + 2)
      if (!Array.isArray(rows)) continue
      for (const r of rows) {
        if (!r || !r.done) continue
        const w = Number(r.weight)
        if (!Number.isFinite(w) || w <= 0) continue
        if (!best[exId] || w > best[exId].weight) {
          best[exId] = { weight: w, date: sessionDate }
        }
      }
    }
  }
  return best
}

/** Sum of weight × reps for done sets with valid numbers. */
export function totalTonnageFromSessions(sessions) {
  let t = 0
  if (!Array.isArray(sessions)) return 0
  for (const s of sessions) {
    const sd = s.sets_data
    if (!sd || typeof sd !== 'object') continue
    for (const [, rows] of Object.entries(sd)) {
      if (!Array.isArray(rows)) continue
      for (const r of rows) {
        if (!r || !r.done) continue
        const w = Number(r.weight)
        const reps = Number(r.reps)
        if (Number.isFinite(w) && Number.isFinite(reps) && w > 0 && reps > 0) t += w * reps
      }
    }
  }
  return Math.round(t)
}

/** ISO week key YYYY-Www */
export function isoWeekKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return dateStr
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const w = Math.ceil((((d - y) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(w).padStart(2, '0')}`
}

/** Map weekKey -> count */
export function sessionsPerWeek(sessions) {
  const m = {}
  if (!Array.isArray(sessions)) return m
  for (const s of sessions) {
    const d = s.session_date
    if (!d) continue
    const wk = isoWeekKey(d)
    m[wk] = (m[wk] || 0) + 1
  }
  return m
}

/**
 * exerciseId -> up to limitPerEx entries { date, maxWeight } from most recent sessions that logged that lift.
 */
export function exerciseTrendFromSessions(sessions, limitPerEx = 5) {
  const byEx = {}
  if (!Array.isArray(sessions)) return byEx
  const sorted = [...sessions].sort((a, b) => (b.session_date || '').localeCompare(a.session_date || ''))
  for (const s of sorted) {
    const sd = s.sets_data
    if (!sd || typeof sd !== 'object') continue
    const d = s.session_date
    for (const [key, rows] of Object.entries(sd)) {
      const idx = key.indexOf('__')
      if (idx === -1) continue
      const exId = key.slice(idx + 2)
      if (!Array.isArray(rows)) continue
      let maxW = 0
      for (const r of rows) {
        if (!r || !r.done) continue
        const w = Number(r.weight)
        if (Number.isFinite(w) && w > maxW) maxW = w
      }
      if (maxW <= 0) continue
      if (!byEx[exId]) byEx[exId] = []
      if (byEx[exId].length >= limitPerEx) continue
      byEx[exId].push({ date: d, maxWeight: maxW })
    }
  }
  return byEx
}

/** Streak of calendar days with at least one session (contiguous ending today or most recent). */
/** Upsert PR rows from recalculated map; delete DB rows for exercises no longer present. */
export async function syncPersonalRecordsToDb(supabase, userId, prMap) {
  const ids = Object.keys(prMap)
  const upserts = ids.map(exercise_id => ({
    user_id: userId,
    exercise_id,
    weight: prMap[exercise_id].weight,
    recorded_date: prMap[exercise_id].date
  }))
  if (upserts.length) {
    await supabase.from('personal_records').upsert(upserts, { onConflict: 'user_id,exercise_id' })
  }
  const { data: existing } = await supabase.from('personal_records').select('exercise_id').eq('user_id', userId)
  const toDelete = (existing || []).map(r => r.exercise_id).filter(eid => !prMap[eid])
  if (toDelete.length) {
    await supabase.from('personal_records').delete().eq('user_id', userId).in('exercise_id', toDelete)
  }
}

export function sessionDayStreak(sessions) {
  const days = new Set()
  if (!Array.isArray(sessions)) return 0
  for (const s of sessions) {
    if (s.session_date) days.add(s.session_date)
  }
  if (days.size === 0) return 0
  const sorted = [...days].sort((a, b) => b.localeCompare(a))
  let streak = 0
  let cursor = sorted[0]
  const prevDay = (ds) => {
    const d = new Date(ds + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  }
  while (days.has(cursor)) {
    streak++
    cursor = prevDay(cursor)
  }
  return streak
}
