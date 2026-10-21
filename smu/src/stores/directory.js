import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { hashPassword } from '@/utils/hash'

const USERS_KEY   = 'tms_users'
const DEPTS_KEY   = 'tms_departments'
const COURSES_KEY = 'tms_courses'
const SEED_FLAG   = 'tms_seed_v5'

/* ---------- helpers ---------- */
function load(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback }
  catch { return fallback }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

/* ============================================================
   SMU Faculty & Department structure
   ============================================================ */

const DEMO_DEPARTMENTS = [
  { id:1, code:'CoSc', idCode:'CD',  name:'Computer Science',                   head:'Dr. Alemayehu Kebede' },
  { id:2, code:'AcFn', idCode:'AD',  name:'Accounting and Finance',             head:'Dr. Hanna Girma' },
  { id:3, code:'MgMt', idCode:'MD',  name:'Management',                         head:'Dr. Yonas Ayele' },
  { id:4, code:'MkMg', idCode:'MKD', name:'Marketing Management',               head:'Dr. Bethlehem Assefa' },
  { id:5, code:'Econ', idCode:'ED',  name:'Economics',                          head:'Prof. Meseret Haile' },
  { id:6, code:'THM',  idCode:'TD',  name:'Tourism and Hospitality Management', head:'Dr. Selam Tesfaye' }
]

const DEMO_COURSES = [
  { id:1,  code:'CoSc3061', name:'Software Engineering',                 department:'Computer Science',                   teacherId:10 },
  { id:2,  code:'CoSc3041', name:'Advanced Database Systems',            department:'Computer Science',                   teacherId:11 },
  { id:3,  code:'CoSc3081', name:'Internet Programming I',               department:'Computer Science',                   teacherId:12 },
  { id:4,  code:'CoSc3091', name:'Introduction to Algorithms',           department:'Computer Science',                   teacherId:12 },
  { id:5,  code:'CoSc3122', name:'Research Method in Computer Science',  department:'Computer Science',                   teacherId:10 },
  { id:6,  code:'AcFn3022', name:'Intermediate Financial Accounting II', department:'Accounting and Finance',             teacherId:13 },
  { id:7,  code:'AcFn3071', name:'Accounting for Public Sector',         department:'Accounting and Finance',             teacherId:13 },
  { id:8,  code:'AcFn3112', name:'Research Method in Accounting',        department:'Accounting and Finance',             teacherId:14 },
  { id:9,  code:'AcFn3032', name:'Cost and Management Accounting II',    department:'Accounting and Finance',             teacherId:14 },
  { id:10, code:'MgMt3142', name:'Strategic Management',                 department:'Management',                         teacherId:15 },
  { id:11, code:'MgMt3083', name:'Performance Management',               department:'Management',                         teacherId:15 },
  { id:12, code:'MgMt3171', name:'Managerial Economics',                 department:'Management',                         teacherId:16 },
  { id:13, code:'MgMt4192', name:'Risk and Insurance Management',        department:'Management',                         teacherId:16 },
  { id:14, code:'MkMg3021', name:'Product and Brand Management',         department:'Marketing Management',               teacherId:17 },
  { id:15, code:'MkMg3022', name:'Consumer Behavior',                    department:'Marketing Management',               teacherId:17 },
  { id:16, code:'MkMg3035', name:'Retail Marketing',                     department:'Marketing Management',               teacherId:18 },
  { id:17, code:'MkMg3071', name:'Marketing Information System',         department:'Marketing Management',               teacherId:18 },
  { id:18, code:'Econ2011', name:'Calculus for Economists',              department:'Economics',                          teacherId:19 },
  { id:19, code:'Econ2021', name:'Microeconomics I',                     department:'Economics',                          teacherId:19 },
  { id:20, code:'Econ2031', name:'Macroeconomics I',                     department:'Economics',                          teacherId:20 },
  { id:21, code:'Econ3091', name:'Financial Economics',                  department:'Economics',                          teacherId:20 },
  { id:22, code:'THM3111',  name:'Tourism Destination Development',      department:'Tourism and Hospitality Management', teacherId:21 },
  { id:23, code:'THM3112',  name:'Tourism Geography',                    department:'Tourism and Hospitality Management', teacherId:21 },
  { id:24, code:'THM3113',  name:'Communication for Tourism',            department:'Tourism and Hospitality Management', teacherId:22 },
  { id:25, code:'THM3114',  name:'Front Office Management',              department:'Tourism and Hospitality Management', teacherId:22 }
]

