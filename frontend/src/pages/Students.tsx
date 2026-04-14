import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  type Student,
} from '../api/students'
import { useAuth } from '../context/AuthContext'

const FREE_STUDENT_LIMIT = 5

interface StudentFormData {
  name: string
  phone: string
  email: string
  notes: string
  reminder_preference: string
}

interface ModalState {
  open: boolean
  student: Student | null
}

export default function Students() {
  const { instructor, logout } = useAuth()
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<ModalState>({ open: false, student: null })
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: listStudents,
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<StudentFormData>()

  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StudentFormData }) =>
      updateStudent(id, {
        name: data.name,
        phone: data.phone || undefined,
        email: data.email || undefined,
        notes: data.notes || undefined,
        reminder_preference: data.reminder_preference,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      setDeleteTarget(null)
    },
  })

  function openCreate() {
    reset({ name: '', phone: '', email: '', notes: '', reminder_preference: 'sms' })
    setModal({ open: true, student: null })
  }

  function openEdit(student: Student) {
    reset({
      name: student.name,
      phone: student.phone ?? '',
      email: student.email ?? '',
      notes: student.notes ?? '',
      reminder_preference: student.reminder_preference ?? 'sms',
    })
    setModal({ open: true, student })
  }

  function closeModal() {
    setModal({ open: false, student: null })
    createMutation.reset()
    updateMutation.reset()
  }

  async function onSubmit(data: StudentFormData) {
    if (modal.student) {
      await updateMutation.mutateAsync({ id: modal.student.id, data })
    } else {
      await createMutation.mutateAsync({
        name: data.name,
        phone: data.phone || undefined,
        email: data.email || undefined,
        notes: data.notes || undefined,
        reminder_preference: data.reminder_preference,
      })
    }
  }

  const rawError = (createMutation.error ?? updateMutation.error) as { response?: { data?: { detail?: string } } } | null
  const isFreeLimitError = rawError?.response?.data?.detail === 'free_limit_students'
  const mutationError = isFreeLimitError ? null : rawError

  const atFreeLimit =
    instructor?.plan === 'free' && students.length >= FREE_STUDENT_LIMIT

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/" className="text-gray-400 hover:text-gray-600">Home</Link>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-900">Students</span>
          </nav>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Students</h2>
          <button
            onClick={atFreeLimit ? undefined : openCreate}
            disabled={atFreeLimit}
            title={atFreeLimit ? 'Upgrade to Pro to add more students' : undefined}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add student
          </button>
        </div>

        {(atFreeLimit || isFreeLimitError) && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800">Free plan limit reached</p>
              <p className="text-sm text-amber-700 mt-0.5">You can have up to 5 active students on the free plan.</p>
            </div>
            <Link
              to="/billing"
              className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-700 transition-colors flex-shrink-0 ml-4"
            >
              Upgrade
            </Link>
          </div>
        )}

        {isLoading && <p className="text-sm text-gray-400">Loading...</p>}

        {!isLoading && students.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">No students yet.</p>
            <button
              onClick={openCreate}
              className="text-blue-600 text-sm mt-2 hover:underline"
            >
              Add your first student
            </button>
          </div>
        )}

        <div className="space-y-3">
          {students.map((student) => (
            <div
              key={student.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <div className="font-medium text-gray-900">{student.name}</div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {[student.phone, student.email].filter(Boolean).join(' · ') || 'No contact info'}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to={`/students/${student.id}`}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  View
                </Link>
                <button
                  onClick={() => openEdit(student)}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(student)}
                  className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Add / Edit modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">
              {modal.student ? 'Edit student' : 'Add student'}
            </h3>

            {mutationError && (
              <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {mutationError?.response?.data?.detail ?? 'Something went wrong. Please try again.'}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  {...register('name', { required: 'Name is required' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.name && (
                  <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="tel"
                  {...register('phone')}
                  placeholder="+44 7700 900000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="email"
                  {...register('email')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  {...register('notes')}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reminders</label>
                <select
                  {...register('reminder_preference')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sms">SMS only</option>
                  <option value="push">Push notification only</option>
                  <option value="both">SMS + Push</option>
                  <option value="none">No reminders</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : modal.student ? 'Save changes' : 'Add student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete student?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will remove <strong>{deleteTarget.name}</strong> from your active student list.
              Their lesson history will be preserved.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
