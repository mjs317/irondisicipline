import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase, supabaseReady, USER_ID } from './supabase'
import {
  recalculatePrsFromSessions,
  syncPersonalRecordsToDb,
  totalTonnageFromSessions,
  sessionsPerWeek,
  exerciseTrendFromSessions,
  sessionDayStreak,
  buildProgramOutline,
  findSetKeyForExercise,
  coachContextColumnError,
  upsertWorkoutSessionCompat,
  upsertTodayLogCompat
} from './trainingUtils'
import { buildExportPayload, downloadJson, validateImportPayload } from './exportImport'

const HISTORY_LIMIT = 500
const LS_PHASE = 'iron_discipline_phase'
const LS_ACTIVE_DAY = 'iron_discipline_active_day'
const TODAY_LOG_AUTOSAVE_MS = 1200

// ─── Colors ───
const BG      = '#0a0a0a'
const CARD    = '#111111'
const BORDER  = '#222222'
const ACCENT  = '#D97706'
const BLUE    = '#3B82F6'
const GREEN   = '#22c55e'
const PURPLE  = '#7C3AED'
const RED     = '#DC2626'
const TEXT    = '#e5e5e5'
const MUTED   = '#777777'

const FONT = "'Courier New', Courier, monospace"

// ─── Helpers ───
const today = () => {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}