const DEMO_USERS = [
  { id:1, staffId:'ADM001', username:'admin', password:'1234', name:'Abebe Tesfaye',
    email:'admin@smu.edu.et', role:'admin', department:'Administration', position:'System Administrator' },
  { id:2, staffId:'HOD001', username:'alemayehu', password:'1234', name:'Dr. Alemayehu Kebede',
    email:'alemayehu@smu.edu.et', role:'dept_head', department:'Computer Science', position:'Head of Department' },
  { id:3, staffId:'HOD002', username:'hanna', password:'1234', name:'Dr. Hanna Girma',
    email:'hanna@smu.edu.et', role:'dept_head', department:'Accounting and Finance', position:'Head of Department' },
  { id:4, staffId:'HOD003', username:'yonas', password:'1234', name:'Dr. Yonas Ayele',
    email:'yonas@smu.edu.et', role:'dept_head', department:'Management', position:'Head of Department' },
  { id:5, staffId:'HOD004', username:'bethlehem', password:'1234', name:'Dr. Bethlehem Assefa',
    email:'bethlehem@smu.edu.et', role:'dept_head', department:'Marketing Management', position:'Head of Department' },
  { id:6, staffId:'HOD005', username:'meseret', password:'1234', name:'Prof. Meseret Haile',
    email:'meseret@smu.edu.et', role:'dept_head', department:'Economics', position:'Head of Department' },
  { id:7, staffId:'HOD006', username:'selamH', password:'1234', name:'Dr. Selam Tesfaye',
    email:'selam.hod@smu.edu.et', role:'dept_head', department:'Tourism and Hospitality Management', position:'Head of Department' },
  { id:10, staffId:'T001', username:'tadesse', password:'1234', name:'Dr. Tadesse Alemu',
    email:'tadesse@smu.edu.et', role:'teacher', department:'Computer Science', position:'Senior Lecturer', division:'Both' },
  { id:11, staffId:'T002', username:'hailu', password:'1234', name:'Prof. Hailu Bekele',
    email:'hailu@smu.edu.et', role:'teacher', department:'Computer Science', position:'Assistant Professor', division:'Regular' },
  { id:12, staffId:'T003', username:'selam', password:'1234', name:'Dr. Selam Tesfaye',
    email:'selam@smu.edu.et', role:'teacher', department:'Computer Science', position:'Lecturer', division:'Extension' },
  { id:13, staffId:'T004', username:'tekle', password:'1234', name:'Mr. Tekle Berhan',
    email:'tekle@smu.edu.et', role:'teacher', department:'Accounting and Finance', position:'Lecturer', division:'Regular' },
  { id:14, staffId:'T005', username:'daniel', password:'1234', name:'Mr. Daniel Mekonnen',
    email:'daniel@smu.edu.et', role:'teacher', department:'Accounting and Finance', position:'Lecturer', division:'Both' },
  { id:15, staffId:'T006', username:'kebede', password:'1234', name:'Mr. Kebede Wolde',
    email:'kebede@smu.edu.et', role:'teacher', department:'Management', position:'Senior Lecturer', division:'Regular' },
  { id:16, staffId:'T007', username:'meron', password:'1234', name:'Ms. Meron Assefa',
    email:'meron@smu.edu.et', role:'teacher', department:'Management', position:'Lecturer', division:'Extension' },
  { id:17, staffId:'T008', username:'sara', password:'1234', name:'Ms. Sara Bekele',
    email:'sara@smu.edu.et', role:'teacher', department:'Marketing Management', position:'Lecturer', division:'Regular' },
  { id:18, staffId:'T009', username:'dawit', password:'1234', name:'Mr. Dawit Haile',
    email:'dawit@smu.edu.et', role:'teacher', department:'Marketing Management', position:'Lecturer', division:'Both' },
  { id:19, staffId:'T010', username:'mekdes', password:'1234', name:'Ms. Mekdes Tadesse',
    email:'mekdes@smu.edu.et', role:'teacher', department:'Economics', position:'Lecturer', division:'Regular' },
  { id:20, staffId:'T011', username:'yonatan', password:'1234', name:'Mr. Yonatan Girma',
    email:'yonatan@smu.edu.et', role:'teacher', department:'Economics', position:'Lecturer', division:'Extension' },
  { id:21, staffId:'T012', username:'abel', password:'1234', name:'Mr. Abel Workneh',
    email:'abel@smu.edu.et', role:'teacher', department:'Tourism and Hospitality Management', position:'Lecturer', division:'Regular' },
  { id:22, staffId:'T013', username:'adugna', password:'1234', name:'Ms. Adugna Takele',
    email:'adugna@smu.edu.et', role:'teacher', department:'Tourism and Hospitality Management', position:'Lecturer', division:'Both' },
  { id:30, staffId:'RCD/2020/015', studentId:'RCD/2020/015', division:'Regular', year:2020,
    username:'alemitu', password:'1234', name:'Alemitu Bekele',
    email:'alemitu@students.smu.edu.et', role:'class_rep', department:'Computer Science', position:'Class Representative' },
  { id:31, staffId:'RAD/2020/008', studentId:'RAD/2020/008', division:'Regular', year:2020,
    username:'biruk', password:'1234', name:'Biruk Tadesse',
    email:'biruk@students.smu.edu.et', role:'class_rep', department:'Accounting and Finance', position:'Class Representative' },
  { id:32, staffId:'RMD/2020/022', studentId:'RMD/2020/022', division:'Regular', year:2020,
    username:'hiwot', password:'1234', name:'Hiwot Girma',
    email:'hiwot@students.smu.edu.et', role:'class_rep', department:'Management', position:'Class Representative' },
  { id:33, staffId:'RMKD/2020/012', studentId:'RMKD/2020/012', division:'Regular', year:2020,
    username:'kalkidan', password:'1234', name:'Kalkidan Haile',
    email:'kalkidan@students.smu.edu.et', role:'class_rep', department:'Marketing Management', position:'Class Representative' },
  { id:40, staffId:'RCD/2021/001', studentId:'RCD/2021/001', division:'Regular', year:2021,
    username:'abebe', password:'1234', name:'Abebe Kebede',
    email:'abebe@students.smu.edu.et', role:'student', department:'Computer Science', position:'Student' },
  { id:41, staffId:'RCD/2021/002', studentId:'RCD/2021/002', division:'Regular', year:2021,
    username:'saraS', password:'1234', name:'Sara Solomon',
    email:'sara.s@students.smu.edu.et', role:'student', department:'Computer Science', position:'Student' },
  { id:42, staffId:'RAD/2021/001', studentId:'RAD/2021/001', division:'Regular', year:2021,
    username:'yohannes', password:'1234', name:'Yohannes Girma',
    email:'yohannes@students.smu.edu.et', role:'student', department:'Accounting and Finance', position:'Student' },
  { id:43, staffId:'RMD/2022/001', studentId:'RMD/2022/001', division:'Regular', year:2022,
    username:'tinbit', password:'1234', name:'Tinbit Alemu',
    email:'tinbit@students.smu.edu.et', role:'student', department:'Management', position:'Student' },
  { id:44, staffId:'RMKD/2021/001', studentId:'RMKD/2021/001', division:'Regular', year:2021,
    username:'meronS', password:'1234', name:'Meron Solomon',
    email:'meron.s@students.smu.edu.et', role:'student', department:'Marketing Management', position:'Student' },
  { id:45, staffId:'RED/2021/001', studentId:'RED/2021/001', division:'Regular', year:2021,
    username:'tesfaye', password:'1234', name:'Tesfaye Alemu',
    email:'tesfaye@students.smu.edu.et', role:'student', department:'Economics', position:'Student' },
  { id:46, staffId:'RTD/2021/001', studentId:'RTD/2021/001', division:'Regular', year:2021,
    username:'aster', password:'1234', name:'Aster Bekele',
    email:'aster@students.smu.edu.et', role:'student', department:'Tourism and Hospitality Management', position:'Student' },
  { id:47, staffId:'ECD/2021/005', studentId:'ECD/2021/005', division:'Extension', year:2021,
    username:'henok', password:'1234', name:'Henok Tesfaye',
    email:'henok@students.smu.edu.et', role:'student', department:'Computer Science', position:'Student' },
  { id:48, staffId:'EAD/2020/017', studentId:'EAD/2020/017', division:'Extension', year:2020,
    username:'rahel', password:'1234', name:'Rahel Mekonnen',
    email:'rahel@students.smu.edu.et', role:'student', department:'Accounting and Finance', position:'Student' }
]

