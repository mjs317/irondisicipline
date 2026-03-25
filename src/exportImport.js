export const EXPORT_VERSION = 1

export function buildExportPayload({ userId, prs, history, setsByPhase, metconByPhase, logDate }) {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    userId,
    personalRecords: prs,
    workoutSessions: history,
    todayLog: {
      log_date: logDate,
      sets_data: setsByPhase,
      metcon_sel: metconByPhase
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

export function validateImportPayload(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Not an object' }
  if (raw.version != null && raw.version !== EXPORT_VERSION) {
    return { ok: false, error: `Expected export version ${EXPORT_VERSION}` }
  }
  return { ok: true, data: raw }
}
