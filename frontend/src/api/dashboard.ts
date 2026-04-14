import client from './client'

export interface DashboardMetrics {
  total_students: number
  lessons_today: number
  week_earnings: number
}

export async function getMetrics(): Promise<DashboardMetrics> {
  const { data } = await client.get<DashboardMetrics>('/dashboard/metrics')
  return data
}