export const useDirectoryStore = defineStore('directory', () => {
  const needsSeed = !localStorage.getItem(SEED_FLAG)

  const users       = ref(needsSeed ? DEMO_USERS       : load(USERS_KEY,   DEMO_USERS))
  const departments = ref(needsSeed ? DEMO_DEPARTMENTS : load(DEPTS_KEY,   DEMO_DEPARTMENTS))
  const courses     = ref(needsSeed ? DEMO_COURSES     : load(COURSES_KEY, DEMO_COURSES))

  if (needsSeed) {
    save(USERS_KEY, users.value)
    save(DEPTS_KEY, departments.value)
    save(COURSES_KEY, courses.value)
    localStorage.setItem(SEED_FLAG, '1')
  }

  /* ══════════════════════════════════════════════════════
     PASSWORD MIGRATION
     ------------------------------------------------------
     Any user with a plaintext `password` field gets it
     hashed into `passwordHash`, and the plaintext is
     removed. Safe to call multiple times.
     ══════════════════════════════════════════════════════ */
  let _migrating = null
  function migratePasswords() {
    if (_migrating) return _migrating
    _migrating = (async () => {
      let changed = false
      for (const u of users.value) {
        if (u.password && !u.passwordHash) {
          u.passwordHash = await hashPassword(u.password)
          delete u.password
          changed = true
        }
      }
      if (changed) persistUsers()
      return changed
    })()
    return _migrating
  }

  /* ---------- getters ---------- */
  const teachers  = computed(() => users.value.filter(u => u.role === 'teacher'))
  const students  = computed(() => users.value.filter(u => u.role === 'student'))
  const classReps = computed(() => users.value.filter(u => u.role === 'class_rep'))
  const deptHeads = computed(() => users.value.filter(u => u.role === 'dept_head'))
  const admins    = computed(() => users.value.filter(u => u.role === 'admin'))

  function userById(id) {
    return users.value.find(u => u.id === +id) || null
  }
  function userByUsername(username) {
    const k = String(username || '').trim().toLowerCase()
    return users.value.find(u => String(u.username || '').trim().toLowerCase() === k) || null
  }
  function departmentByName(name) {
    return departments.value.find(d => d.name === name) || null
  }
  function coursesByTeacher(id) {
    return courses.value.filter(c => c.teacherId === id)
  }

  /* ---------- persistence ---------- */
  function persistUsers()       { save(USERS_KEY, users.value) }
  function persistDepartments() { save(DEPTS_KEY, departments.value) }
  function persistCourses()     { save(COURSES_KEY, courses.value) }

  /* ---------- user CRUD (async now — passwords are hashed) ---------- */
  async function addUser(user) {
    const row = { ...user }
    if (row.password) {
      row.passwordHash = await hashPassword(row.password)
      delete row.password
    }
    row.id = row.id || (users.value.length ? Math.max(...users.value.map(u => +u.id || 0)) + 1 : 1)
    users.value.push(row)
    persistUsers()
    return row
  }

  async function updateUser(id, patch) {
    const i = users.value.findIndex(u => u.id === +id)
    if (i < 0) return null
    const next = { ...patch }
    if (next.password) {
      next.passwordHash = await hashPassword(next.password)
      delete next.password
    }
    users.value[i] = { ...users.value[i], ...next, id: +id }
    persistUsers()
    return users.value[i]
  }

  function deleteUser(id) {
    users.value = users.value.filter(u => u.id !== +id)
    persistUsers()
  }

  /* ---------- department CRUD ---------- */
  function addDepartment(d) {
    departments.value.push({ ...d, id: d.id || Date.now() })
    persistDepartments()
  }
  function updateDepartment(id, patch) {
    const i = departments.value.findIndex(d => d.id === +id)
    if (i < 0) return
    departments.value[i] = { ...departments.value[i], ...patch, id: +id }
    persistDepartments()
  }
  function deleteDepartment(id) {
    departments.value = departments.value.filter(d => d.id !== +id)
    persistDepartments()
  }

  /* ---------- student ID helpers ---------- */
  function buildStudentId(deptName, division = 'Regular', year, sequence = 1) {
    const dept = departments.value.find(d => d.name === deptName)
    const divCode  = division === 'Extension' ? 'E' : 'R'
    const deptCode = dept?.idCode || 'XX'
    const yr       = year || new Date().getFullYear()
    const seq      = String(sequence).padStart(3, '0')
    return `${divCode}${deptCode}/${yr}/${seq}`
  }

  function nextStudentSequence(deptName, division, year) {
    const divCode  = division === 'Extension' ? 'E' : 'R'
    const dept     = departments.value.find(d => d.name === deptName)
    const deptCode = dept?.idCode || 'XX'
    const prefix   = `${divCode}${deptCode}/${year}/`
    const nums = users.value
      .filter(u => String(u.studentId || '').startsWith(prefix))
      .map(u => parseInt(String(u.studentId).split('/').pop(), 10) || 0)
    return (nums.length ? Math.max(...nums) : 0) + 1
  }

  /* ---------- bulk replace ---------- */
  function replaceAll({ users: u, departments: d, courses: c }) {
    if (u) { users.value = u; persistUsers() }
    if (d) { departments.value = d; persistDepartments() }
    if (c) { courses.value = c; persistCourses() }
  }

  return {
    users, departments, courses,
    teachers, students, classReps, deptHeads, admins,
    userById, userByUsername, departmentByName, coursesByTeacher,
    addUser, updateUser, deleteUser,
    addDepartment, updateDepartment, deleteDepartment,
    persistUsers, persistDepartments, persistCourses,
    buildStudentId,
    nextStudentSequence,
    migratePasswords,
    replaceAll
  }
})