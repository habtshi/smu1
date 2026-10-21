/* ============================================================
   Formatting helpers — pure functions, no side effects
   ============================================================ */

/** Escape HTML special chars — used when injecting into innerHTML.
 *  In Vue templates you rarely need this because Vue auto-escapes,
 *  but it's handy for title attributes, confirm() dialogs, etc. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

/** '12 Mar 2026' */
export function fmtDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  } catch { return String(d) }
}

/** '12 Mar, 14:30' */
export function fmtDateTime(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  } catch { return String(d) }
}

/** Today as 'YYYY-MM-DD' */
export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/** 'YYYY-MM-DD' for N days ago */
export function daysAgoISO(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/** 'AT' from 'Abebe Tesfaye' */
export function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map(x => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Human friendly: 'just now', '5m ago', '3h ago', '2d ago' */
export function timeAgo(ts) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000
  if (d < 60)    return 'just now'
  if (d < 3600)  return Math.round(d / 60) + 'm ago'
  if (d < 86400) return Math.round(d / 3600) + 'h ago'
  return Math.round(d / 86400) + 'd ago'
}

/** '1.5 KB', '3.20 MB' */
export function fmtBytes(n) {
  if (n == null) return '—'
  if (n < 1024)             return n + ' B'
  if (n < 1024 * 1024)      return (n / 1024).toFixed(1) + ' KB'
  return (n / (1024 * 1024)).toFixed(2) + ' MB'
}

/** Debounce a function (default 250 ms) */
export function debounce(fn, ms = 250) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

/** Copy text to clipboard, returns boolean */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(String(text))
    return true
  } catch {
    return false
  }
}

/** Trigger a browser download of any Blob */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Download any JSON-serializable object as a .json file */
export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  })
  downloadBlob(blob, filename)
}

/** Download an array of flat objects as CSV */
export function exportCSV(rows, filename) {
  if (!Array.isArray(rows) || rows.length === 0) return false
  const headers = Object.keys(rows[0])
  const csv = [headers.join(',')]
    .concat(
      rows.map(r =>
        headers.map(h => {
          const v = r[h] == null ? '' : String(r[h])
          return v.includes(',') || v.includes('"')
            ? `"${v.replace(/"/g, '""')}"`
            : v
        }).join(',')
      )
    ).join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}-${todayISO()}.csv`)
  return true
}