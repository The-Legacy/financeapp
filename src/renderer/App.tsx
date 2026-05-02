import React, { Suspense, lazy } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { cn } from './lib/formatters'

const Dashboard    = lazy(() => import('./pages/Dashboard/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions/Transactions'))
const Budgets      = lazy(() => import('./pages/Budgets/Budgets'))
const Loans        = lazy(() => import('./pages/Loans/Loans'))
const Charges      = lazy(() => import('./pages/Charges/Charges'))
const Accounts     = lazy(() => import('./pages/Accounts/Accounts'))
const Settings     = lazy(() => import('./pages/Settings/Settings'))
const Manage       = lazy(() => import('./pages/Manage/Manage'))

const NAV = [
  { to: '/',            label: 'Dashboard',    icon: '📊' },
  { to: '/transactions',label: 'Transactions', icon: '📋' },
  { to: '/budgets',     label: 'Budgets',      icon: '💰' },
  { to: '/loans',       label: 'Loans',        icon: '🏦' },
  { to: '/charges',     label: 'Charges',      icon: '📅' },
  { to: '/accounts',    label: 'Accounts',     icon: '🏧' },
  { to: '/manage',      label: 'Manage',       icon: '🏷️' },
  { to: '/settings',    label: 'Settings',     icon: '⚙️'  },
]

function Sidebar() {
  return (
    <aside className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="px-5 py-4 border-b border-gray-800">
        <h1 className="text-base font-bold text-indigo-400 tracking-tight">💵 Finance</h1>
      </div>
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-indigo-900/60 text-indigo-300 font-medium'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              )
            }
          >
            <span className="text-base leading-none">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
      Loading…
    </div>
  )
}

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budgets"      element={<Budgets />} />
            <Route path="/loans"        element={<Loans />} />
            <Route path="/charges"      element={<Charges />} />
            <Route path="/accounts"     element={<Accounts />} />
            <Route path="/manage"       element={<Manage />} />
            <Route path="/settings"     element={<Settings />} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
