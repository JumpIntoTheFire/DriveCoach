import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getMetrics } from '../api/dashboard'

interface NavCard {
  label: string
  description: string
  href: string
  available: boolean
  badge: string
}

const cards: NavCard[] = [
  { label: 'Students', description: 'Manage your students', href: '/students', available: true, badge: 'S' },
  { label: 'Calendar', description: 'Book and view lessons', href: '/calendar', available: true, badge: 'C' },
  { label: 'Billing', description: 'Manage your plan', href: '/billing', available: true, badge: '£' },
  { label: 'Earnings', description: 'Coming soon', href: '#', available: false, badge: 'E' },
]

export default function Dashboard() {
  const { instructor, logout } = useAuth()
  const firstName = instructor?.name?.split(' ')[0] ?? 'there'

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: getMetrics,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">DriveCoach</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{instructor?.name}</span>
            <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-5">Welcome back, {firstName}</h2>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{metrics?.total_students ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-1">Students</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{metrics?.lessons_today ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-1">Today's lessons</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {metrics != null ? `£${metrics.week_earnings.toFixed(0)}` : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Earned this week</div>
          </div>
        </div>

        {/* Nav cards */}
        <div className="grid grid-cols-2 gap-4">
          {cards.map(({ label, description, href, available, badge }) =>
            available ? (
              <Link
                key={label}
                to={href}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold mb-3">
                  {badge}
                </div>
                <div className="font-medium text-gray-900">{label}</div>
                <div className="text-sm text-gray-500 mt-0.5">{description}</div>
              </Link>
            ) : (
              <div key={label} className="bg-white border border-gray-100 rounded-xl p-5 opacity-50 cursor-not-allowed">
                <div className="w-8 h-8 bg-gray-100 text-gray-400 rounded-lg flex items-center justify-center text-sm font-bold mb-3">
                  {badge}
                </div>
                <div className="font-medium text-gray-500">{label}</div>
                <div className="text-sm text-gray-400 mt-0.5">{description}</div>
              </div>
            )
          )}
        </div>

        <div className={`mt-6 border rounded-xl p-4 flex items-center justify-between ${
          instructor?.plan === 'pro'
            ? 'bg-blue-50 border-blue-100'
            : 'bg-amber-50 border-amber-100'
        }`}>
          <div>
            <div className={`text-sm font-medium ${instructor?.plan === 'pro' ? 'text-blue-800' : 'text-amber-800'}`}>
              {instructor?.plan === 'pro' ? 'Pro plan — all features unlocked' : 'Free plan'}
            </div>
            {instructor?.plan !== 'pro' && (
              <div className="text-sm text-amber-700 mt-0.5">
                Up to 5 students · 30 SMS / month · no automated reminders
              </div>
            )}
          </div>
          {instructor?.plan !== 'pro' && (
            <a
              href="/billing"
              className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-700 transition-colors flex-shrink-0 ml-4"
            >
              Upgrade
            </a>
          )}
        </div>
      </main>
    </div>
  )
}
