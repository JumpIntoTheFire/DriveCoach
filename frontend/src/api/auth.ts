import client from './client'

export interface Instructor {
  id: string
  email: string
  name: string
  phone: string | null
  plan: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  name: string
  phone?: string
}

export async function login(payload: LoginPayload): Promise<string> {
  const { data } = await client.post<{ access_token: string }>('/auth/login', payload)
  return data.access_token
}

export async function register(payload: RegisterPayload): Promise<string> {
  const { data } = await client.post<{ access_token: string }>('/auth/register', payload)
  return data.access_token
}

export async function logout(): Promise<void> {
  await client.post('/auth/logout')
}

export async function getMe(): Promise<Instructor> {
  const { data } = await client.get<Instructor>('/auth/me')
  return data
}
