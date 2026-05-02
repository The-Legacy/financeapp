import React, { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { cn } from './lib/formatters'

const Dashboard    = lazy(() => import('./pages/Dashboard/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions/Transactions'))
const Budgets      = lazy(() => import('./pages/Budgets/Budgets'))
const Loans        = lazy(() => import('./pages/Loans/Loans'))
const Charges      = lazy(() => import('./pages/Charges/Charges'))
const Accounts     = lazy(() => import('./pages/Accounts/Accounts'))
const CreditCards  = lazy(() => import('./pages/CreditCards/CreditCards'))
const Settings     = lazy(() => import('./pages/Settings/Settings'))
const Manage       = lazy(() => import('./pages/Manage/Manage'))

// Minimal stroke-based SVG icons (24×24 viewBox, 1.75px stroke)
type IconName = 'dashboard' | 'transactions' | 'budgets' | 'loans' | 'charges' | 'accounts' | 'credit-cards' | 'manage' | 'settings'

function Icon({ name }: { name: IconName }) {
  const sp = { fill: 'none', stroke: 'currentColor', strokeWidth: '1.75', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const S = (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="15" height="15" {...sp} {...p} />
  switch (name) {
    case 'dashboard':
      return <S><rect x="3" y="3" width="7" height="7" rx="0.5"/><rect x="14" y="3" width="7" height="7" rx="0.5"/><rect x="3" y="14" width="7" height="7" rx="0.5"/><rect x="14" y="14" width="7" height="7" rx="0.5"/></S>
    case 'transactions':
      return <S><line x1="9" y1="7" x2="20" y2="7"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="17" x2="15" y2="17"/><circle cx="5" cy="7" r="1.5" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="5" cy="17" r="1.5" fill="currentColor" stroke="none"/></S>
    case 'budgets':
      return <S><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></S>
    case 'loans':
      return <S><path d="M3 21h18M4 10h16M12 3 4 10h16L12 3z"/><line x1="8" y1="10" x2="8" y2="21"/><line x1="16" y1="10" x2="16" y2="21"/></S>
    case 'charges':
      return <S><rect x="3" y="4" width="18" height="18" rx="1"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></S>
    case 'accounts':
      return <S><rect x="2" y="7" width="20" height="14" rx="1"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></S>
    case 'credit-cards':
      return <S><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="6" y1="15" x2="6" y2="15" strokeWidth="3" strokeLinecap="round"/><line x1="10" y1="15" x2="13" y2="15" strokeWidth="3" strokeLinecap="round"/></S>
    case 'manage':
      return <S><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="15" y2="17"/><circle cx="18.5" cy="17" r="2.5"/></S>
    case 'settings':
      return <S><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-2.82-1.17l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 5.26V5a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 2z"/></S>
  }
}

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/',             label: 'Dashboard',    icon: 'dashboard'    },
  { to: '/transactions', label: 'Transactions', icon: 'transactions' },
  { to: '/budgets',      label: 'Budgets',      icon: 'budgets'      },
  { to: '/loans',        label: 'Loans',        icon: 'loans'        },
  { to: '/charges',      label: 'Charges',      icon: 'charges'      },
  { to: '/accounts',     label: 'Accounts',      icon: 'accounts'     },
  { to: '/credit-cards', label: 'Credit Cards',  icon: 'credit-cards' },
  { to: '/manage',       label: 'Manage',        icon: 'manage'       },
  { to: '/settings',     label: 'Settings',     icon: 'settings'     },
]

function Sidebar() {
  return (
    <aside className="w-52 shrink-0 flex flex-col border-r"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      {/* Logo mark */}
      <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div style={{
            width: 20, height: 20, borderRadius: 3, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent-light) 0%, var(--primary) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
          }} />
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: 'var(--text)' }}>Finance</span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-2">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors w-full',
                isActive ? 'nav-active' : 'nav-inactive'
              )
            }
          >
            <Icon name={icon} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom spacer */}
      <div className="h-4" />
    </aside>
  )
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>
      Loading…
    </div>
  )
}

export default function App() {
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'light') document.documentElement.classList.remove('dark')
    else document.documentElement.classList.add('dark')
  }, [])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budgets"      element={<Budgets />} />
            <Route path="/loans"        element={<Loans />} />
            <Route path="/charges"      element={<Charges />} />
            <Route path="/accounts"     element={<Accounts />} />
            <Route path="/credit-cards" element={<CreditCards />} />
            <Route path="/manage"       element={<Manage />} />
            <Route path="/settings"     element={<Settings />} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
