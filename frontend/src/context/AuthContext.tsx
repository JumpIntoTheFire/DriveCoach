import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type Instructor,
  type LoginPayload,
  type RegisterPayload,
} from '../api/auth'

interface AuthContextValue {
  instructor: Instructor | null
  isLoading: boolean
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [instructor, setInstructor] = useState<Instructor | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount, rehydrate session from stored access token
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setIsLoading(false)
      return
    }
    getMe()
      .then(setInstructor)
      .catch(() => localStorage.removeItem('access_token'))
      .finally(() => setIsLoading(false))
  }, [])

  async function login(payload: LoginPayload) {
    const token = await apiLogin(payload)
    localStorage.setItem('access_token', token)
    const me = await getMe()
    setInstructor(me)
  }

  async function register(payload: RegisterPayload) {
    const token = await apiRegister(payload)
    localStorage.setItem('access_token', token)
    const me = await getMe()
    setInstructor(me)
  }

  async function logout() {
    try {
      await apiLogout()
    } finally {
      localStorage.removeItem('access_token')
      setInstructor(null)
    }
  }

  return (
    <AuthContext.Provider value={{ instructor, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
