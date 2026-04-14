import client from './client'

export interface Student {
  id: string
  instructor_id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  is_active: boolean
  reminder_preference: string
  created_at: string
}

export interface StudentCreate {
  name: string
  phone?: string
  email?: string
  notes?: string
  reminder_preference?: string
}

export interface StudentUpdate {
  name?: string
  phone?: string
  email?: string
  notes?: string
  is_active?: boolean
  reminder_preference?: string
}

export async function getStudent(id: string): Promise<Student> {
  const { data } = await client.get<Student>(`/students/${id}`)
  return data
}

export async function listStudents(): Promise<Student[]> {
  const { data } = await client.get<Student[]>('/students')
  return data
}

export async function createStudent(payload: StudentCreate): Promise<Student> {
  const { data } = await client.post<Student>('/students', payload)
  return data
}

export async function updateStudent(id: string, payload: StudentUpdate): Promise<Student> {
  const { data } = await client.put<Student>(`/students/${id}`, payload)
  return data
}

export async function deleteStudent(id: string): Promise<void> {
  await client.delete(`/students/${id}`)
}
