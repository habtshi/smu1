/* ============================================================
   Global constants — mirrors the HTML single-file build
   ============================================================ */

/* ---------- Role labels ---------- */
export const ROLE_LABEL = {
  admin:     'Administrator',
  dept_head: 'Department Head',
  teacher:   'Teacher',
  class_rep: 'Class Representative',
  student:   'Student'
}

/* ---------- Rating metadata ---------- */
export const RATING_META = {
  Green:  { label: 'Excellent',         color: '#059669', bg: '#ecfdf5' },
  Blue:   { label: 'Good',              color: '#2563eb', bg: '#eff6ff' },
  Yellow: { label: 'Needs Improvement', color: '#d97706', bg: '#fffbeb' },
  Red:    { label: 'Poor / Absent',     color: '#dc2626', bg: '#fef2f2' }
}

export const PERF_META = {
  Green:  { label: 'Excellent',         color: '#059669', bg: '#ecfdf5' },
  Blue:   { label: 'Good',              color: '#2563eb', bg: '#eff6ff' },
  Yellow: { label: 'Needs Improvement', color: '#d97706', bg: '#fffbeb' },
  Red:    { label: 'Not Delivered',     color: '#dc2626', bg: '#fef2f2' }
}

/* ---------- Business thresholds ---------- */
export const ALERT_THRESHOLDS = {
  deptHead: 3,   // 3 consecutive Reds → dept head notified
  admin:    5    // 5 consecutive Reds → escalated to admin
}

export const LOCKOUT_MAX = 5                    // failed login attempts
export const LOCKOUT_MS  = 15 * 60 * 1000       // 15 minutes
export const SESSION_WARN_AT_MIN = 2            // warn 2 min before timeout
export const REPORT_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000  // 24h

/* ---------- Rating score mapping (for averages) ---------- */
export const SCORE = { Green: 5, Blue: 4, Yellow: 2, Red: 1 }

/* ---------- Sidebar navigation model ---------- */
/* items: [ routeName, label, bootstrapIcon ] */
export const NAV = {
  admin: [
    { section: 'Overview', items: [
      ['dashboard', 'Dashboard', 'speedometer2']
    ]},
    { section: 'Monitoring', items: [
      ['teachers',         'Teachers',       'person-video3'],
      ['students',         'Students',       'mortarboard-fill'],
      ['departments',      'Departments',    'building'],
      ['alerts',           'Alerts',         'bell'],
      ['disputes',         'Disputes',       'chat-square-text'],
      ['class-reports',    'Class Reports',  'journal-text']
    ]},
    { section: 'Intelligence', items: [
      ['attendance-intel',  'Attendance Intel',  'calendar3'],
      ['performance-intel', 'Performance Intel', 'graph-up-arrow'],
      ['reports',           'Reports',           'file-earmark-text']
    ]},
    { section: 'Administration', items: [
      ['users',                'User Management',      'people'],
      ['teacher-assignments',  'Teacher Assignments',  'person-check'],
      ['roles',                'Roles & Permissions',  'shield-lock'],
      ['settings',             'System Settings',      'gear'],
      ['messages',             'Messages',             'envelope'],
      ['backup',               'Backup & Restore',     'database-up'],
      ['academic-year',        'Academic Year',        'calendar2-range'],
      ['audit',                'Audit Log',            'shield-check'],
      ['makeup-classes',       'Makeup Classes',       'calendar-plus']
    ]}
  ],

  dept_head: [
    { section: 'Overview', items: [
      ['dashboard', 'Dashboard', 'speedometer2']
    ]},
    { section: 'My Department', items: [
      ['teachers',      'My Teachers',    'person-video3'],
      ['students',      'Students',       'mortarboard-fill'],
      ['alerts',        'Alerts',         'bell'],
      ['disputes',      'Disputes',       'chat-square-text'],
      ['class-reports', 'Class Reports',  'journal-text']
    ]},
    { section: 'Intelligence', items: [
      ['attendance-intel',  'Attendance Intel',  'calendar3'],
      ['performance-intel', 'Performance Intel', 'graph-up-arrow'],
      ['reports',           'Reports',           'file-earmark-text'],
      ['makeup-classes',    'Makeup Classes',    'calendar-plus'],
      ['messages',          'Messages',          'envelope']
    ]}
  ],

  teacher: [
    { section: 'Overview', items: [
      ['dashboard', 'My Dashboard', 'speedometer2']
    ]},
    { section: 'My Performance', items: [
      ['my-attendance',  'My Attendance',  'calendar-week'],
      ['my-performance', 'My Performance', 'graph-up-arrow'],
      ['self-reports',   'Self Reports',   'pencil-square'],
      ['class-reports',  'Class Reports',  'journal-text'],
      ['my-disputes',    'Disputes',       'chat-square-text'],
      ['messages',       'Messages',       'envelope'],
      ['makeup-classes', 'Makeup Classes', 'calendar-plus']
    ]}
  ],

  class_rep: [
    { section: 'Overview', items: [
      ['dashboard', 'Dashboard', 'speedometer2']
    ]},
    { section: 'Daily Reporting', items: [
      ['new-report', 'Submit Report', 'pencil-square'],
      ['history',    'My History',    'clock-history']
    ]}
  ],

  student: [
    { section: 'Overview', items: [
      ['dashboard', 'Dashboard', 'speedometer2']
    ]},
    { section: 'My Feedback', items: [
      ['submit-rating', 'Submit Rating', 'star-half'],
      ['my-ratings',    'My Ratings',    'clock-history']
    ]}
  ]
}

/* ---------- Status pill colour map ---------- */
export const STATUS_PILL = {
  pending:   ['alert-warning',  'Pending',   'hourglass-split'],
  approved:  ['alert-resolved', 'Approved',  'check-circle'],
  rejected:  ['alert-critical', 'Rejected',  'x-circle'],
  resolved:  ['alert-resolved', 'Resolved',  'check2-circle'],
  active:    ['alert-critical', 'Active',    'exclamation-octagon-fill'],
  escalated: ['alert-critical', 'Escalated', 'exclamation-triangle-fill'],
  cancelled: ['b-gray',         'Cancelled', 'slash-circle']
}

/* ---------- Makeup class status ---------- */
export const MAKEUP_STATUS = {
  pending:   ['b-amber', 'Pending'],
  scheduled: ['b-blue',  'Scheduled'],
  completed: ['b-green', 'Completed'],
  cancelled: ['b-red',   'Cancelled']
}

/* ---------- Backup keys ---------- */
export const BACKUP_KEYS = [
  'users', 'departments', 'courses', 'reports', 'alerts', 'disputes',
  'notifications', 'messages', 'resetTokens', 'settings', 'auditLog',
  'archives', 'makeupClasses', 'classReports', 'loginLockout',
  'sections'
]