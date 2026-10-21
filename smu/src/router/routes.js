/* ============================================================
   Route table
   ------------------------------------------------------------
   meta.title  → document.title + breadcrumb label
   meta.roles  → allowed roles (undefined = any signed-in user)
   meta.public → accessible without login
   ============================================================ */
export const routes = [
  /* ---------- Public ---------- */
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/LandingView.vue'),
    meta: { public: true, title: 'Welcome' }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: 'Sign In' }
  },
  {
    path: '/forgot',
    name: 'forgot',
    component: () => import('@/views/ForgotPasswordView.vue'),
    meta: { public: true, title: 'Reset Password' }
  },
  {
    path: '/reset/:token',
    name: 'reset',
    component: () => import('@/views/ResetPasswordView.vue'),
    meta: { public: true, title: 'Set New Password' }
  },

  /* ---------- Overview ---------- */
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: 'Dashboard' }
  },

  /* ---------- Monitoring ---------- */
  {
    path: '/teachers',
    name: 'teachers',
    component: () => import('@/views/TeachersView.vue'),
    meta: { title: 'Teachers', roles: ['admin', 'dept_head'] }
  },
  {
    path: '/teachers/:id',
    name: 'teacher-detail',
    component: () => import('@/views/TeacherDetailView.vue'),
    meta: { title: 'Teacher Profile', roles: ['admin', 'dept_head'] }
  },
  {
    path: '/students',
    name: 'students',
    component: () => import('@/views/StudentsView.vue'),
    meta: { title: 'Students', roles: ['admin', 'dept_head'] }
  },
  {
    path: '/departments',
    name: 'departments',
    component: () => import('@/views/DepartmentsView.vue'),
    meta: { title: 'Departments', roles: ['admin'] }
  },
  {
    path: '/alerts',
    name: 'alerts',
    component: () => import('@/views/AlertsView.vue'),
    meta: { title: 'Alerts', roles: ['admin', 'dept_head'] }
  },
  {
    path: '/disputes',
    name: 'disputes',
    component: () => import('@/views/DisputesView.vue'),
    meta: { title: 'Disputes', roles: ['admin', 'dept_head'] }
  },
  {
    path: '/class-reports',
    name: 'class-reports',
    component: () => import('@/views/ClassReportsView.vue'),
    meta: { title: 'Class Reports' }
  },

  /* ---------- Intelligence ---------- */
  {
    path: '/attendance-intel',
    name: 'attendance-intel',
    component: () => import('@/views/AttendanceIntelView.vue'),
    meta: { title: 'Attendance Intel', roles: ['admin', 'dept_head'] }
  },
  {
    path: '/performance-intel',
    name: 'performance-intel',
    component: () => import('@/views/PerformanceIntelView.vue'),
    meta: { title: 'Performance Intel', roles: ['admin', 'dept_head'] }
  },
  {
    path: '/reports',
    name: 'reports',
    component: () => import('@/views/ReportsView.vue'),
    meta: { title: 'Reports', roles: ['admin', 'dept_head'] }
  },

  /* ---------- Administration ---------- */
  {
    path: '/users',
    name: 'users',
    component: () => import('@/views/UsersView.vue'),
    meta: { title: 'User Management', roles: ['admin'] }
  },
  {
    path: '/teacher-assignments',
    name: 'teacher-assignments',
    component: () => import('@/views/TeacherAssignmentsView.vue'),
    meta: { title: 'Teacher Assignments', roles: ['admin', 'dept_head'] }
  },
  {
    path: '/roles',
    name: 'roles',
    component: () => import('@/views/RolesView.vue'),
    meta: { title: 'Roles & Permissions', roles: ['admin'] }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Settings', roles: ['admin'] }
  },
  {
    path: '/messages',
    name: 'messages',
    component: () => import('@/views/MessagesView.vue'),
    meta: { title: 'Messages' }
  },
  {
    path: '/backup',
    name: 'backup',
    component: () => import('@/views/BackupView.vue'),
    meta: { title: 'Backup & Restore', roles: ['admin'] }
  },
  {
    path: '/academic-year',
    name: 'academic-year',
    component: () => import('@/views/AcademicYearView.vue'),
    meta: { title: 'Academic Year', roles: ['admin'] }
  },
  {
    path: '/audit',
    name: 'audit',
    component: () => import('@/views/AuditView.vue'),
    meta: { title: 'Audit Log', roles: ['admin'] }
  },
  {
    path: '/makeup-classes',
    name: 'makeup-classes',
    component: () => import('@/views/MakeupClassesView.vue'),
    meta: { title: 'Makeup Classes' }
  },

  /* ---------- Class Representative ---------- */
  {
    path: '/new-report',
    name: 'new-report',
    component: () => import('@/views/NewReportView.vue'),
    meta: { title: 'Submit Report', roles: ['class_rep'] }
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { title: 'My History', roles: ['class_rep'] }
  },

  /* ---------- Teacher ---------- */
  {
    path: '/my-attendance',
    name: 'my-attendance',
    component: () => import('@/views/MyAttendanceView.vue'),
    meta: { title: 'My Attendance', roles: ['teacher'] }
  },
  {
    path: '/my-performance',
    name: 'my-performance',
    component: () => import('@/views/MyPerformanceView.vue'),
    meta: { title: 'My Performance', roles: ['teacher'] }
  },
  {
    path: '/self-reports',
    name: 'self-reports',
    component: () => import('@/views/SelfReportsView.vue'),
    meta: { title: 'Self Reports', roles: ['teacher'] }
  },
  {
    path: '/my-disputes',
    name: 'my-disputes',
    component: () => import('@/views/MyDisputesView.vue'),
    meta: { title: 'My Disputes', roles: ['teacher'] }
  },

  /* ---------- Student ---------- */
  {
    path: '/submit-rating',
    name: 'submit-rating',
    component: () => import('@/views/SubmitRatingView.vue'),
    meta: { title: 'Submit Rating', roles: ['student'] }
  },
  {
    path: '/my-ratings',
    name: 'my-ratings',
    component: () => import('@/views/MyRatingsView.vue'),
    meta: { title: 'My Ratings', roles: ['student'] }
  },

  /* ---------- Any signed-in user ---------- */
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { title: 'My Profile' }
  },

  /* ---------- 404 ---------- */
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { public: true, title: 'Not Found' }
  }
]