const fmtDate = () => {
  const d = new Date()
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`
}

const colorForType = (t) => {
  if (t === 'straight') return ACCENT
  if (t === 'circuit' || t === 'superset') return PURPLE
  if (t === 'core') return GREEN
  if (t === 'metcon') return RED
  return ACCENT
}

// ─── PROGRAM DATA ───

const HYPERTROPHY = [
  {
    name: 'Upper Horizontal',
    tag: 'BENCH · ROWS · PUSH/PULL',
    note: null,
    circuits: [
      {
        id: 'd1_s1', label: 'STRAIGHT SETS', type: 'straight', sets: 4, rest: '2:00 b/t sets',
        coachNote: 'RPE 8–9. Pick a weight you can control for all 10. 3-sec descent every rep. Volume is the goal this phase.',
        exercises: [{ id: 'bench_press', name: 'Bench Press', target: '8–10', score: true }]
      },
      {
        id: 'd1_c1', label: 'CIRCUIT', type: 'circuit', sets: 4, rest: '1:30 b/t rounds',
        coachNote: 'RPE 9. Row to your belly button — not your shoulder. Keep :10 between exercises to accumulate the pump.',
        exercises: [
          { id: 'db_bent_row', name: 'DB Bent Over Row', target: '10–12' },
          { id: 'db_bench', name: 'DB Bench Press', target: '10–12' }
        ]
      },
      {
        id: 'd1_c2', label: 'CIRCUIT', type: 'circuit', sets: 3, rest: '1:30 b/t rounds',
        coachNote: 'RPE 9. Max reps dips — add weight if bodyweight is easy for 6+. Row immediately after to balance the push.',
        exercises: [
          { id: 'bar_dips', name: 'Bar Dips add weight if easy', target: 'Max min 6' },
          { id: 'cable_row', name: 'Cable or Band Row', target: '12–16' }
        ]
      },
      {
        id: 'd1_core', label: 'CORE FINISHER — CIRCUIT', type: 'core', sets: 3, rest: '1:00 b/t rounds',
        coachNote: 'RPE 8. Lower back FLAT on dead bugs. Hollow hold: squeeze glutes and abs simultaneously.',
        exercises: [
          { id: 'd1_hollow', name: 'Hollow Body Hold', target: '0:45' },
          { id: 'd1_deadbug', name: 'Slow Dead Bugs', target: '20 reps' },
          { id: 'd1_plank', name: 'Plank Hold', target: '1:00' }
        ]
      }
    ]
  },
  {
    name: 'Lower Hinge + Glutes',
    tag: 'RDL · GLUTES · HINGE',
    note: 'Glute and hinge dominant. Minimal quad stress so your runs stay intact.',
    circuits: [
      {
        id: 'd2_s1', label: 'STRAIGHT SETS', type: 'straight', sets: 4, rest: '2:00 b/t sets',
        coachNote: 'RPE 8–9. Feel the hamstring stretch at the bottom. Use straps so grip is not the limiter.',
        exercises: [{ id: 'rdl', name: 'Romanian Deadlift', target: '10–12', score: true }]
      },
      {
        id: 'd2_c1', label: 'CIRCUIT', type: 'circuit', sets: 3, rest: '1:30 b/t rounds',
        coachNote: 'RPE 9. Single leg RDL: slow and controlled. Glute bridge: squeeze and hold one beat at the top.',
        exercises: [
          { id: 'sl_rdl', name: 'Single Leg RDL', target: '10/side' },
          { id: 'glute_bridge', name: 'KB or DB Glute Bridge', target: '15–20' }
        ]
      },
      {
        id: 'd2_c2', label: 'CIRCUIT', type: 'circuit', sets: 3, rest: '1:30 b/t rounds',
        coachNote: 'RPE 9. Forward lean on lunges loads the glute over the quad. 3-sec descent on hamstring curl.',
        exercises: [
          { id: 'db_lunge', name: 'DB Walking Lunges slight forward lean', target: '16–20 steps' },
          { id: 'ham_curl', name: 'Hamstring Curl Rower or Machine 30X0', target: '12–15' }
        ]
      },
      {
        id: 'd2_core', label: 'CORE FINISHER — CIRCUIT', type: 'core', sets: 3, rest: '1:00 b/t rounds',
        coachNote: 'RPE 8. Straight legs on raises — kipping defeats the purpose. Ab wheel: only go as far as your lower back stays flat.',
        exercises: [
          { id: 'd2_hang_raise', name: 'Hanging Leg Raises straight legs', target: '10–15' },
          { id: 'd2_rev_crunch', name: 'Reverse Crunch', target: '15–20' },
          { id: 'd2_ab_wheel', name: 'Ab Wheel Rollout', target: '10–12' }
        ]
      }
    ]
  },
  {
    name: 'Upper Vertical + Arms',
    tag: 'PULL-UPS · PRESS · ARMS',
    note: null,
    circuits: [
      {
        id: 'd3_s1', label: 'SUPERSET — alternate exercises each set, then rest', type: 'superset', sets: 4, rest: '1:00 b/t exercises · 2:00 b/t rounds',
        coachNote: 'RPE 9. Aim for 8–10 clean pull-ups. Add weight if bodyweight is easy for 10. Press should be equally hard.',
        exercises: [
          { id: 'weighted_pullup', name: 'Weighted Pull-Ups', target: '8–10', score: true },
          { id: 'strict_press', name: 'Strict Press', target: '8–10', score: true }
        ]
      },
      {
        id: 'd3_c1', label: 'CIRCUIT', type: 'circuit', sets: 3, rest: '1:30 b/t rounds',
        coachNote: 'RPE 9. Arnold press hits the full delt. Lead elbows on laterals — not hands. Face pulls are not optional.',
        exercises: [
          { id: 'arnold_press', name: 'Arnold Press', target: '10–12' },
          { id: 'lateral_raise', name: 'DB Lateral Raises', target: '12–16' },
          { id: 'band_pull_apart', name: 'Band Pull-Aparts or Face Pulls', target: '15–20' }
        ]
      },
      {
        id: 'd3_c2', label: 'CIRCUIT', type: 'circuit', sets: 3, rest: '1:30 b/t rounds',
        coachNote: 'RPE 9. High reps for the pump. Squeeze at the top of every curl. Full extension on skull crushers.',
        exercises: [
          { id: 'barbell_curl', name: 'Barbell or DB Curl', target: '12–15' },
          { id: 'skull_crusher', name: 'DB Skull Crushers', target: '12–15' }
        ]
      },
      {
        id: 'd3_core', label: 'CORE FINISHER — CIRCUIT', type: 'core', sets: 3, rest: '1:00 b/t rounds',
        coachNote: 'RPE 8. Toes all the way to the bar — full range only. Add a plate on your back for the plank if it feels easy.',
        exercises: [
          { id: 'd3_ttb', name: 'Strict Toes to Bar', target: '10–15' },
          { id: 'd3_weight_sit_up', name: 'Weighted Sit-Up plate at chest', target: '15–20' },
          { id: 'd3_plank', name: 'Weighted Plank plate on back', target: '0:45' }
        ]
      }
    ]
  },
  {
    name: 'Full Body Power',
    tag: 'SQUAT · POWER · CONDITIONING',
    note: 'Moderate squat load — runs take priority. Power complex is explosive. Full send on the finisher.',
    circuits: [
      {
        id: 'd4_s1', label: 'STRAIGHT SETS', type: 'straight', sets: 4, rest: '2:00 b/t sets',
        coachNote: 'RPE 8. Controlled descent, drive through the whole foot. Moderate load — protecting the legs for run week.',
        exercises: [{ id: 'front_squat', name: 'Front Squat or Back Squat', target: '8–10', score: true }]
      },
      {
        id: 'd4_c1', label: 'CIRCUIT', type: 'circuit', sets: 3, rest: '2:00 b/t rounds',
        coachNote: 'RPE 9. KB swings = hip drive, not arm lift. Push press: dip and drive. Box jumps: land soft, step down, reset.',
        exercises: [
          { id: 'kb_swing', name: 'Heavy KB Swings', target: '12' },
          { id: 'db_push_press', name: 'DB Push Press', target: '10–12' },
          { id: 'box_jump', name: 'Box Jumps step down', target: '8' }
        ]
      },
      {
        id: 'd4_metcon', label: 'CONDITIONING FINISHER — tap your option', type: 'metcon', sets: 1, rest: 'as programmed', isMetcon: true,
        coachNote: 'Rotate A → B → C each week. All sub-15 minutes. Tap the one you completed.',
        exercises: [
          { id: 'metcon_a', name: 'Option A', desc: '5 rounds: 10 Pull-ups + 10 Dips + :30 rest' },
          { id: 'metcon_b', name: 'Option B', desc: 'EMOM 10 min: Even = 12 KB Swings · Odd = 8 Push Press' },
          { id: 'metcon_c', name: 'Option C', desc: '3 rounds: 10 Pushups + 10 Inverted Rows + 10 Air Squats + :60 rest' }
        ]
      },
      {
        id: 'd4_core', label: 'CORE FINISHER — CIRCUIT', type: 'core', sets: 3, rest: '1:00 b/t rounds',
        coachNote: 'RPE 8. V-ups: reach toes, not shins. Hollow hold: lower back glued to the floor.',
        exercises: [
          { id: 'd4_vup', name: 'V-Ups', target: '15–20' },
          { id: 'd4_hollow', name: 'Hollow Body Hold', target: '0:45' },
          { id: 'd4_side_plank', name: 'Side Plank Hold each side', target: '0:45/side' }
        ]
      }
    ]
  }
]

const STRENGTH = [
  {
    name: 'Upper Horizontal',
    tag: 'BENCH · ROWS · HEAVY PUSH/PULL',
    note: 'Strength phase — fewer reps, heavier weight, longer rest. Build on your hypertrophy base.',
    circuits: [
      {
        id: 'd1_s1', label: 'STRAIGHT SETS — 5x5', type: 'straight', sets: 5, rest: '3:00 b/t sets',
        coachNote: 'RPE 9. True 5x5 — same heavy weight across all 5 sets. Complete all 5 clean? Add 5lb next session.',
        exercises: [{ id: 'bench_press', name: 'Bench Press', target: '5', score: true }]
      },
      {
        id: 'd1_c1', label: 'STRAIGHT SETS — heavy', type: 'straight', sets: 4, rest: '2:00 b/t sets',
        coachNote: 'RPE 9. Weighted dips — add as much weight as you can handle for 6 clean, full-ROM reps.',
        exercises: [{ id: 'bar_dips', name: 'Weighted Bar Dips heavy', target: '5–6', score: true }]
      },
      {
        id: 'd1_c2', label: 'SUPERSET — alternate exercises each set, then rest', type: 'superset', sets: 4, rest: '1:00 b/t exercises · 2:00 b/t rounds',
        coachNote: 'RPE 9. Heavy barbell row — brace core and row to your hip. Keep the incline press controlled.',
        exercises: [
          { id: 'bb_bent_row', name: 'Barbell Bent Over Row', target: '5–6', score: true },
          { id: 'incline_db_press', name: 'Incline DB Press', target: '6–8' }
        ]
      },
      {
        id: 'd1_core', label: 'CORE FINISHER — CIRCUIT', type: 'core', sets: 3, rest: '1:00 b/t rounds',
        coachNote: 'RPE 8. Plank with a plate on your back. Dead bugs: slow, deliberate, lower back flat the whole time.',
        exercises: [
          { id: 'd1_hollow', name: 'Hollow Body Hold', target: '1:00' },
          { id: 'd1_deadbug', name: 'Slow Dead Bugs', target: '20 reps' },
          { id: 'd1_plank', name: 'Weighted Plank plate on back', target: '1:00' }
        ]
      }
    ]
  },
  {
    name: 'Lower Hinge + Glutes',
    tag: 'DEADLIFT · GLUTES · HEAVY HINGE',
    note: 'Strength phase — conventional deadlift replaces RDL as the anchor. Still glute-dominant.',
    circuits: [
      {
        id: 'd2_s1', label: 'STRAIGHT SETS — heavy', type: 'straight', sets: 4, rest: '3:00 b/t sets',
        coachNote: 'RPE 9. Big breath, full brace, pull. Control the descent every rep. Real posterior chain strength.',
        exercises: [{ id: 'deadlift', name: 'Conventional Deadlift', target: '3–5', score: true }]
      },
      {
        id: 'd2_c1', label: 'STRAIGHT SETS — heavy', type: 'straight', sets: 4, rest: '2:00 b/t sets',
        coachNote: 'RPE 9. Drive through the heel, squeeze at the top, hold one second. The glute king.',
        exercises: [{ id: 'hip_thrust', name: 'Barbell or DB Hip Thrust', target: '6–8', score: true }]
      },
      {
        id: 'd2_c2', label: 'SUPERSET — alternate exercises each set, then rest', type: 'superset', sets: 3, rest: '1:00 b/t exercises · 2:00 b/t rounds',
        coachNote: 'RPE 9. Split stance RDL loads one leg without the balance challenge. Heavy ham curl — 3-sec descent.',
        exercises: [
          { id: 'sl_rdl', name: 'Split Stance DB RDL heavy', target: '6–8/side' },
          { id: 'ham_curl', name: 'Hamstring Curl Rower or Machine 30X0', target: '8–10' }
        ]
      },
      {
        id: 'd2_core', label: 'CORE FINISHER — CIRCUIT', type: 'core', sets: 3, rest: '1:00 b/t rounds',
        coachNote: 'RPE 8. Add load everywhere possible. Ab wheel: full extension only if lower back stays flat.',
        exercises: [
          { id: 'd2_hang_raise', name: 'Hanging Leg Raises straight legs', target: '12–15' },
          { id: 'd2_rev_crunch', name: 'Weighted Reverse Crunch hold plate', target: '12–15' },
          { id: 'd2_ab_wheel', name: 'Ab Wheel Rollout full extension', target: '8–10' }
        ]
      }
    ]
  },
  {
    name: 'Upper Vertical + Arms',
    tag: 'PULL-UPS · PRESS · HEAVY ARMS',
    note: 'Strength phase — heavier weights, fewer reps. Build vertical pressing and pulling strength.',
    circuits: [
      {
        id: 'd3_s1', label: 'SUPERSET — 5x5, alternate each set, then rest', type: 'superset', sets: 5, rest: '1:30 b/t exercises · 3:00 b/t rounds',
        coachNote: 'RPE 9. Heavy pull + heavy press. Add weight to pull-ups. Same load across all 5 sets. No failed reps.',
        exercises: [
          { id: 'weighted_pullup', name: 'Weighted Pull-Ups heavy', target: '4–6', score: true },
          { id: 'strict_press', name: 'Strict Press heavy', target: '4–6', score: true }
        ]
      },
      {
        id: 'd3_c1', label: 'STRAIGHT SETS — heavy', type: 'straight', sets: 4, rest: '2:00 b/t sets',
        coachNote: 'RPE 9. Half-kneeling removes your ability to compensate with your lower body. Own the press.',
        exercises: [{ id: 'hk_press', name: 'Half-Kneeling Single Arm DB Press', target: '6–8/side', score: true }]
      },
      {
        id: 'd3_c2', label: 'CIRCUIT', type: 'circuit', sets: 3, rest: '1:30 b/t rounds',
        coachNote: 'RPE 9. Heavy enough on laterals that last 2–3 reps need a little cheat. Face pulls protect your shoulders.',
        exercises: [
          { id: 'lateral_raise', name: 'DB Lateral Raises', target: '10–12' },
          { id: 'band_pull_apart', name: 'Band Pull-Aparts or Face Pulls', target: '15–20' }
        ]
      },
      {
        id: 'd3_c3', label: 'SUPERSET — heavy arms', type: 'superset', sets: 3, rest: '1:00 b/t exercises · 1:30 b/t rounds',
        coachNote: 'RPE 9. Heavier curl — fewer reps, more load. Full extension on skull crushers every rep.',
        exercises: [
          { id: 'barbell_curl', name: 'Barbell Curl heavy', target: '6–8' },
          { id: 'skull_crusher', name: 'DB Skull Crushers heavy', target: '6–8' }
        ]
      },
      {
        id: 'd3_core', label: 'CORE FINISHER — CIRCUIT', type: 'core', sets: 3, rest: '1:00 b/t rounds',
        coachNote: 'RPE 8. Heavier plate on sit-ups. Plank: full tension head to heel for the full minute.',
        exercises: [
          { id: 'd3_ttb', name: 'Strict Toes to Bar', target: '12–15' },
          { id: 'd3_weight_sit_up', name: 'Weighted Sit-Up heavy plate', target: '12–15' },
          { id: 'd3_plank', name: 'Weighted Plank heavy plate', target: '1:00' }
        ]
      }
    ]
  },
  {
    name: 'Full Body Power',
    tag: 'SQUAT · POWER · HEAVY CONDITIONING',
    note: 'Strength phase — heavier squat and power complex. Still controlled — no wrecking legs before run week.',
    circuits: [
      {
        id: 'd4_s1', label: 'STRAIGHT SETS — heavy', type: 'straight', sets: 4, rest: '3:00 b/t sets',
        coachNote: 'RPE 9. Fewer reps, more load. No bouncing out of the hole. Controlled descent, drive hard out of the bottom.',
        exercises: [{ id: 'front_squat', name: 'Front Squat or Back Squat', target: '4–6', score: true }]
      },
      {
        id: 'd4_c1', label: 'CIRCUIT', type: 'circuit', sets: 4, rest: '2:00 b/t rounds',
        coachNote: 'RPE 9. Heavier KB swings — max hip snap. Heavier push press. Box jumps: focus on height and power.',
        exercises: [
          { id: 'kb_swing', name: 'Heavy KB Swings', target: '8–10' },
          { id: 'db_push_press', name: 'DB Push Press heavy', target: '6–8' },
          { id: 'box_jump', name: 'Box Jumps max height', target: '5–6' }
        ]
      },
      {
        id: 'd4_metcon', label: 'CONDITIONING FINISHER — tap your option', type: 'metcon', sets: 1, rest: 'as programmed', isMetcon: true,
        coachNote: 'Strength phase finishers — same formats, heavier loads. Tap the one you completed.',
        exercises: [
          { id: 'metcon_a', name: 'Option A', desc: '5 rounds: 8 Weighted Pull-ups + 8 Weighted Dips + :45 rest' },
          { id: 'metcon_b', name: 'Option B', desc: 'EMOM 12 min: Even = 10 Heavy KB Swings · Odd = 6 Heavy Push Press' },
          { id: 'metcon_c', name: 'Option C', desc: '4 rounds: 8 Strict Pull-ups + 10 Ring Rows + 10 Pushups + :60 rest' }
        ]
      },
      {
        id: 'd4_core', label: 'CORE FINISHER — CIRCUIT', type: 'core', sets: 3, rest: '1:00 b/t rounds',
        coachNote: 'RPE 8. Add load everywhere. Side plank: weight plate on your hip. Make it harder than hypertrophy phase.',
        exercises: [
          { id: 'd4_vup', name: 'Weighted V-Ups plate at chest', target: '12–15' },
          { id: 'd4_hollow', name: 'Hollow Body Hold', target: '1:00' },
          { id: 'd4_side_plank', name: 'Weighted Side Plank each side', target: '0:45/side' }
        ]
      }
    ]
  }
]

const PHASES = { hypertrophy: HYPERTROPHY, strength: STRENGTH }

function clampDayIndex(phaseKey, dayIdx) {
  const max = PHASES[phaseKey].length - 1
  const d = Number(dayIdx)
  if (!Number.isFinite(d) || d < 0) return 0
  return Math.min(d, max)
}

/** Prefer phase/day from workouts saved today, then localStorage. */
function resolvePhaseAndDayFromHistory(histRows) {
  const todayStr = today()
  const rows = (histRows || []).filter(h => h.session_date === todayStr)
  if (rows.length) {
    const sorted = [...rows].sort((a, b) => {
      const ua = String(a.updated_at || a.created_at || '')
      const ub = String(b.updated_at || b.created_at || '')
      if (ub !== ua) return ub.localeCompare(ua)
      return String(b.id || '').localeCompare(String(a.id || ''))
    })
    const pick = sorted[0]
    const ph = pick.phase === 'strength' ? 'strength' : 'hypertrophy'
    return { phase: ph, activeDay: clampDayIndex(ph, pick.day_idx) }
  }
  const p = localStorage.getItem(LS_PHASE)
  const ph = p === 'strength' ? 'strength' : 'hypertrophy'
  const dRaw = localStorage.getItem(LS_ACTIVE_DAY)
  const d = dRaw != null ? Number(dRaw) : 0
  return { phase: ph, activeDay: clampDayIndex(ph, d) }
}

/** Migrate flat JSON from older today_log rows into per-phase buckets. */
function migrateTodayLogPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { hypertrophy: {}, strength: {} }
  if (Object.prototype.hasOwnProperty.call(raw, 'hypertrophy') || Object.prototype.hasOwnProperty.call(raw, 'strength')) {
    return { hypertrophy: raw.hypertrophy || {}, strength: raw.strength || {} }
  }
  return { hypertrophy: { ...raw }, strength: {} }
}

/** Miles + run quality; replaces old low/normal/high “running load” vs lifting. */
const RUN_TYPES = ['off', 'easy', 'tempo', 'intervals', 'long', 'recovery', 'strides', 'race', 'mixed']

const DEFAULT_COACH_CONTEXT = { runMiles: '', runType: 'off', sleepHours: '', sleepFeel: 'ok', deload: false, race: false }

function normalizeCoachContext(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_COACH_CONTEXT }
  const runMiles = raw.runMiles != null && String(raw.runMiles).trim() !== '' ? String(raw.runMiles).trim() : ''
  let runType = RUN_TYPES.includes(raw.runType) ? raw.runType : 'off'
  // Legacy: low/normal/high = coarse fatigue vs weights (not miles). Map into run types when new fields absent.
  if (!raw.runType && ['low', 'normal', 'high'].includes(raw.running)) {
    runType = raw.running === 'low' ? 'easy' : raw.running === 'high' ? 'intervals' : 'tempo'
  }
  return {
    runMiles,
    runType,
    sleepHours: raw.sleepHours != null && String(raw.sleepHours).trim() !== '' ? String(raw.sleepHours).trim() : '',
    sleepFeel: ['great', 'good', 'ok', 'poor', 'bad'].includes(raw.sleepFeel) ? raw.sleepFeel : 'ok',
    deload: Boolean(raw.deload),
    race: Boolean(raw.race)
  }
}

function formatRunContextLine(c) {
  const mi = String(c.runMiles || '').trim()
  if (c.runType === 'off' && !mi) return 'no run logged'
  const dist = mi ? `${mi} mi` : 'distance not specified'
  return `${dist} · ${c.runType}`
}

// ─── APP ───

export default function App() {
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState('workout')
  const [phase, setPhase] = useState('hypertrophy')
  const [activeDay, setActiveDay] = useState(0)
  const [setsByPhase, setSetsByPhase] = useState({ hypertrophy: {}, strength: {} })
  const [metconByPhase, setMetconByPhase] = useState({ hypertrophy: {}, strength: {} })
  const [prs, setPrs] = useState({})
  const [history, setHistory] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [coachStructured, setCoachStructured] = useState(null)
  const [coachPlain, setCoachPlain] = useState('')
  const [lastUserPrompt, setLastUserPrompt] = useState('')
  const [lastCoachMsg, setLastCoachMsg] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [insightScope, setInsightScope] = useState('session')
  const [coachContext, setCoachContext] = useState(() => ({ ...DEFAULT_COACH_CONTEXT }))
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState('')
  const [planData, setPlanData] = useState(null)
  const [importMsg, setImportMsg] = useState('')
  const importRef = useRef(null)
  const [saveMsg, setSaveMsg] = useState('')
  const [noteOpen, setNoteOpen] = useState({})
  const [online, setOnline] = useState(navigator.onLine)
  const [pressed, setPressed] = useState(null)
  const autoSaveTimer = useRef(null)
  const pendingSave = useRef(null)
  const scrollRef = useRef(null)
  const loadedRef = useRef(false)
  /** Latest snapshot for flush / races — updated every render */
  const latestTodayRef = useRef({ setsByPhase, metconByPhase, coachContext })
  /** Incremented on each today_log write; stale completions must not clobber newer state. */
  const todayLogWriteGen = useRef(0)

  latestTodayRef.current = { setsByPhase, metconByPhase, coachContext }

  const days = PHASES[phase]
  const dayData = days[activeDay]
  const sets = setsByPhase[phase] || {}
  const metconSel = metconByPhase[phase] || {}

  // ─── Online/offline tracking ───
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // ─── Retry pending save on reconnect ───
  useEffect(() => {
    if (online && pendingSave.current && supabase) {
      const data = pendingSave.current
      pendingSave.current = null
      ;(async () => {
        const res = await upsertTodayLogCompat(supabase, data)
        if (res.error) pendingSave.current = data
      })().catch(() => { pendingSave.current = data })
    }
  }, [online])

  // ─── Dismiss keyboard on scroll ───
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(() => {
          if (document.activeElement && document.activeElement.tagName === 'INPUT') {
            document.activeElement.blur()
          }
          ticking = false
        })
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [loaded])

  useEffect(() => {
    loadedRef.current = loaded
  }, [loaded])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(LS_PHASE, phase)
      localStorage.setItem(LS_ACTIVE_DAY, String(activeDay))
    } catch (_) { /* private mode */ }
  }, [phase, activeDay, loaded])

  useEffect(() => {
    const max = PHASES[phase].length - 1
    if (activeDay > max) setActiveDay(max)
  }, [phase, activeDay])

  // ─── Flush today_log when app backgrounded or closed (mobile PWA) ───
  useEffect(() => {
    if (!supabase) return
    const flush = () => {
      if (!loadedRef.current) return
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current)
        autoSaveTimer.current = null
      }
      const snap = latestTodayRef.current
      const payload = {
        user_id: USER_ID,
        log_date: today(),
        sets_data: snap.setsByPhase,
        metcon_sel: snap.metconByPhase,
        coach_context: normalizeCoachContext(snap.coachContext),
        updated_at: new Date().toISOString()
      }
      const gen = ++todayLogWriteGen.current
      void (async () => {
        const res = await upsertTodayLogCompat(supabase, payload)
        if (gen !== todayLogWriteGen.current) return
        if (res.error) pendingSave.current = payload
        else pendingSave.current = null
      })()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
    }
  }, [supabase])

  // ─── Load data on mount ───
  useEffect(() => {
    if (!supabase) { setLoaded(true); return }
    ;(async () => {
      try {
        const [prRes, histRes] = await Promise.all([
          supabase.from('personal_records').select('exercise_id, weight, recorded_date').eq('user_id', USER_ID),
          supabase.from('workout_sessions').select('*').eq('user_id', USER_ID).order('session_date', { ascending: false }).limit(HISTORY_LIMIT)
        ])

        if (histRes.error) {
          console.error('workout_sessions load error:', histRes.error)
          setHistory([])
          if (prRes.data?.length) {
            const p = {}
            prRes.data.forEach(r => { p[r.exercise_id] = { weight: Number(r.weight), date: r.recorded_date } })
            setPrs(p)
          } else {
            setPrs({})
          }
        } else if (histRes.data?.length) {
          setHistory(histRes.data)
          setPrs(recalculatePrsFromSessions(histRes.data))
        } else {
          setHistory([])
          if (prRes.data?.length) {
            const p = {}
            prRes.data.forEach(r => { p[r.exercise_id] = { weight: Number(r.weight), date: r.recorded_date } })
            setPrs(p)
          } else {
            setPrs({})
          }
        }

        const { phase: restoredPhase, activeDay: restoredDay } = resolvePhaseAndDayFromHistory(
          !histRes.error ? histRes.data : null
        )
        setPhase(restoredPhase)
        setActiveDay(restoredDay)

        let todayRes = await supabase.from('today_log').select('sets_data, metcon_sel, coach_context').eq('user_id', USER_ID).eq('log_date', today()).maybeSingle()
        if (todayRes.error && coachContextColumnError(todayRes.error)) {
          console.warn('today_log: coach_context column missing — run supabase/migrations/002_coach_context.sql')
          todayRes = await supabase.from('today_log').select('sets_data, metcon_sel').eq('user_id', USER_ID).eq('log_date', today()).maybeSingle()
        } else if (todayRes.error) {
          console.error('today_log load error:', todayRes.error)
        }

        if (todayRes.data) {
          if (todayRes.data.sets_data) setSetsByPhase(migrateTodayLogPayload(todayRes.data.sets_data))
          if (todayRes.data.metcon_sel) setMetconByPhase(migrateTodayLogPayload(todayRes.data.metcon_sel))
          setCoachContext(normalizeCoachContext(todayRes.data.coach_context ?? {}))
        }
      } catch (e) {
        console.error('Load error:', e)
      }
      setLoaded(true)
    })()
  }, [])

  // ─── Auto-save today log on changes (debounced; stale writes ignored via todayLogWriteGen) ───
  useEffect(() => {
    if (!loaded || !supabase) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      const snap = latestTodayRef.current
      const payload = {
        user_id: USER_ID,
        log_date: today(),
        sets_data: snap.setsByPhase,
        metcon_sel: snap.metconByPhase,
        coach_context: normalizeCoachContext(snap.coachContext),
        updated_at: new Date().toISOString()
      }
      const gen = ++todayLogWriteGen.current
      void (async () => {
        try {
          const res = await upsertTodayLogCompat(supabase, payload)
          if (gen !== todayLogWriteGen.current) return
          if (res.error) {
            pendingSave.current = payload
            console.error('Auto-save error:', res.error)
          } else {
            pendingSave.current = null
          }
        } catch (e) {
          if (gen !== todayLogWriteGen.current) return
          pendingSave.current = payload
          console.error('Auto-save error:', e)
        }
      })()
    }, TODAY_LOG_AUTOSAVE_MS)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [setsByPhase, metconByPhase, coachContext, loaded, supabase])

  // ─── Scroll to top on tab/day change ───
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [tab, activeDay, phase])

  // ─── Set row updates ───
  const updateSet = useCallback((circuitId, exId, idx, field, val, totalSets) => {
    const key = circuitId + '__' + exId
    setSetsByPhase(prev => {
      const cur = prev[phase] || {}
      const base = Array.from({ length: totalSets }, (_, i) =>
        (cur[key] && cur[key][i]) ? { ...cur[key][i] } : { weight: '', reps: '', done: false }
      )
      base[idx] = { ...base[idx], [field]: val }
      return { ...prev, [phase]: { ...cur, [key]: base } }
    })
  }, [phase])

  const toggleDone = useCallback((circuitId, exId, idx, totalSets) => {
    const key = circuitId + '__' + exId
    setSetsByPhase(prev => {
      const cur = prev[phase] || {}
      const base = Array.from({ length: totalSets }, (_, i) =>
        (cur[key] && cur[key][i]) ? { ...cur[key][i] } : { weight: '', reps: '', done: false }
      )
      base[idx] = { ...base[idx], done: !base[idx].done }
      return { ...prev, [phase]: { ...cur, [key]: base } }
    })
  }, [phase])

  const toggleMetcon = useCallback((circuitId, exId) => {
    setMetconByPhase(prev => {
      const cur = prev[phase] || {}
      return {
        ...prev,
        [phase]: {
          ...cur,
          [circuitId]: cur[circuitId] === exId ? null : exId
        }
      }
    })
  }, [phase])

  // ─── Save workout ───
  const saveWorkout = async () => {
    if (!supabase) { setSaveMsg('ERR: DB not configured'); setTimeout(() => setSaveMsg(''), 3000); return }
    if (!dayData) { setSaveMsg('ERR: No day selected'); setTimeout(() => setSaveMsg(''), 3000); return }
    setSaveMsg('SAVING...')
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = null
    }
    todayLogWriteGen.current++
    try {
      const snap = latestTodayRef.current
      const ctx = normalizeCoachContext(snap.coachContext)
      const sessionRow = {
        user_id: USER_ID,
        session_date: today(),
        day_idx: activeDay,
        day_name: dayData.name,
        phase,
        sets_data: snap.setsByPhase[phase] || {},
        metcon_sel: snap.metconByPhase[phase] || {},
        coach_context: ctx
      }
      let up = await upsertWorkoutSessionCompat(supabase, sessionRow)
      if (up.error) throw new Error(up.error.message || 'workout_sessions save failed')

      const logRow = {
        user_id: USER_ID,
        log_date: today(),
        sets_data: snap.setsByPhase,
        metcon_sel: snap.metconByPhase,
        coach_context: ctx,
        updated_at: new Date().toISOString()
      }
      up = await upsertTodayLogCompat(supabase, logRow)
      if (up.error) throw new Error(up.error.message || 'today_log save failed')

      const histQ = await supabase.from('workout_sessions').select('*').eq('user_id', USER_ID).order('session_date', { ascending: false }).limit(HISTORY_LIMIT)
      if (histQ.error) throw new Error(histQ.error.message || 'Failed to reload history')

      const freshHist = histQ.data || []
      setHistory(freshHist)
      if (freshHist.length) {
        const prMap = recalculatePrsFromSessions(freshHist)
        setPrs(prMap)
        await syncPersonalRecordsToDb(supabase, USER_ID, prMap)
      }

      setSaveMsg('✓ SAVED')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (e) {
      console.error('Save error:', e)
      setSaveMsg('ERR: ' + e.message)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  const buildExerciseLines = (circuits) => {
    const lines = []
    for (const circuit of circuits) {
      if (circuit.isMetcon) continue
      for (const ex of circuit.exercises) {
        const key = circuit.id + '__' + ex.id
        const rows = sets[key] || []
        const logged = rows.filter(r => r.weight || r.reps).map((r, i) => `Set ${i+1}: ${r.weight || '?'}lb x ${r.reps || '?'} ${r.done ? '(done)' : ''}`).join(', ')
        const pr = prs[ex.id] ? `PR: ${prs[ex.id].weight}lb (${prs[ex.id].date})` : 'No PR yet'
        lines.push(`${ex.name} [target: ${ex.target}] — ${logged || 'no sets logged'} — ${pr}`)
      }
    }
    return lines
  }

  const coachContextBlock = () => {
    const c = normalizeCoachContext(coachContext)
    const parts = []
    parts.push(`Run: ${formatRunContextLine(c)}`)
    const hrs = String(c.sleepHours || '').trim()
    parts.push(hrs ? `Hours slept (last night): ${hrs}` : 'Hours slept (last night): not specified')
    parts.push(`Perceived sleep quality: ${c.sleepFeel}`)
    if (c.deload) parts.push('Deload week: yes')
    if (c.race) parts.push('Race week: yes')
    return `\nAthlete context (from session form — also stored in DB):\n${parts.map(p => `• ${p}`).join('\n')}`
  }

  const formatSessionBriefForInsight = (h) => {
    const sd = h.sets_data || {}
    const lines = []
    Object.entries(sd).forEach(([k, rows]) => {
      if (!Array.isArray(rows)) return
      const best = Math.max(0, ...rows.filter(s => s.done).map(s => Number(s.weight) || 0))
      if (best > 0) lines.push(`  ${k}: best ${best}lb`)
    })
    const ctx = h.coach_context
    let ctxLine = ''
    if (ctx && typeof ctx === 'object') {
      const n = normalizeCoachContext(ctx)
      ctxLine = `  saved context: run (${formatRunContextLine(n)}), sleep=${n.sleepHours || '—'}h, feel=${n.sleepFeel}${n.deload ? ', deload' : ''}${n.race ? ', race' : ''}\n`
    }
    return `— ${h.session_date} · ${h.phase} · day ${Number(h.day_idx) + 1} (${h.day_name})\n${ctxLine}${lines.join('\n') || '  (no weights logged)'}`
  }

  const parseCoachResponse = (data, updateLastMsg = false) => {
    if (data.content && data.content[0]) {
      const t = data.content[0].text
      if (updateLastMsg) setLastCoachMsg(t)
      try {
        const stripped = t.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
        setCoachStructured(JSON.parse(stripped))
        setCoachPlain('')
      } catch {
        setCoachStructured(null)
        setCoachPlain(t)
      }
    } else if (data.error) {
      setCoachPlain('Error: ' + (data.error.message || JSON.stringify(data.error)))
    } else {
      setCoachPlain(JSON.stringify(data, null, 2))
    }
  }

  // ─── AI Insights (INSIGHT tab) ───
  const getInsightsSession = async () => {
    setAiLoading(true)
    setCoachPlain('')
    setCoachStructured(null)
    setFollowUp('')
    try {
      const exerciseLines = buildExerciseLines(dayData.circuits)
      const sameDayHist = history.filter(h => h.day_idx === activeDay && (h.phase || 'hypertrophy') === phase).slice(0, 3)
      let histBlock = 'No previous sessions for this day.'
      if (sameDayHist.length > 0) {
        histBlock = sameDayHist.map(h => {
          const d = h.sets_data || {}
          const lines = Object.entries(d).map(([k, v]) => {
            const best = Math.max(0, ...v.filter(s => s.done).map(s => Number(s.weight) || 0))
            return `  ${k}: best ${best}lb`
          }).join('\n')
          return `Session ${h.session_date}:\n${lines}`
        }).join('\n\n')
      }

      const prompt = `You are a strength coach reviewing a single workout session. Be direct and specific.
${coachContextBlock()}

TODAY — ${phase.toUpperCase()} PHASE — Day ${activeDay + 1}: ${dayData.name}

Exercises logged:
${exerciseLines.join('\n')}

Last 3 sessions of this same day/phase:
${histBlock}

Return ONLY valid JSON with: grade (A/B/C/D), summary (one sentence), bullets (string array: recommendations per lift, rep-drop flags, PR notes), risks (string array), next_session_focus (one string).`

      setLastUserPrompt(prompt)
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, jsonMode: true })
      })
      let data
      try {
        data = await res.json()
      } catch {
        setCoachPlain('Error: Could not read coach response')
        setAiLoading(false)
        return
      }
      if (!res.ok) {
        setCoachPlain('Error: ' + (data.error?.message || res.statusText))
        setAiLoading(false)
        return
      }
      parseCoachResponse(data, true)
    } catch (e) {
      setCoachPlain('Error: ' + e.message)
    }
    setAiLoading(false)
  }

  const getInsightsWeek = async () => {
    setAiLoading(true)
    setCoachPlain('')
    setCoachStructured(null)
    setFollowUp('')
    try {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 7)
      const cs = cutoff.getFullYear() + '-' + String(cutoff.getMonth() + 1).padStart(2, '0') + '-' + String(cutoff.getDate()).padStart(2, '0')
      const recent = history.filter(h => (h.session_date || '') >= cs).sort((a, b) => (b.session_date || '').localeCompare(a.session_date || ''))
      const block = recent.map(formatSessionBriefForInsight).join('\n\n')
      const prLines = Object.entries(prs).slice(0, 40).map(([id, v]) => `${id}: ${v.weight}lb @ ${v.date}`).join('\n')

      const prompt = `You are a strength coach. The athlete follows a 4-day lifting program (hypertrophy or strength blocks) while running heavily. Review their last 7 CALENDAR DAYS of saved sessions.
${coachContextBlock()}
Note: "Athlete context" above is how they feel RIGHT NOW in the app (today's form); calendar sessions below include the coach_context saved on each day when they hit save.

App phase toggle (where they are browsing): ${phase}

PR snapshot:
${prLines || 'none'}

Sessions in window (${recent.length}):
${block || 'No sessions in the last 7 days.'}

Return ONLY valid JSON: grade (A-D) for the WEEK, summary (one sentence on the week), bullets (4-10 strings: patterns, fatigue, lift trends, weekly adjustments), risks (string array), next_session_focus (priority for the next training day).`

      setLastUserPrompt(prompt)
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, jsonMode: true })
      })
      let data
      try {
        data = await res.json()
      } catch {
        setCoachPlain('Error: Could not read coach response')
        setAiLoading(false)
        return
      }
      if (!res.ok) {
        setCoachPlain('Error: ' + (data.error?.message || res.statusText))
        setAiLoading(false)
        return
      }
      parseCoachResponse(data, true)
    } catch (e) {
      setCoachPlain('Error: ' + e.message)
    }
    setAiLoading(false)
  }

  const submitFollowUp = async () => {
    if (!followUp.trim() || !lastUserPrompt || !lastCoachMsg) return
    setAiLoading(true)
    try {
      const messages = [
        { role: 'user', content: lastUserPrompt },
        { role: 'assistant', content: lastCoachMsg },
        { role: 'user', content: followUp.trim() }
      ]
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, jsonMode: true })
      })
      let data
      try {
        data = await res.json()
      } catch {
        setCoachPlain('Error: Could not read follow-up')
        setAiLoading(false)
        return
      }
      if (!res.ok) {
        setCoachPlain('Error: ' + (data.error?.message || res.statusText))
        setAiLoading(false)
        return
      }
      if (data.content && data.content[0]) {
        const t = data.content[0].text
        setLastCoachMsg(t)
        try {
          const stripped = t.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
          setCoachStructured(JSON.parse(stripped))
          setCoachPlain('')
        } catch {
          setCoachStructured(null)
          setCoachPlain(t)
        }
      }
      setFollowUp('')
    } catch (e) {
      setCoachPlain('Error: ' + e.message)
    }
    setAiLoading(false)
  }

  const requestPlanWeek = async () => {
    setPlanLoading(true)
    setPlanError('')
    setPlanData(null)
    try {
      const res = await fetch('/api/plan-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase,
          programOutline: buildProgramOutline(PHASES, phase),
          recentSessions: history.slice(0, 40),
          prsSnapshot: prs
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || res.statusText)
      if (!data.plan) throw new Error('No plan in response')
      setPlanData(data.plan)
    } catch (e) {
      setPlanError(e.message || 'Plan failed')
    }
    setPlanLoading(false)
  }

  const applyPlanWeights = (mode) => {
    if (!planData?.suggestions?.length) return
    setSetsByPhase(prev => {
      const ph = phase
      const cur = { ...prev[ph] }
      for (const s of planData.suggestions) {
        if (mode === 'day' && s.dayIndex !== activeDay) continue
        const meta = findSetKeyForExercise(PHASES, phase, s.dayIndex, s.exerciseId)
        if (!meta) continue
        const rows = s.sets || []
        const base = Array.from({ length: meta.totalSets }, (_, i) =>
          (cur[meta.key] && cur[meta.key][i]) ? { ...cur[meta.key][i] } : { weight: '', reps: '', done: false }
        )
        rows.forEach((row, i) => {
          if (i >= base.length) return
          const w = row.weightLb
          if (w == null || !Number.isFinite(Number(w))) return
          base[i] = { ...base[i], weight: String(w) }
        })
        cur[meta.key] = base
      }
      return { ...prev, [ph]: cur }
    })
  }

  const handleExport = () => {
    const payload = buildExportPayload({
      userId: USER_ID,
      prs,
      history,
      setsByPhase,
      metconByPhase,
      logDate: today(),
      coachContext: normalizeCoachContext(coachContext)
    })
    downloadJson(payload)
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportMsg('Reading...')
    try {
      const text = await file.text()
      const raw = JSON.parse(text)
      const v = validateImportPayload(raw)
      if (!v.ok) {
        setImportMsg(v.error)
        return
      }
      const d = v.data
      const sessions = Array.isArray(d.workoutSessions) ? d.workoutSessions : []
      setHistory(sessions)
      const prMap = recalculatePrsFromSessions(sessions)
      const prFinal = Object.keys(prMap).length ? prMap : (d.personalRecords && typeof d.personalRecords === 'object' ? d.personalRecords : {})
      setPrs(prFinal)
      if (d.todayLog?.sets_data) setSetsByPhase(migrateTodayLogPayload(d.todayLog.sets_data))
      if (d.todayLog?.metcon_sel) setMetconByPhase(migrateTodayLogPayload(d.todayLog.metcon_sel))
      if (d.todayLog?.coach_context) setCoachContext(normalizeCoachContext(d.todayLog.coach_context))

      if (supabase) {
        await syncPersonalRecordsToDb(supabase, USER_ID, prFinal)
        for (const row of sessions) {
          const { id: _id, ...rest } = row
          const up = await upsertWorkoutSessionCompat(supabase, rest)
          if (up.error) throw new Error(up.error.message || 'workout_sessions import failed')
        }
        const importLogRow = {
          user_id: USER_ID,
          log_date: today(),
          sets_data: migrateTodayLogPayload(d.todayLog?.sets_data || {}),
          metcon_sel: migrateTodayLogPayload(d.todayLog?.metcon_sel || {}),
          coach_context: normalizeCoachContext(d.todayLog?.coach_context || {}),
          updated_at: new Date().toISOString()
        }
        const logUp = await upsertTodayLogCompat(supabase, importLogRow)
        if (logUp.error) throw new Error(logUp.error.message || 'today_log import failed')
      }
      setImportMsg('Imported.')
      setTimeout(() => setImportMsg(''), 3000)
    } catch (err) {
      setImportMsg('Error: ' + err.message)
    }
  }

  const statsBundle = useMemo(() => ({
    tonnage: totalTonnageFromSessions(history),
    perWeek: sessionsPerWeek(history),
    streak: sessionDayStreak(history),
    trends: exerciseTrendFromSessions(history, 5)
  }), [history])

  // ─── Done counting ───
  const circuitDoneCount = (circuit) => {
    if (circuit.isMetcon) return metconSel[circuit.id] ? 1 : 0
    let done = 0, total = 0
    for (const ex of circuit.exercises) {
      const key = circuit.id + '__' + ex.id
      const rows = sets[key] || []
      for (let i = 0; i < circuit.sets; i++) {
        total++
        if (rows[i] && rows[i].done) done++
      }
    }
    return { done, total }
  }

  const allExercisesByDay = () => {
    const result = [[], [], [], []]
    const seen = new Set()
    for (const phaseKey of ['hypertrophy', 'strength']) {
      const phaseDays = PHASES[phaseKey]
      phaseDays.forEach((day, dayIdx) => {
        day.circuits.forEach(circuit => {
          if (circuit.isMetcon) return
          circuit.exercises.forEach(ex => {
            if (!seen.has(ex.id) && prs[ex.id]) {
              seen.add(ex.id)
              result[dayIdx].push(ex)
            }
          })
        })
      })
    }
    return result
  }

  // ─── Tap feedback helper ───
  const onPress = (id) => { setPressed(id); setTimeout(() => setPressed(null), 150) }

  // ─── Tap outside inputs to dismiss keyboard ───
  const onTapBackground = (e) => {
    if (e.target.tagName !== 'INPUT' && document.activeElement && document.activeElement.tagName === 'INPUT') {
      document.activeElement.blur()
    }
  }

  // ─── STYLES ───
  const S = {
    shell: {
      fontFamily: FONT, background: BG, color: TEXT, height: '100%',
      display: 'flex', flexDirection: 'column', maxWidth: 600, margin: '0 auto',
      WebkitFontSmoothing: 'antialiased', position: 'relative', overflow: 'hidden'
    },
    stickyTop: {
      flexShrink: 0, background: BG, zIndex: 10,
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
    },
    scrollArea: {
      flex: 1, overflowY: 'auto', overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
      padding: '0 12px',
      paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
    },
    offlineBanner: {
      background: RED + '30', borderBottom: `1px solid ${RED}50`,
      padding: '6px 12px', fontSize: 10, color: RED, textAlign: 'center',
      fontFamily: FONT, fontWeight: 700, letterSpacing: 1
    },
    header: { padding: '12px 12px 6px' },
    titleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    h1: { fontSize: 15, fontWeight: 700, letterSpacing: 2, color: ACCENT, margin: 0 },
    h2: { fontSize: 9, fontWeight: 400, letterSpacing: 3, color: MUTED, margin: '2px 0 0' },
    dateText: { fontSize: 10, color: MUTED, textAlign: 'right' },
    phaseText: { fontSize: 10, color: ACCENT, textAlign: 'right', marginTop: 2 },
    phaseToggle: { display: 'flex', gap: 6, margin: '8px 0 6px', padding: '0' },
    phaseBtn: (active) => ({
      flex: 1, padding: '10px 4px', border: 'none', borderRadius: 4, fontFamily: FONT,
      fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
      background: active ? ACCENT : '#1a1a1a', color: active ? '#000' : MUTED,
      minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }),
    tabs: { display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, padding: '0 12px' },
    tab: (active) => ({
      flex: 1, padding: '10px 2px', border: 'none', borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
      background: 'transparent', color: active ? ACCENT : MUTED, fontFamily: FONT, fontSize: 9,
      fontWeight: 700, letterSpacing: 1, textAlign: 'center', minHeight: 44
    }),
    chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, alignItems: 'center' },
    chipLabel: { fontSize: 9, color: MUTED, width: '100%', letterSpacing: 1 },
    chipBtn: (on) => ({
      fontSize: 9, padding: '6px 10px', borderRadius: 4, border: `1px solid ${on ? ACCENT : BORDER}`,
      background: on ? ACCENT + '22' : 'transparent', color: on ? ACCENT : MUTED, fontFamily: FONT, fontWeight: 700,
      minHeight: 28, boxSizing: 'border-box', lineHeight: 1.2
    }),
    statCard: {
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12, marginBottom: 10
    },
    statLabel: { fontSize: 10, color: MUTED, letterSpacing: 1 },
    statValue: { fontSize: 18, fontWeight: 700, color: ACCENT, marginTop: 4 },
    planBox: { background: CARD, border: `1px solid ${BLUE}40`, borderRadius: 6, padding: 12, marginBottom: 12 },
    contextCard: {
      background: CARD, border: `1px solid ${ACCENT}35`, borderRadius: 6, padding: '10px 12px 12px', marginBottom: 14,
      display: 'flex', flexDirection: 'column', gap: 0
    },
    contextHint: { fontSize: 9, color: MUTED, marginTop: 10, lineHeight: 1.45, paddingTop: 2, borderTop: `1px solid ${BORDER}` },
    contextField: { marginBottom: 12 },
    contextFieldLabel: {
      display: 'block', fontSize: 8, color: MUTED, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6
    },
    contextInput: {
      width: 64, minWidth: 64, minHeight: 28, boxSizing: 'border-box', padding: '0 8px',
      textAlign: 'center', background: '#1a1a1a', border: `1px solid ${BORDER}`,
      borderRadius: 4, color: TEXT, fontFamily: FONT, fontSize: 11, fontWeight: 600
    },
    contextChipWrap: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
    daySelector: { display: 'flex', gap: 6, margin: '8px 0 12px' },
    dayBtn: (active) => ({
      flex: 1, padding: '10px 0', border: 'none', borderRadius: 4, fontFamily: FONT,
      background: active ? ACCENT : '#1a1a1a', color: active ? '#000' : MUTED,
      textAlign: 'center', minHeight: 54
    }),
    dayBtnSm: { fontSize: 8, letterSpacing: 1, display: 'block', marginBottom: 2 },
    dayBtnLg: { fontSize: 20, fontWeight: 700, display: 'block' },
    dayHeader: { marginBottom: 12 },
    dayNum: { fontSize: 10, color: MUTED, letterSpacing: 2 },
    dayTag: { fontSize: 10, color: ACCENT, letterSpacing: 1, marginTop: 2 },
    dayName: { fontSize: 18, fontWeight: 700, marginTop: 4 },
    dayNote: { fontSize: 11, color: '#aaaaaa', marginTop: 6, paddingLeft: 10, borderLeft: `2px solid ${ACCENT}`, lineHeight: 1.5 },
    legend: { display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
    legendItem: { display: 'flex', alignItems: 'center', gap: 4 },
    legendSwatch: (c) => ({ width: 10, height: 10, borderRadius: 2, background: c }),
    legendLabel: { fontSize: 9, color: '#999999', letterSpacing: 1 },
    circuitCard: (c) => ({
      background: CARD, border: `2px solid ${c}`, borderRadius: 6, marginBottom: 12, overflow: 'hidden'
    }),
    circuitHeader: (c) => ({
      padding: '10px 10px', background: c + '18', display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', flexWrap: 'wrap', gap: 4, minHeight: 48
    }),
    circuitLabel: (c) => ({ fontSize: 10, fontWeight: 700, color: c, letterSpacing: 1 }),
    circuitMeta: { fontSize: 10, color: '#999999', marginTop: 2 },
    circuitDone: (complete) => ({
      fontSize: 11, fontWeight: 700, color: complete ? GREEN : MUTED, minWidth: 44, textAlign: 'right'
    }),
    goalBtn: (c, isPressed) => ({
      fontSize: 10, padding: '6px 12px', border: `1px solid ${c}`, borderRadius: 4, background: 'transparent',
      color: c, fontFamily: FONT, fontWeight: 700, letterSpacing: 1, marginLeft: 6,
      minHeight: 32, minWidth: 52, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      opacity: isPressed ? 0.6 : 1, transform: isPressed ? 'scale(0.95)' : 'none',
      transition: 'opacity 0.1s, transform 0.1s'
    }),
    coachNote: (c) => ({
      padding: '10px 12px', fontSize: 12, color: TEXT, background: c + '10', borderTop: `1px solid ${c}30`,
      lineHeight: 1.5
    }),
    exerciseBlock: { padding: '10px 10px 8px' },
    exerciseHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    exerciseName: { fontSize: 13, fontWeight: 700 },
    exerciseTarget: { fontSize: 11, color: '#999999', marginTop: 2 },
    prBadge: { fontSize: 9, fontWeight: 700, color: ACCENT, background: ACCENT + '20', padding: '3px 8px', borderRadius: 3 },
    colHeaders: { display: 'grid', gridTemplateColumns: '30px 1fr 1fr 44px', gap: 6, marginBottom: 6, padding: '0 2px' },
    colHeader: { fontSize: 9, color: '#999999', letterSpacing: 1, textAlign: 'center', fontWeight: 700 },
    setRow: { display: 'grid', gridTemplateColumns: '30px 1fr 1fr 44px', gap: 6, marginBottom: 6, alignItems: 'center', padding: '0 2px' },
    setNum: { fontSize: 12, color: MUTED, textAlign: 'center', fontWeight: 700 },
    setInput: (done) => ({
      width: '100%', padding: '8px 4px',
      border: done ? `1px solid ${GREEN}50` : `1px solid ${BORDER}`,
      borderRadius: 4, background: done ? GREEN + '15' : '#1a1a1a', color: TEXT, fontFamily: FONT,
      fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none',
      minHeight: 40
    }),
    checkBtn: (done, isPressed) => ({
      width: 44, height: 44, border: done ? `2px solid ${GREEN}` : `2px solid ${BORDER}`, borderRadius: 6,
      background: done ? GREEN : 'transparent', color: done ? '#000' : MUTED,
      fontFamily: FONT, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center',
      justifyContent: 'center', margin: '0 auto', padding: 0,
      opacity: isPressed ? 0.6 : 1, transform: isPressed ? 'scale(0.9)' : 'none',
      transition: 'opacity 0.1s, transform 0.1s'
    }),
    divider: (c) => ({ height: 1, background: c + '40', margin: '8px 0' }),
    metconCard: (selected) => ({
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px', margin: '6px 10px',
      borderRadius: 6, border: selected ? `2px solid ${GREEN}` : `2px solid ${BORDER}`,
      background: selected ? GREEN + '15' : '#1a1a1a', transition: 'all 0.15s ease',
      minHeight: 52
    }),
    metconBadge: (selected) => ({
      width: 32, height: 32, borderRadius: 6, background: selected ? GREEN : '#333',
      color: selected ? '#000' : MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, fontFamily: FONT, flexShrink: 0
    }),
    metconText: { fontSize: 12, color: TEXT, lineHeight: 1.5 },
    btnRow: { display: 'flex', gap: 8, margin: '16px 0' },
    saveBtn: (isPressed) => ({
      flex: 1, padding: '16px', border: 'none', borderRadius: 6, background: ACCENT, color: '#000',
      fontFamily: FONT, fontSize: 14, fontWeight: 700, letterSpacing: 1,
      minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: isPressed ? 0.7 : 1, transform: isPressed ? 'scale(0.98)' : 'none',
      transition: 'opacity 0.1s, transform 0.1s'
    }),
    coachBtn: (loading, isPressed) => ({
      flex: 1, padding: '16px', border: `2px solid ${BLUE}`, borderRadius: 6,
      background: BLUE + '15', color: BLUE, fontFamily: FONT, fontSize: 14, fontWeight: 700,
      letterSpacing: 1, opacity: loading ? 0.5 : (isPressed ? 0.7 : 1),
      minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
      transform: isPressed ? 'scale(0.98)' : 'none', transition: 'opacity 0.1s, transform 0.1s'
    }),
    aiPanel: { background: BLUE + '12', border: `1px solid ${BLUE}40`, borderRadius: 6, padding: '14px', marginBottom: 16 },
    aiLabel: { fontSize: 10, fontWeight: 700, color: BLUE, letterSpacing: 2, marginBottom: 8 },
    aiText: { fontSize: 12, color: TEXT, whiteSpace: 'pre-wrap', lineHeight: 1.6 },
    prSection: { marginBottom: 20 },
    prSectionHeader: { fontSize: 12, fontWeight: 700, color: ACCENT, letterSpacing: 2, padding: '10px 0', borderBottom: `1px solid ${BORDER}`, marginBottom: 8 },
    prRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${BORDER}10`, minHeight: 44 },
    prName: { fontSize: 12, color: TEXT },
    prWeight: { fontSize: 16, fontWeight: 700, color: ACCENT },
    prDate: { fontSize: 9, color: MUTED },
    emptyText: { textAlign: 'center', color: MUTED, fontSize: 13, marginTop: 40, lineHeight: 1.6 },
    histCard: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '14px', marginBottom: 10, position: 'relative' },
    histDay: { fontSize: 13, fontWeight: 700 },
    histMeta: { fontSize: 10, color: MUTED, marginTop: 2 },
    histMetcon: { position: 'absolute', top: 14, right: 14, fontSize: 9, fontWeight: 700, color: GREEN },
    histExLine: { fontSize: 11, color: MUTED, marginTop: 4 },
    loadingScreen: {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', fontFamily: FONT, color: ACCENT, fontSize: 16,
      letterSpacing: 3, background: BG
    }
  }

  if (!loaded) {
    return <div style={S.loadingScreen}>LOADING...</div>
  }

  // ─── RENDER: WORKOUT TAB ───
  const renderWorkout = () => {
    if (!dayData) {
      return (
        <div style={{ padding: 16, color: MUTED, fontSize: 11, lineHeight: 1.5, fontFamily: FONT }}>
          No template for this day index. Tap another day (1–4) or switch phase — hypertrophy vs strength use separate logs; the app reopens on the phase you last saved for <strong style={{ color: TEXT }}>today</strong>.
        </div>
      )
    }
    return (
    <>
      <div style={S.daySelector}>
        {days.map((d, i) => (
          <button key={i} style={S.dayBtn(activeDay === i)} onClick={() => setActiveDay(i)}>
            <span style={S.dayBtnSm}>DAY</span>
            <span style={S.dayBtnLg}>{i + 1}</span>
          </button>
        ))}
      </div>

      <div style={S.dayHeader}>
        <div style={S.dayNum}>DAY {activeDay + 1}</div>
        <div style={S.dayTag}>{dayData.tag}</div>
        <div style={S.dayName}>{dayData.name}</div>
        {dayData.note && <div style={S.dayNote}>{dayData.note}</div>}
      </div>

      <div style={S.contextCard}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: 1, marginBottom: 4 }}>SESSION CONTEXT</div>
          <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.4 }}>Set before you save — stored with this workout for AI.</div>
        </div>

        <div style={S.contextField}>
          <span style={S.contextFieldLabel}>Run — miles</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={coachContext.runMiles ?? ''}
            onChange={e => setCoachContext(x => ({ ...x, runMiles: e.target.value }))}
            style={S.contextInput}
            autoComplete="off"
          />
        </div>

        <div style={S.contextField}>
          <span style={S.contextFieldLabel}>Run type</span>
          <div style={S.contextChipWrap}>
            {RUN_TYPES.map(o => (
              <button key={o} type="button" style={S.chipBtn((coachContext.runType ?? 'off') === o)} onClick={() => setCoachContext(x => ({ ...x, runType: o }))}>{o}</button>
            ))}
          </div>
        </div>

        <div style={S.contextField}>
          <span style={S.contextFieldLabel}>Sleep — hours</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="—"
            value={coachContext.sleepHours}
            onChange={e => setCoachContext(x => ({ ...x, sleepHours: e.target.value }))}
            style={S.contextInput}
            autoComplete="off"
          />
        </div>

        <div style={S.contextField}>
          <span style={S.contextFieldLabel}>Sleep — how it felt</span>
          <div style={S.contextChipWrap}>
            {['great', 'good', 'ok', 'poor', 'bad'].map(o => (
              <button key={o} type="button" style={S.chipBtn(coachContext.sleepFeel === o)} onClick={() => setCoachContext(x => ({ ...x, sleepFeel: o }))}>{o}</button>
            ))}
          </div>
        </div>

        <div style={{ ...S.contextField, marginBottom: 0 }}>
          <span style={S.contextFieldLabel}>Program flags</span>
          <div style={S.contextChipWrap}>
            <button type="button" style={S.chipBtn(coachContext.deload)} onClick={() => setCoachContext(x => ({ ...x, deload: !x.deload }))}>DELOAD</button>
            <button type="button" style={S.chipBtn(coachContext.race)} onClick={() => setCoachContext(x => ({ ...x, race: !x.race }))}>RACE WK</button>
          </div>
        </div>

        <div style={S.contextHint}>Autosaves with your log. Run the INSIGHT tab after training for AI analysis.</div>
      </div>

      <div style={S.legend}>
        {[['Straight Sets', ACCENT], ['Circuit/Superset', PURPLE], ['Core', GREEN], ['Conditioning', RED]].map(([label, c]) => (
          <div key={label} style={S.legendItem}>
            <div style={S.legendSwatch(c)} />
            <span style={S.legendLabel}>{label}</span>
          </div>
        ))}
      </div>

      {dayData.circuits.map(circuit => {
        const c = colorForType(circuit.type)
        const dc = circuitDoneCount(circuit)
        const isComplete = circuit.isMetcon ? dc === 1 : (dc.done === dc.total && dc.total > 0)

        return (
          <div key={circuit.id} style={S.circuitCard(c)}>
            <div style={S.circuitHeader(c)}>
              <div style={{ flex: 1 }}>
                <div style={S.circuitLabel(c)}>{circuit.label.toUpperCase()}</div>
                <div style={S.circuitMeta}>
                  {circuit.isMetcon ? 'choose one · rest as programmed' : `${circuit.sets} sets · rest ${circuit.rest}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  style={S.goalBtn(c, pressed === 'goal_' + circuit.id)}
                  onClick={() => { onPress('goal_' + circuit.id); setNoteOpen(p => ({ ...p, [circuit.id]: !p[circuit.id] })) }}
                >
                  GOAL
                </button>
                <div style={S.circuitDone(isComplete)}>
                  {circuit.isMetcon
                    ? (dc === 1 ? 'DONE ✓' : '—')
                    : `${dc.done}/${dc.total}`
                  }
                </div>
              </div>
            </div>

            {noteOpen[circuit.id] && (
              <div style={S.coachNote(c)}>{circuit.coachNote}</div>
            )}

            {circuit.isMetcon ? (
              <div style={{ padding: '6px 0' }}>
                {circuit.exercises.map(ex => {
                  const selected = metconSel[circuit.id] === ex.id
                  return (
                    <div key={ex.id} style={S.metconCard(selected)} onClick={() => toggleMetcon(circuit.id, ex.id)}>
                      <div style={S.metconBadge(selected)}>
                        {selected ? '✓' : ex.name.replace('Option ', '')}
                      </div>
                      <div style={S.metconText}>{ex.desc}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div>
                {circuit.exercises.map((ex, exIdx) => {
                  const key = circuit.id + '__' + ex.id
                  const exSets = sets[key] || []

                  return (
                    <React.Fragment key={ex.id}>
                      {exIdx > 0 && <div style={S.divider(c)} />}
                      <div style={S.exerciseBlock}>
                        <div style={S.exerciseHeader}>
                          <div>
                            <div style={S.exerciseName}>{ex.name}</div>
                            <div style={S.exerciseTarget}>Target: {ex.target}</div>
                          </div>
                          {prs[ex.id] && (
                            <div style={S.prBadge}>PR {prs[ex.id].weight}lb</div>
                          )}
                        </div>
                        <div style={S.colHeaders}>
                          <div style={S.colHeader}>SET</div>
                          <div style={S.colHeader}>LBS</div>
                          <div style={S.colHeader}>REPS</div>
                          <div style={S.colHeader}>✓</div>
                        </div>
                        {Array.from({ length: circuit.sets }, (_, i) => {
                          const row = exSets[i] || { weight: '', reps: '', done: false }
                          const checkId = `check_${circuit.id}_${ex.id}_${i}`
                          return (
                            <div key={i} style={S.setRow}>
                              <div style={S.setNum}>{i + 1}</div>
                              <input
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]*\.?[0-9]*"
                                placeholder="—"
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck="false"
                                enterKeyHint="done"
                                value={row.weight}
                                onChange={e => updateSet(circuit.id, ex.id, i, 'weight', e.target.value, circuit.sets)}
                                onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                                style={S.setInput(row.done)}
                              />
                              <input
                                type="text"
                                inputMode="decimal"
                                pattern="[0-9]*\.?[0-9]*"
                                placeholder="—"
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck="false"
                                enterKeyHint="done"
                                value={row.reps}
                                onChange={e => updateSet(circuit.id, ex.id, i, 'reps', e.target.value, circuit.sets)}
                                onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                                style={S.setInput(row.done)}
                              />
                              <button
                                style={S.checkBtn(row.done, pressed === checkId)}
                                onClick={() => { onPress(checkId); toggleDone(circuit.id, ex.id, i, circuit.sets) }}
                              >
                                {row.done ? '✓' : ''}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </React.Fragment>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <div style={S.btnRow}>
        <button
          style={{ ...S.saveBtn(pressed === 'save'), flex: 1 }}
          onClick={() => { onPress('save'); saveWorkout() }}
        >
          {saveMsg || 'SAVE WORKOUT'}
        </button>
      </div>

      <div style={S.planBox}>
        <div style={{ fontSize: 10, fontWeight: 700, color: BLUE, letterSpacing: 1, marginBottom: 8 }}>AI WEEK PLAN</div>
        <div style={{ fontSize: 10, color: MUTED, marginBottom: 8 }}>Uses last 40 sessions + PRs + current phase program.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={S.coachBtn(planLoading, pressed === 'plan')}
            onClick={() => { onPress('plan'); requestPlanWeek() }}
            disabled={planLoading}
          >
            {planLoading ? 'PLANNING...' : 'GENERATE WEEK WEIGHTS'}
          </button>
          {planData?.suggestions?.length > 0 && (
            <>
              <button type="button" style={S.saveBtn(pressed === 'applyD')} onClick={() => { onPress('applyD'); applyPlanWeights('day') }}>APPLY THIS DAY</button>
              <button type="button" style={S.saveBtn(pressed === 'applyA')} onClick={() => { onPress('applyA'); applyPlanWeights('all') }}>APPLY ALL DAYS</button>
            </>
          )}
        </div>
        {planError && <div style={{ color: RED, fontSize: 11, marginTop: 8 }}>{planError}</div>}
        {planData?.notes && <div style={{ fontSize: 11, color: TEXT, marginTop: 8, lineHeight: 1.5 }}>{planData.notes}</div>}
        {planData?.suggestions?.length > 0 && (
          <div style={{ fontSize: 10, color: MUTED, marginTop: 10, maxHeight: 160, overflow: 'auto' }}>
            {planData.suggestions.slice(0, 12).map((s, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                D{s.dayIndex + 1} · {s.exerciseId}: {(s.sets || []).map(x => x.weightLb).join(' / ')} lb
              </div>
            ))}
          </div>
        )}
      </div>
    </>
    )
  }

  // ─── RENDER: INSIGHT TAB (AI) ───
  const renderInsights = () => (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>AI INSIGHT</div>
        <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>
          Session context comes from the WORKOUT tab (run miles + type, sleep hours + how it felt, flags). Each saved workout stores that on the server for richer week reviews.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <button type="button" style={S.chipBtn(insightScope === 'session')} onClick={() => setInsightScope('session')}>THIS SESSION</button>
        <button type="button" style={S.chipBtn(insightScope === 'week')} onClick={() => setInsightScope('week')}>LAST 7 DAYS</button>
      </div>
      <div style={{ marginBottom: 14 }}>
        <button
          type="button"
          style={{ ...S.coachBtn(aiLoading, pressed === 'ins'), width: '100%' }}
          disabled={aiLoading}
          onClick={() => {
            onPress('ins')
            if (insightScope === 'session') getInsightsSession()
            else getInsightsWeek()
          }}
        >
          {aiLoading ? 'ANALYZING...' : (insightScope === 'session' ? 'RUN SESSION INSIGHT' : 'RUN WEEK INSIGHT')}
        </button>
      </div>

      {coachStructured && (
        <div style={S.aiPanel}>
          <div style={S.aiLabel}>INSIGHT</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Grade: {coachStructured.grade}</div>
          <div style={{ fontSize: 12, marginBottom: 10 }}>{coachStructured.summary}</div>
          {(coachStructured.bullets || []).length > 0 && (
            <ul style={{ margin: '0 0 8px 16px', fontSize: 11, lineHeight: 1.5 }}>
              {coachStructured.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
          {(coachStructured.risks || []).length > 0 && (
            <div style={{ fontSize: 10, color: RED, marginBottom: 8 }}>Risks: {coachStructured.risks.join(' · ')}</div>
          )}
          {coachStructured.next_session_focus && (
            <div style={{ fontSize: 11, color: BLUE }}>Next: {coachStructured.next_session_focus}</div>
          )}
        </div>
      )}

      {coachPlain && (
        <div style={S.aiPanel}>
          <div style={S.aiLabel}>INSIGHT</div>
          <div style={S.aiText}>{coachPlain}</div>
        </div>
      )}

      {(lastCoachMsg && lastUserPrompt) && (
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Follow-up question..."
            value={followUp}
            onChange={e => setFollowUp(e.target.value)}
            style={{ ...S.setInput(false), marginBottom: 8, textAlign: 'left', padding: '10px' }}
          />
          <button type="button" style={S.coachBtn(aiLoading, false)} onClick={submitFollowUp} disabled={aiLoading || !followUp.trim()}>
            ASK FOLLOW-UP
          </button>
        </div>
      )}
    </>
  )

  // ─── RENDER: STATS TAB ───
  const renderStats = () => {
    const wk = Object.entries(statsBundle.perWeek).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10)
    const trend = statsBundle.trends
    const topIds = Object.keys(trend).sort().slice(0, 16)
    return (
      <>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>TRAINING STATS</div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>Derived from saved sessions in history.</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>EST. TONNAGE (SUM OF WEIGHT × REPS, DONE SETS)</div>
          <div style={S.statValue}>{statsBundle.tonnage.toLocaleString()}</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>CONSECUTIVE TRAINING DAYS (FROM LATEST SESSION)</div>
          <div style={S.statValue}>{statsBundle.streak}</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>SESSIONS PER ISO WEEK</div>
          {wk.length === 0 ? (
            <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>No data.</div>
          ) : (
            wk.map(([k, v]) => (
              <div key={k} style={{ fontSize: 11, marginTop: 6, color: TEXT }}>{k}: {v}</div>
            ))
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, margin: '16px 0 8px', letterSpacing: 1 }}>RECENT BEST WEIGHTS BY LIFT</div>
        {topIds.length === 0 ? (
          <div style={S.emptyText}>Log sessions to see trends.</div>
        ) : (
          topIds.map(exId => (
            <div key={exId} style={S.statCard}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{exId.replace(/_/g, ' ')}</div>
              {(trend[exId] || []).map((x, i) => (
                <div key={i} style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{x.date} — {x.maxWeight} lb</div>
              ))}
            </div>
          ))
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button type="button" style={S.saveBtn(pressed === 'exs')} onClick={() => { onPress('exs'); handleExport() }}>EXPORT JSON</button>
          <button type="button" style={S.coachBtn(false, pressed === 'ims')} onClick={() => { onPress('ims'); importRef.current?.click() }}>IMPORT JSON</button>
        </div>
        {importMsg && <div style={{ fontSize: 10, color: ACCENT, marginTop: 8 }}>{importMsg}</div>}
      </>
    )
  }

  // ─── RENDER: PRs TAB ───
  const renderPRs = () => {
    const byDay = allExercisesByDay()
    const hasPrs = byDay.some(d => d.length > 0)

    return (
      <>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button type="button" style={S.saveBtn(pressed === 'exp')} onClick={() => { onPress('exp'); handleExport() }}>EXPORT JSON</button>
          <button type="button" style={S.coachBtn(false, pressed === 'imp')} onClick={() => { onPress('imp'); importRef.current?.click() }}>IMPORT JSON</button>
        </div>
        {importMsg && <div style={{ fontSize: 10, color: ACCENT, marginBottom: 8 }}>{importMsg}</div>}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>ALL TIME / PERSONAL RECORDS</div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>Tracks both hypertrophy and strength phase lifts.</div>
        </div>
        {!hasPrs ? (
          <div style={S.emptyText}>No PRs yet. Log and save workouts to track them.</div>
        ) : (
          byDay.map((exs, dayIdx) => exs.length > 0 && (
            <div key={dayIdx} style={S.prSection}>
              <div style={S.prSectionHeader}>DAY {dayIdx + 1} — {HYPERTROPHY[dayIdx].name.toUpperCase()}</div>
              {exs.map(ex => (
                <div key={ex.id} style={S.prRow}>
                  <div style={S.prName}>{ex.name}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={S.prWeight}>{prs[ex.id].weight}lb</div>
                    <div style={S.prDate}>{prs[ex.id].date}</div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </>
    )
  }

  // ─── RENDER: HISTORY TAB ───
  const renderHistory = () => (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>SESSION LOG / HISTORY</div>
      </div>
      {history.length === 0 ? (
        <div style={S.emptyText}>No sessions saved yet.</div>
      ) : (
        history.map(session => {
          const sd = session.sets_data || {}
          const ms = session.metcon_sel || {}
          const metconKey = Object.keys(ms).find(k => ms[k])
          const metconLabel = metconKey && ms[metconKey] ? ms[metconKey].replace('metcon_', 'FINISHER ').toUpperCase() : null

          const exLines = []
          Object.entries(sd).forEach(([key, rows]) => {
            const exId = key.split('__')[1]
            const bestWeight = Math.max(0, ...rows.filter(r => r.done).map(r => Number(r.weight) || 0))
            if (bestWeight > 0) {
              const exName = exId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
              exLines.push(`${exName}: ${bestWeight}lb`)
            }
          })

          return (
            <div key={session.id} style={S.histCard}>
              <div style={S.histDay}>Day {session.day_idx + 1} — {session.day_name}</div>
              <div style={S.histMeta}>{session.session_date} · {session.phase}</div>
              {session.coach_context && typeof session.coach_context === 'object' && (() => {
                const n = normalizeCoachContext(session.coach_context)
                return (
                  <div style={{ fontSize: 9, color: BLUE, marginTop: 4 }}>
                    Ctx run: {formatRunContextLine(n)} · sleep:{n.sleepHours || '—'}h {n.sleepFeel}{n.deload ? ' · deload' : ''}{n.race ? ' · race' : ''}
                  </div>
                )
              })()}
              {metconLabel && <div style={S.histMetcon}>{metconLabel}</div>}
              {exLines.length > 0 ? (
                exLines.map((line, i) => <div key={i} style={S.histExLine}>{line}</div>)
              ) : (
                <div style={S.histExLine}>No weights logged this session.</div>
              )}
            </div>
          )
        })
      )}
    </>
  )

  // ─── MAIN RENDER ───
  return (
    <div style={S.shell}>
      <input ref={importRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleImportFile} />
      {/* Sticky header + tabs */}
      <div style={S.stickyTop}>
        {!online && (
          <div style={S.offlineBanner}>OFFLINE — data will sync when reconnected</div>
        )}
        {!supabaseReady && (
          <div style={{ background: ACCENT + '30', borderBottom: `1px solid ${ACCENT}50`, padding: '8px 12px', fontSize: 10, color: ACCENT, textAlign: 'center', fontFamily: FONT, fontWeight: 700, letterSpacing: 1, lineHeight: 1.4 }}>
            DB NOT CONNECTED — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel env vars, then redeploy
          </div>
        )}
        <div style={S.header}>
          <div style={S.titleRow}>
            <div>
              <div style={S.h1}>IRON DISCIPLINE</div>
              <div style={S.h2}>WORKOUT TRACKER</div>
            </div>
            <div>
              <div style={S.dateText}>{fmtDate()}</div>
              <div style={S.phaseText}>
                {phase === 'hypertrophy' ? 'WK 1-2 · HYPERTROPHY' : 'WK 3-4 · STRENGTH'}
              </div>
            </div>
          </div>

          <div style={S.phaseToggle}>
            <button style={S.phaseBtn(phase === 'hypertrophy')} onClick={() => setPhase('hypertrophy')}>
              WEEKS 1–2 · HYPERTROPHY
            </button>
            <button style={S.phaseBtn(phase === 'strength')} onClick={() => setPhase('strength')}>
              WEEKS 3–4 · STRENGTH
            </button>
          </div>
        </div>

        <div style={S.tabs}>
          {[['workout', 'WORKOUT'], ['insight', 'INSIGHT'], ['prs', 'PRs'], ['log', 'HISTORY'], ['stats', 'STATS']].map(([id, label]) => (
            <button key={id} type="button" style={S.tab(tab === id)} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} style={S.scrollArea} onClick={onTapBackground}>
        {tab === 'workout' && renderWorkout()}
        {tab === 'insight' && renderInsights()}
        {tab === 'prs' && renderPRs()}
        {tab === 'log' && renderHistory()}
        {tab === 'stats' && renderStats()}
      </div>
    </div>
  )
}
