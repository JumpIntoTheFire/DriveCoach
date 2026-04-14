import client from './client'

export interface Lesson {
  id: string
  instructor_id: string
  student_id: string
  student_name: string
  start_time: string
  duration_minutes: number
  location: string | null
  price: number | null
  status: 'upcoming' | 'completed' | 'cancelled' | 'rescheduled'
  created_at: string
}

export interface LessonCreate {
  student_id: string
  start_time: string
  duration_minutes?: number
  location?: string
  price?: number
  status?: string
}

export interface LessonUpdate {
  student_id?: string
  start_time?: string
  duration_minutes?: number
  location?: string
  price?: number
  status?: string
}

export async function listLessons(studentId?: string): Promise<Lesson[]> {
  const params = studentId ? { student_id: studentId } : {}
  const { data } = await client.get<Lesson[]>('/lessons', { params })
  return data
}

export async function createLesson(payload: LessonCreate): Promise<Lesson> {
  const { data } = await client.post<Lesson>('/lessons', payload)
  return data
}

export async function updateLesson(id: string, payload: LessonUpdate): Promise<Lesson> {
  const { data } = await client.put<Lesson>(`/lessons/${id}`, payload)
  return data
}

export async function deleteLesson(id: string): Promise<void> {
  await client.delete(`/lessons/${id}`)
}
