/* ============================================================
   Form & input validation
   ============================================================ */

/* ---------- Password policy ---------- */
/** Must be 8+ chars with at least one letter and one number. */
export function passwordPolicyValid(p) {
  return typeof p === 'string'
    && p.length >= 8
    && /[A-Za-z]/.test(p)
    && /\d/.test(p)
}

export function passwordPolicyMessage() {
  return 'Password must be at least 8 characters and contain at least one letter and one number.'
}

/* ---------- Simple field checks ---------- */
export function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())
}

export function isPhone(v) {
  return /^\+?[0-9\s\-()]{7,20}$/.test(String(v || '').trim())
}

export function isNonEmpty(v) {
  return String(v ?? '').trim().length > 0
}

export function isPositiveInt(v) {
  const n = Number(v)
  return Number.isInteger(n) && n > 0
}

export function isDateISO(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))
}

/* ---------- Report payload validation ---------- */
/** Returns an error string, or null when the payload is valid. */
export function validateDailyReport({ teacherId, course, date, attendance, performance }) {
  if (!teacherId)                         return 'Please select a teacher.'
  if (!isNonEmpty(course))                return 'Please enter the course name.'
  if (!isDateISO(date))                   return 'Please select a valid date.'
  if (!attendance)                        return 'Please select an attendance rating.'
  if (!performance)                       return 'Please select a performance rating.'
  if (attendance === 'Red' && !['Green','Blue','Yellow'].includes(performance)) {
    // Attendance = Red can coexist with any performance — not a rule violation
  }
  return null
}

export function validatePerformanceRating({ teacherId, course, date, rating }) {
  if (!teacherId)          return 'Please select a teacher.'
  if (!isNonEmpty(course)) return 'Please enter the course name.'
  if (!isDateISO(date))    return 'Please select a valid date.'
  if (!rating)             return 'Please select a rating.'
  if (rating === 'Red')    return 'Students cannot submit Red (absent) ratings — those come from class representatives.'
  return null
}

export function validateSelfReport({ course, date, rating }) {
  if (!isNonEmpty(course)) return 'Please enter a course.'
  if (!isDateISO(date))    return 'Please select a valid date.'
  if (!rating)             return 'Please select a rating.'
  return null
}

export function validateUserForm({ first, last, username, email, role, staffId, password, password2, isEdit }) {
  if (!isNonEmpty(first))                 return 'First name is required.'
  if (!isNonEmpty(last))                  return 'Last name is required.'
  if (!isNonEmpty(username))              return 'Username is required.'
  if (!isNonEmpty(email))                 return 'Email is required.'
  if (!isEmail(email))                    return 'Please enter a valid email address.'
  if (!isNonEmpty(role))                  return 'Role is required.'
  if (!isNonEmpty(staffId))               return 'ID is required for this role.'
  if (!isEdit) {
    if (!passwordPolicyValid(password))   return passwordPolicyMessage()
    if (password !== password2)           return 'Passwords do not match.'
  }
  return null
}

/* ---------- Composable ---------- */
export function useValidators() {
  return {
    passwordPolicyValid,
    passwordPolicyMessage,
    isEmail,
    isPhone,
    isNonEmpty,
    isPositiveInt,
    isDateISO,
    validateDailyReport,
    validatePerformanceRating,
    validateSelfReport,
    validateUserForm
  }
}