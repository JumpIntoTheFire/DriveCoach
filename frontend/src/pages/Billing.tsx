import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createCheckoutSession, getPortalUrl } from '../api/billing'

export default function Billing() {
  const { instructor, logout } = useAuth()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState<'checkout' | 'portal' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const success = searchParams.get('success') === '1'
  const cancelled = searchParams.get('cancelled') === '1'

  const isPro = instructor?.plan === 'pro'

  useEffect(() => {
    // Clear query params from URL without re-render
    if (success || cancelled) {
      window.history.replaceState({}, '', '/billing')
    }
  }, [success, cancelled])

  async function handleUpgrade() {
    setLoading('checkout')
    setError(null)
    try {
      const url = await createCheckoutSession()
      window.location.href = url
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err?.response?.data?.detail ?? 'Failed to start checkout')
      setLoading(null)
    }
  }

  async function handlePortal() {
    setLoading('portal')
    setError(null)
    try {
      const url = await getPortalUrl()
      window.location.href = url
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err?.response?.data?.detail ?? 'Failed to open billing portal')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/" className="text-gray-400 hover:text-gray-600">Home</Link>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-900">Billing</span>
          </nav>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 text-sm font-medium">
            You're now on Pro. All features are unlocked.
          </div>
        )}
        {cancelled && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
            Checkout cancelled — no charge was made.
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
        )}

        {/* Current plan */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Current plan</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  isPro ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {isPro ? 'Pro' : 'Free'}
                </span>
                <span className="text-sm text-gray-500">
                  {isPro ? '£9.99 / month' : 'Up to 5 students · 30 SMS / month'}
                </span>
              </div>
            </div>
            {isPro && (
              <button
                onClick={handlePortal}
                disabled={loading === 'portal'}
                className="text-sm text-blue-600 hover:underline disabled:opacity-50"
              >
                {loading === 'portal' ? 'Opening...' : 'Manage subscription'}
              </button>
            )}
          </div>
        </div>

        {/* Plan comparison */}
        <div className="grid grid-cols-2 gap-4">
          {/* Free */}
          <div className={`bg-white border rounded-xl p-5 ${!isPro ? 'border-blue-300 ring-1 ring-blue-300' : 'border-gray-200'}`}>
            <div className="text-base font-semibold text-gray-900 mb-1">Free</div>
            <div className="text-2xl font-bold text-gray-900 mb-4">£0</div>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✓ Up to 5 students</li>
              <li>✓ 30 SMS reminders / month</li>
              <li>✓ Manual reminders</li>
              <li>✓ Calendar view</li>
              <li className="text-gray-400">✗ Automated reminders</li>
              <li className="text-gray-400">✗ Unlimited students</li>
              <li className="text-gray-400">✗ CSV export</li>
            </ul>
          </div>

          {/* Pro */}
          <div className={`bg-white border rounded-xl p-5 ${isPro ? 'border-blue-300 ring-1 ring-blue-300' : 'border-gray-200'}`}>
            <div className="text-base font-semibold text-gray-900 mb-1">Pro</div>
            <div className="text-2xl font-bold text-gray-900 mb-4">£9.99<span className="text-sm font-normal text-gray-500">/mo</span></div>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>✓ Unlimited students</li>
              <li>✓ Unlimited SMS (at cost)</li>
              <li>✓ Automated reminders (24h + 1h)</li>
              <li>✓ Full lesson history</li>
              <li>✓ CSV export</li>
              <li>✓ Earnings dashboard</li>
              <li>✓ Priority support</li>
            </ul>
          </div>
        </div>

        {!isPro && (
          <button
            onClick={handleUpgrade}
            disabled={loading === 'checkout'}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading === 'checkout' ? 'Redirecting to Stripe...' : 'Upgrade to Pro — £9.99/month'}
          </button>
        )}

        {isPro && (
          <p className="text-center text-sm text-gray-400">
            To cancel your subscription, use{' '}
            <button onClick={handlePortal} className="text-blue-600 hover:underline">
              the billing portal
            </button>
            .
          </p>
        )}
      </main>
    </div>
  )
}
