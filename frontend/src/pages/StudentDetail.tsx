import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStudent } from '../api/students'
import { listLessons, type Lesson } from '../api/lessons'
import { sendManualReminder } from '../api/reminders'
import { useAuth } from '../context/AuthContext'
import { formatDateTime } from '../utils/formatDate'

const STATUS_STYLES: Record<string, string> = {
  upcoming: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  rescheduled: 'bg-amber-100 text-amber-700',
}

function LessonRow({ lesson }: { lesson: Lesson }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  async function handleRemind() {
    setSending(true)
    setSendError(null)
    try {
      await sendManualReminder(lesson.id)
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setSendError(err?.response?.data?.detail ?? 'Failed to send reminder')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium text-gray-900">{formatDateTime(lesson.start_time)}</div>
          <div className="text-sm text-gray-500 mt-0.5">
            {lesson.duration_minutes} min
            {lesson.location && ` · ${lesson.location}`}
          </div>
          {sendError && <p className="text-xs text-red-600 mt-1">{sendError}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {lesson.price != null && (
            <span className="text-sm font-medium text-gray-700">£{lesson.price.toFixed(2)}</span>
          )}
          <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[lesson.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {lesson.status}
          </span>
          {lesson.status === 'upcoming' && (
            <button
              onClick={handleRemind}
              disabled={sending}
              className="text-xs px-2 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {sending ? '...' : sent ? 'Sent!' : 'Remind'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>()
  const { logout } = useAuth()

  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ['students', id],
    queryFn: () => getStudent(id!),
    enabled: !!id,
  })

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ['lessons', { studentId: id }],
    queryFn: () => listLessons(id),
    enabled: !!id,
  })

  const sortedLessons = [...lessons].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  )

  if (studentLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-sm text-gray-500">Student not found. <Link to="/students" className="text-blue-600 hover:underline">Back to students</Link></div>
      </div>
    )
  }

  const completedLessons = lessons.filter((l) => l.status === 'completed')
  const totalEarned = completedLessons.reduce((sum, l) => sum + (l.price ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/" className="text-gray-400 hover:text-gray-600">Home</Link>
            <span className="text-gray-300">/</span>
            <Link to="/students" className="text-gray-400 hover:text-gray-600">Students</Link>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-900">{student.name}</span>
          </nav>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Student info card */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{student.name}</h2>
              <div className="text-sm text-gray-500 mt-1">
                {[student.phone, student.email].filter(Boolean).join(' · ') || 'No contact info'}
              </div>
              {student.notes && (
                <div className="text-sm text-gray-500 mt-2 border-t border-gray-100 pt-2">{student.notes}</div>
              )}
            </div>
            <Link
              to="/students"
              className="text-sm text-blue-600 hover:underline flex-shrink-0 ml-4"
            >
              Edit
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{lessons.length}</div>
              <div className="text-xs text-gray-500">Total lessons</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{completedLessons.length}</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">£{totalEarned.toFixed(0)}</div>
              <div className="text-xs text-gray-500">Earned</div>
            </div>
          </div>
        </div>

        {/* Lesson history */}
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Lesson history</h3>

        {lessonsLoading && <p className="text-sm text-gray-400">Loading...</p>}

        {!lessonsLoading && sortedLessons.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400">No lessons yet.</p>
            <Link to="/calendar" className="text-blue-600 text-sm mt-2 inline-block hover:underline">
              Book the first lesson
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {sortedLessons.map((lesson) => (
            <LessonRow key={lesson.id} lesson={lesson} />
          ))}
        </div>
      </main>
    </div>
  )
}
