# SMU · Teacher Attendance & Performance Monitoring System

Frontend for St. Mary's University's web-based Teacher Attendance and Performance Monitoring System with Class Representative Reporting.

Built with **Vue 3 + Vite + Pinia + Vue Router + Chart.js**. Frontend only — a Laravel + MySQL backend can be attached later via the `/api` proxy.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

The app opens at **http://localhost:5173** and shows the landing page.

---

## Demo accounts

| Role | Username | Password |
|---|---|---|
| Administrator | `admin` | `1234` |
| Department Head | `alemayehu` | `1234` |
| Teacher | `tadesse` | `1234` |
| Class Representative | `alemitu` | `1234` |
| Student | `abebe` | `1234` |

All demo passwords are `1234`. Change them from **User Management → Reset Password** once signed in as admin.

---

## Production build

```bash
npm run build     # → dist/
npm run preview   # preview the built bundle locally
```

---

## Project structure

```
smu-teacher-monitoring-system/
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
├── README.md
└── src/
    ├── main.js
    ├── App.vue
    ├── styles.css
    ├── composables/
    │   └── useToast.js
    ├── router/
    │   ├── index.js
    │   └── routes.js
    ├── utils/
    │   └── constants.js
    ├── stores/
    │   ├── session.js
    │   ├── directory.js
    │   ├── reports.js
    │   ├── alerts.js
    │   ├── disputes.js
    │   ├── messages.js
    │   ├── settings.js
    │   └── ui.js
    ├── components/
    │   ├── layout/AppShell.vue
    │   ├── AppToast.vue
    │   └── common/           ← shared UI (Modal, DataTable, …)
    └── views/
        ├── LandingView.vue
        ├── LoginView.vue
        ├── DashboardView.vue
        ├── NotFoundView.vue
        └── … (feature views)
```

---

## Key features

- **5 roles** — Administrator, Department Head, Teacher, Class Representative, Student
- **Four-color rating system** — Green / Blue / Yellow / Red
- **Automated alerts** — 3 consecutive Reds → Department Head · 5 Reds → escalated to Administrator
- **Auto-generated makeup class** — created the moment an alert fires
- **Role-based navigation** — sidebar and pages filtered by role
- **Dark mode** — "Belublack" theme, persisted in `localStorage`
- **Numerical pagination** — reusable `Pagination.vue` with page-size selector
- **Search / sort / filter** — via `DataTable.vue`
- **Charts** — Chart.js wrapped in `ChartBox.vue`
- **Backup & Restore** — full snapshot download / restore in the browser
- **Academic year close** — archive + auto-backup before transition
- **Audit log** — every mutation recorded

---

## Backend integration

The frontend runs **fully offline** using `localStorage` as its data source. To wire it to a real Laravel backend:

1. Set `VITE_API_BASE_URL` in `.env`:
   ```
   VITE_API_BASE_URL=/api
   ```
2. In `vite.config.js`, the `/api` proxy already forwards to `http://localhost:8000`.
3. Swap store methods (`useDirectoryStore`, `useReportsStore`, …) to call `src/services/api.js` instead of localStorage.

> **Security note:** authentication, authorization, password hashing and audit logging must be enforced **server-side** in production. Frontend hiding alone is not security.

---

## Browser support

- Chrome / Edge 90+
- Firefox 90+
- Safari 14+

---

## License

Internal academic project — St. Mary's University.