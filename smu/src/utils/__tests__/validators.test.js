// src/utils/__tests__/validators.test.js
import { describe, it, expect } from 'vitest'
import {
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
} from '../validators'

/* ─────────── password policy ─────────── */
describe('passwordPolicyValid', () => {
  it('accepts 8+ chars with letter + number', () => {
    expect(passwordPolicyValid('abc12345')).toBe(true)
    expect(passwordPolicyValid('Test1234')).toBe(true)
  })

  it('rejects short passwords', () => {
    expect(passwordPolicyValid('abc12')).toBe(false)
    expect(passwordPolicyValid('a1')).toBe(false)
  })

  it('rejects letters-only', () => {
    expect(passwordPolicyValid('abcdefgh')).toBe(false)
  })

  it('rejects numbers-only', () => {
    expect(passwordPolicyValid('12345678')).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(passwordPolicyValid(null)).toBe(false)
    expect(passwordPolicyValid(12345678)).toBe(false)
  })
})

describe('passwordPolicyMessage', () => {
  it('returns a non-empty string', () => {
    expect(typeof passwordPolicyMessage()).toBe('string')
    expect(passwordPolicyMessage().length).toBeGreaterThan(10)
  })
})

/* ─────────── email / phone ─────────── */
describe('isEmail', () => {
  it('accepts valid emails', () => {
    expect(isEmail('admin@smu.edu.et')).toBe(true)
    expect(isEmail('a.b-c@example.co.uk')).toBe(true)
  })
  it('rejects invalid emails', () => {
    expect(isEmail('not-an-email')).toBe(false)
    expect(isEmail('a@b')).toBe(false)
    expect(isEmail('')).toBe(false)
    expect(isEmail(null)).toBe(false)
  })
})

describe('isPhone', () => {
  it('accepts valid phone numbers', () => {
    expect(isPhone('+251911223344')).toBe(true)
    expect(isPhone('0911-223-344')).toBe(true)
  })
  it('rejects invalid', () => {
    expect(isPhone('abc')).toBe(false)
    expect(isPhone('')).toBe(false)
  })
})

/* ─────────── basic checks ─────────── */
describe('isNonEmpty', () => {
  it('accepts non-empty strings', () => {
    expect(isNonEmpty('hi')).toBe(true)
    expect(isNonEmpty('  x  ')).toBe(true)
  })
  it('rejects empty / whitespace', () => {
    expect(isNonEmpty('')).toBe(false)
    expect(isNonEmpty('   ')).toBe(false)
    expect(isNonEmpty(null)).toBe(false)
  })
})

describe('isPositiveInt', () => {
  it('accepts positive integers', () => {
    expect(isPositiveInt(1)).toBe(true)
    expect(isPositiveInt('42')).toBe(true)
  })
  it('rejects 0, negatives, floats', () => {
    expect(isPositiveInt(0)).toBe(false)
    expect(isPositiveInt(-1)).toBe(false)
    expect(isPositiveInt(1.5)).toBe(false)
  })
})

describe('isDateISO', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(isDateISO('2026-03-12')).toBe(true)
  })
  it('rejects other formats', () => {
    expect(isDateISO('12/03/2026')).toBe(false)
    expect(isDateISO('2026-3-1')).toBe(false)
    expect(isDateISO('')).toBe(false)
  })
})

/* ─────────── report validation ─────────── */
describe('validateDailyReport', () => {
  const valid = {
    teacherId: 10,
    course: 'CoSc3061',
    date: '2026-03-12',
    attendance: 'Green',
    performance: 'Green'
  }

  it('returns null for valid payload', () => {
    expect(validateDailyReport(valid)).toBeNull()
  })

  it('requires teacherId', () => {
    expect(validateDailyReport({ ...valid, teacherId: null })).toMatch(/teacher/i)
  })

  it('requires course', () => {
    expect(validateDailyReport({ ...valid, course: '' })).toMatch(/course/i)
  })

  it('requires valid date', () => {
    expect(validateDailyReport({ ...valid, date: 'bad' })).toMatch(/date/i)
  })

  it('requires attendance rating', () => {
    expect(validateDailyReport({ ...valid, attendance: '' })).toMatch(/attendance/i)
  })

  it('requires performance rating', () => {
    expect(validateDailyReport({ ...valid, performance: '' })).toMatch(/performance/i)
  })
})

describe('validatePerformanceRating', () => {
  const valid = {
    teacherId: 10,
    course: 'CoSc3061',
    date: '2026-03-12',
    rating: 'Green'
  }

  it('accepts valid payload', () => {
    expect(validatePerformanceRating(valid)).toBeNull()
  })

  it('rejects Red rating from students', () => {
    expect(validatePerformanceRating({ ...valid, rating: 'Red' })).toMatch(/red/i)
  })
})

describe('validateSelfReport', () => {
  const valid = { course: 'CoSc3061', date: '2026-03-12', rating: 'Green' }
  it('accepts valid', () => expect(validateSelfReport(valid)).toBeNull())
  it('rejects missing course', () => expect(validateSelfReport({ ...valid, course: '' })).toMatch(/course/i))
})

/* ─────────── user form ─────────── */
describe('validateUserForm', () => {
  const valid = {
    first: 'Abebe',
    last: 'Tesfaye',
    username: 'abebe',
    email: 'abebe@smu.edu.et',
    role: 'teacher',
    staffId: 'T012',
    password: 'abc12345',
    password2: 'abc12345',
    isEdit: false
  }

  it('accepts valid form', () => {
    expect(validateUserForm(valid)).toBeNull()
  })

  it('rejects invalid email', () => {
    expect(validateUserForm({ ...valid, email: 'bad' })).toMatch(/email/i)
  })

  it('rejects mismatched passwords', () => {
    expect(validateUserForm({ ...valid, password2: 'different123' })).toMatch(/match/i)
  })

  it('skips password check on edit', () => {
    const edited = { ...valid, password: '', password2: '', isEdit: true }
    expect(validateUserForm(edited)).toBeNull()
  })
})