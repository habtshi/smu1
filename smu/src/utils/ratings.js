import { RATING_META, PERF_META, SCORE } from './constants'

/* ============================================================
   Attendance rating helpers
   ============================================================ */

/** Numeric score for an attendance rating (used in averages) */
export function scoreFromAtt(r) {
  return SCORE[r] ?? 0
}

/** CSS badge class for any rating */
export function badgeClass(rating) {
  return {
    Green:  'b-green',
    Blue:   'b-blue',
    Yellow: 'b-amber',
    Red:    'b-red'
  }[rating] || 'b-gray'
}

/** Dot class for any rating */
export function dotClass(rating) {
  return {
    Green:  'green',
    Blue:   'blue',
    Yellow: 'amber',
    Red:    'red'
  }[rating] || 'gray'
}

/** Metadata for a rating (color, bg, label) */
export function ratingMeta(rating, kind = 'attendance') {
  if (!rating) return null
  return (kind === 'performance' ? PERF_META : RATING_META)[rating] || null
}

/** Human label for attendance rating */
export function attLabel(rating) {
  if (!rating) return '—'
  return rating === 'Red' ? 'Red (Absent)' : rating
}

/** Human label for performance rating */
export function perfLabel(rating) {
  if (!rating) return '—'
  return (PERF_META[rating]?.label) || rating
}

/* ============================================================
   Performance rating helpers
   ============================================================ */

export function scoreFromPerf(r) {
  return SCORE[r] ?? 0
}

/* ============================================================
   Composable — call inside a component
   ------------------------------------------------------------
   Example:
     import { useRatings } from '@/utils/ratings'
     const { badgeClass, attLabel } = useRatings()
   ============================================================ */
export function useRatings() {
  return {
    scoreFromAtt,
    scoreFromPerf,
    badgeClass,
    dotClass,
    ratingMeta,
    attLabel,
    perfLabel
  }
}