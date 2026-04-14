import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, dateFnsLocalizer, Views, type View, type SlotInfo } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enGB } from 'date-fns/locale'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { listLessons, createLesson, updateLesson, deleteLesson, type Lesson } from '../api/lessons'
import { listStudents } from '../api/students'
import { sendManualReminder } from '../api/reminders'
import { useAuth } from '../context/AuthContext'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-GB': enGB },
})

const EVENT_BG: Record<string, string> = {
  upcoming: '#2563eb',
  completed: '#16a34a',
  cancelled: '#9ca3af',
  rescheduled: '#d97706',
}

interface LessonEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: Lesson
}

interface BookingForm {
  studentId: string
  date: string
  time: string
  duration: string
  location: string
  price: string
  status: string
}

function toDateStr(d: Date) {
  return format(d, 'yyyy-MM-dd')
}
function toTimeStr(d: Date) {
  return format(d, 'HH:mm')
}

export default function CalendarPage() {
  const { logout } = useAuth()
  const queryClient = useQueryClient()

  const [currentView, setCurrentView] = useState<View>(Views.WEEK)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [editLesson, setEditLesson] = useState<Lesson | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [remindState, setRemindState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const { data: lessons = [] } = useQuery({ queryKey: ['lessons'], queryFn: () => listLessons() })
  const { data: students = [] } = useQuery({ queryKey: ['students'], queryFn: listStudents })

  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<BookingForm>()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['lessons'] })
    queryClient.invalidateQueries({ queryKey: ['metrics'] })
  }

  const createMutation = useMutation({ mutationFn: createLesson, onSuccess: () => { invalidate(); closeModal() } })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateLesson>[1] }) => updateLesson(id, data),
    onSuccess: () => { invalidate(); closeModal() },
  })
  const deleteMutation = useMutation({ mutationFn: deleteLesson, onSuccess: () => { invalidate(); closeModal() } })

  const events: LessonEvent[] = lessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.student_name,
    start: new Date(lesson.start_time),
    end: new Date(new Date(lesson.start_time).getTime() + lesson.duration_minutes * 60000),
    resource: lesson,
  }))

  function openCreate(slot: SlotInfo) {
    const start = slot.start instanceof Date ? slot.start : new Date(slot.start)
    reset({ studentId: '', date: toDateStr(start), time: toTimeStr(start), duration: '60', location: '', price: '', status: 'upcoming' })
    setEditLesson(null)
    setModalOpen(true)
  }

  function openEdit(lesson: Lesson) {
    const start = new Date(lesson.start_time)
    reset({
      studentId: lesson.student_id,
      date: toDateStr(start),
      time: toTimeStr(start),
      duration: String(lesson.duration_minutes),
      location: lesson.location ?? '',
      price: lesson.price != null ? String(lesson.price) : '',
      status: lesson.status,
    })
    setEditLesson(lesson)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditLesson(null)
    setRemindState('idle')
    createMutation.reset()
    updateMutation.reset()
  }

  async function handleRemind() {
    if (!editLesson) return
    setRemindState('sending')
    try {
      await sendManualReminder(editLesson.id)
      setRemindState('sent')
      setTimeout(() => setRemindState('idle'), 3000)
    } catch {
      setRemindState('error')
      setTimeout(() => setRemindState('idle'), 3000)
    }
  }

  async function onSubmit(data: BookingForm) {
    const payload = {
      student_id: data.studentId,
      start_time: new Date(`${data.date}T${data.time}:00`).toISOString(),
      duration_minutes: Number(data.duration),
      location: data.location || undefined,
      price: data.price ? Number(data.price) : undefined,
      status: data.status,
    }
    if (editLesson) {
      await updateMutation.mutateAsync({ id: editLesson.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
  }

  const eventPropGetter = useCallback((event: object) => {
    const lesson = (event as LessonEvent).resource
    return { style: { backgroundColor: EVENT_BG[lesson.status] ?? '#2563eb', border: 'none', borderRadius: '4px' } }
  }, [])

  const mutationError = (editLesson ? updateMutation.error : createMutation.error) as { response?: { data?: { detail?: string } } } | null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/" className="text-gray-400 hover:text-gray-600">Home</Link>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-900">Calendar</span>
          </nav>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4" style={{ height: 620 }}>
          <Calendar
            localizer={localizer}
            events={events}
            view={currentView}
            date={currentDate}
            onView={setCurrentView}
            onNavigate={setCurrentDate}
            selectable
            onSelectSlot={openCreate}
            onSelectEvent={(event) => openEdit((event as unknown as LessonEvent).resource)}
            eventPropGetter={eventPropGetter}
            culture="en-GB"
            style={{ height: '100%' }}
          />
        </div>

        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          {Object.entries(EVENT_BG).map(([s, c]) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c }} />
              <span className="capitalize">{s}</span>
            </div>
          ))}
        </div>
      </main>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">
              {editLesson ? 'Edit booking' : 'New booking'}
            </h3>

            {mutationError && (
              <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {mutationError?.response?.data?.detail ?? 'Something went wrong'}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                <select
                  {...register('studentId', { required: true })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {errors.studentId && <p className="text-xs text-red-600 mt-1">Student is required</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" {...register('date', { required: true })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                  <input type="time" {...register('time', { required: true })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <select {...register('duration')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location <span className="text-gray-400">(optional)</span>
                  </label>
                  <input type="text" {...register('location')} placeholder="e.g. Town centre"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price £ <span className="text-gray-400">(optional)</span>
                  </label>
                  <input type="number" step="0.01" min="0" {...register('price')} placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {editLesson && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select {...register('status')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="upcoming">Upcoming</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="rescheduled">Rescheduled</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {editLesson && (
                  <>
                    <button type="button" onClick={() => deleteMutation.mutate(editLesson.id)}
                      disabled={deleteMutation.isPending}
                      className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                      Delete
                    </button>
                    {editLesson.status === 'upcoming' && (
                      <button type="button" onClick={handleRemind}
                        disabled={remindState === 'sending'}
                        className="px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50">
                        {remindState === 'sending' ? '...' : remindState === 'sent' ? 'Sent!' : remindState === 'error' ? 'Failed' : 'Remind'}
                      </button>
                    )}
                  </>
                )}
                <button type="button" onClick={closeModal}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : editLesson ? 'Save changes' : 'Book lesson'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
