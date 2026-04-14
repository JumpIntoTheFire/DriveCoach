import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  withCredentials: true, // send httpOnly refresh_token cookie automatically
})

// Attach the access token from localStorage to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, attempt a silent token refresh once, then retry the original request
let isRefreshing = false
let pendingRequests: Array<(token: string) => void> = []

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean }

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // Queue requests that arrive while a refresh is already in flight
        return new Promise((resolve) => {
          pendingRequests.push((token) => {
            original.headers.Authorization = `Bearer ${token}`
            resolve(client(original))
          })
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        const { data } = await client.post<{ access_token: string }>('/auth/refresh')
        localStorage.setItem('access_token', data.access_token)
        pendingRequests.forEach((cb) => cb(data.access_token))
        pendingRequests = []
        original.headers.Authorization = `Bearer ${data.access_token}`
        return client(original)
      } catch {
        localStorage.removeItem('access_token')
        window.location.href = '/login'
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default client
