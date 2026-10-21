import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDirectoryStore } from './directory'

const SECTIONS_KEY = 'tms_classes'
const SEED_FLAG    = 'tms_classes_seeded_v1'

function load(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback }
  catch { return fallback }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

/* ══════════════════════════════════════════════════════
   SEED GENERATOR
   ------------------------------------------------------
   Each class (section) has multiple courses.
   Each course has its own teacher.
   ══════════════════════════════════════════════════════ */
function generateSeed() {
  const dir = useDirectoryStore()
  const rows = []
  let id = 1

  const years          = [2020, 2021, 2022, 2023]
  const yearLevels     = { 2020: 5, 2021: 4, 2022: 3, 2023: 2 }
  const sectionLetters = ['A', 'B', 'C']

  /* Group teachers by department */
  const pool = {}
  dir.teachers.forEach(t => {
    if (!pool[t.department]) pool[t.department] = []
    pool[t.department].push(t.id)
  })

  dir.departments.forEach(dept => {
    const code        = dept.idCode || 'XX'
    const deptCourses = dir.courses.filter(c => c.department === dept.name)
    const teacherList = pool[dept.name] || []

    ;['Regular', 'Extension'].forEach(division => {
      const prefix = (division === 'Extension' ? 'E' : 'R') + code
      years.forEach(year => {
        const letters = division === 'Regular'
          ? sectionLetters
          : sectionLetters.slice(0, 2)

        letters.forEach(sec => {
          /* Each class gets 4–6 courses from its department */
          const courseCount = deptCourses.length
            ? Math.min(deptCourses.length, 4 + ((id + year) % 3))
            : 0

          /* Pick courses + assign a teacher to each (~70% chance) */
          const classCourses = []
          for (let i = 0; i < courseCount; i++) {
            const c = deptCourses[(id + i + year) % deptCourses.length]

            let teacherId = null
            if (teacherList.length && ((id + i * 7) % 10) < 7) {
              teacherId = teacherList[(id + i) % teacherList.length]
            }

            classCourses.push({
              courseId:   c.id,
              courseCode: c.code,
              courseName: c.name,
              teacherId
            })
          }

          rows.push({
            id: id++,
            code: `${prefix}/${year}/${sec}`,
            department: dept.name,
            division,
            year,
            yearLevel: yearLevels[year] || 1,
            section: sec,
            studentCount: 18 + ((id * 7) % 22),
            room: 'NB-' + (100 + id),
            courses: classCourses
          })
        })
      })
    })
  })

  return rows
}

export const useSectionsStore = defineStore('sections', () => {
  const dir = useDirectoryStore()

  const needsSeed = !localStorage.getItem(SEED_FLAG)
  const classes   = ref(needsSeed ? generateSeed() : load(SECTIONS_KEY, []))

  if (needsSeed) {
    save(SECTIONS_KEY, classes.value)
    localStorage.setItem(SEED_FLAG, '1')
  }

  function persist() { save(SECTIONS_KEY, classes.value) }

  /* ══════════════════════════════════════════════════
     FLAT SLOT LISTS (one row per course-teacher pair)
     ══════════════════════════════════════════════════ */
  const allSlots = computed(() => {
    const out = []
    classes.value.forEach(c => {
      (c.courses || []).forEach(cr => {
        out.push({
          classId:    c.id,
          classCode:  c.code,
          department: c.department,
          division:   c.division,
          year:       c.year,
          yearLevel:  c.yearLevel,
          section:    c.section,
          students:   c.studentCount,
          room:       c.room,
          courseId:   cr.courseId,
          courseCode: cr.courseCode,
          courseName: cr.courseName,
          teacherId:  cr.teacherId
        })
      })
    })
    return out
  })

  const assignedSlots   = computed(() => allSlots.value.filter(s => !!s.teacherId))
  const unassignedSlots = computed(() => allSlots.value.filter(s => !s.teacherId))

  const coverage = computed(() => {
    const total = allSlots.value.length
    return total ? Math.round((assignedSlots.value.length / total) * 100) : 0
  })

  /* ══════════════════════════════════════════════════
     CLASSES WITH STATS
     ══════════════════════════════════════════════════ */
  const classesWithStats = computed(() =>
    classes.value.map(c => {
      const total      = (c.courses || []).length
      const assigned   = (c.courses || []).filter(x => x.teacherId).length
      const unassigned = total - assigned
      return {
        ...c,
        totalCourses:      total,
        assignedCourses:   assigned,
        unassignedCourses: unassigned
      }
    })
  )

  function classById(id) {
    return classes.value.find(c => c.id === +id) || null
  }

  /* ══════════════════════════════════════════════════
     TEACHER WORKLOAD
     ══════════════════════════════════════════════════ */
  const teacherWorkload = computed(() => {
    return dir.teachers.map(t => {
      const slots    = allSlots.value.filter(s => s.teacherId === t.id)
      const classIds = new Set(slots.map(s => s.classId))
      return {
        teacher:     t,
        courseCount: slots.length,
        classCount:  classIds.size,
        slots
      }
    }).sort((a, b) => b.courseCount - a.courseCount)
  })

  /* ══════════════════════════════════════════════════
     ASSIGN / UNASSIGN TEACHER FOR A COURSE SLOT
     ══════════════════════════════════════════════════ */
  function assignCourseTeacher(classId, courseId, teacherId) {
    const c = classes.value.find(x => x.id === +classId)
    if (!c) return null
    const cr = (c.courses || []).find(x => x.courseId === +courseId)
    if (!cr) return null
    cr.teacherId = teacherId ? +teacherId : null
    persist()
    return cr
  }

  /* ══════════════════════════════════════════════════
     🆕 COURSE MANAGEMENT INSIDE A CLASS
     ══════════════════════════════════════════════════ */
  function addCourseToClass(classId, courseId, teacherId = null) {
    const c = classes.value.find(x => x.id === +classId)
    if (!c) return null

    const course = dir.courses.find(x => x.id === +courseId)
    if (!course) return null

    c.courses = c.courses || []

    /* Prevent duplicates */
    const exists = c.courses.some(x => x.courseId === +courseId)
    if (exists) return { error: 'duplicate' }

    c.courses.push({
      courseId:   course.id,
      courseCode: course.code,
      courseName: course.name,
      teacherId:  teacherId ? +teacherId : null
    })
    persist()
    return c
  }

  function removeCourseFromClass(classId, courseId) {
    const c = classes.value.find(x => x.id === +classId)
    if (!c) return null
    c.courses = (c.courses || []).filter(x => x.courseId !== +courseId)
    persist()
    return c
  }

  function updateClassCourse(classId, courseId, patch) {
    const c = classes.value.find(x => x.id === +classId)
    if (!c) return null
    const cr = (c.courses || []).find(x => x.courseId === +courseId)
    if (!cr) return null
    Object.assign(cr, patch)
    persist()
    return cr
  }

  /* ══════════════════════════════════════════════════
     CLASS CRUD
     ══════════════════════════════════════════════════ */
  function addClass(row) {
    const next = {
      id: Date.now(),
      courses: [],
      studentCount: 0,
      ...row
    }
    classes.value.push(next)
    persist()
    return next
  }

  function updateClass(id, patch) {
    const i = classes.value.findIndex(c => c.id === +id)
    if (i < 0) return null
    classes.value[i] = { ...classes.value[i], ...patch, id: +id }
    persist()
    return classes.value[i]
  }

  function deleteClass(id) {
    classes.value = classes.value.filter(c => c.id !== +id)
    persist()
  }

  function replaceAll(rows) {
    classes.value = rows
    persist()
  }

  return {
    classes,
    classesWithStats,
    classById,

    allSlots,
    assignedSlots,
    unassignedSlots,
    coverage,

    teacherWorkload,

    assignCourseTeacher,

    /* 🆕 course management */
    addCourseToClass,
    removeCourseFromClass,
    updateClassCourse,

    /* class CRUD */
    addClass,
    updateClass,
    deleteClass,
    replaceAll
  }
})