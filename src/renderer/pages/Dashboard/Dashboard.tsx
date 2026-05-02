import React, { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid
} from 'recharts'
import { invoke } from '../../lib/api'
import { formatCurrency, formatDate, formatMonth, currentMonth, monthStart, monthEnd, daysUntil } from '../../lib/formatters'
import type { Transaction, Loan, Charge, MonthlyPnL, SpendingByCategory, Account } from '../../types'

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color ?? 'text-gray-100'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

const CHART_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#a855f7','#84cc16','#f97316']

export default function Dashboard() {
  const month = currentMonth()
  const [monthSummary, setMonthSummary] = useState<{ income: number; expenses: number; net: number } | null>(null)
  const [lifetimeSummary, setLifetimeSummary] = useState<{ income: number; expenses: number; net: number } | null>(null)
  const [recentTx, setRecentTx] = useState<Transaction[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [monthlyPnL, setMonthlyPnL] = useState<MonthlyPnL[]>([])
  const [spendingByCat, setSpendingByCat] = useState<SpendingByCategory[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [seeded, setSeeded] = useState(false)

  const load = useCallback(async () => {
    const [
      mSumm, lSumm, recent, loansData, chargesData, pnl, catSpend, accts
    ] = await Promise.all([
      invoke<{ income: number; expenses: number; net: number }>('transactions:summary', monthStart(month), monthEnd(month)),
      invoke<{ income: number; expenses: number; net: number }>('transactions:summary', '2000-01-01', '2099-12-31'),
      invoke<Transaction[]>('transactions:list', { startDate: monthStart(month), endDate: monthEnd(month) }),
      invoke<Loan[]>('loans:list'),
      invoke<Charge[]>('charges:list'),
      invoke<MonthlyPnL[]>('transactions:monthlyPnL'),
      invoke<SpendingByCategory[]>('transactions:byCategory', monthStart(month), monthEnd(month)),
      invoke<Account[]>('accounts:list'),
    ])
    setMonthSummary(mSumm)
    setLifetimeSummary(lSumm)
    setRecentTx(recent.slice(0, 8))
    setLoans(loansData.filter(l => l.status === 'active'))
    setCharges(chargesData.filter(c => c.status !== 'paid' && c.status !== 'canceled'))
    setMonthlyPnL(pnl)
    setSpendingByCat(catSpend.slice(0, 8))
    setAccounts(accts)
  }, [month])

  useEffect(() => { load() }, [load])

  async function handleSeedData() {
    await invoke('dev:seed')
    setSeeded(true)
    await load()
  }

  const totalAssets = accounts.filter(a => !['credit_card','loan'].includes(a.type)).reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const totalLoanBalance = loans.reduce((s, l) => s + l.current_balance, 0)
  const upcomingCharges = charges.filter(c => daysUntil(c.due_date) <= 60).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-400">{formatMonth(month)}</p>
        </div>
        {!seeded && (
          <button className="btn-secondary text-xs" onClick={handleSeedData}>Load Demo Data</button>
        )}
      </div>

      {/* This Month Stats */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">This Month</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Income" value={formatCurrency(monthSummary?.income ?? 0)} color="text-green-400" />
          <StatCard label="Expenses" value={formatCurrency(monthSummary?.expenses ?? 0)} color="text-red-400" />
          <StatCard
            label="Net Gain/Loss"
            value={formatCurrency(monthSummary?.net ?? 0)}
            color={(monthSummary?.net ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}
          />
          <StatCard label="Total Assets" value={formatCurrency(totalAssets)} color="text-indigo-400" />
        </div>
      </div>

      {/* Lifetime Stats */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Lifetime</h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Income" value={formatCurrency(lifetimeSummary?.income ?? 0)} color="text-green-400" />
          <StatCard label="Total Expenses" value={formatCurrency(lifetimeSummary?.expenses ?? 0)} color="text-red-400" />
          <StatCard
            label="Net"
            value={formatCurrency(lifetimeSummary?.net ?? 0)}
            color={(lifetimeSummary?.net ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}
          />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-5">
        {/* Monthly P&L Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4">Monthly Income vs Expenses</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyPnL} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Bar dataKey="income" name="Income" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Spending by Category */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4">Spending by Category</h3>
          {spendingByCat.length === 0 ? (
            <div className="text-sm text-gray-500 flex items-center justify-center h-[220px]">No expense data this month.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={spendingByCat} dataKey="total" nameKey="category" cx="45%" outerRadius={80} stroke="none">
                  {spendingByCat.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  iconSize={8}
                  formatter={(v) => <span style={{ color: '#9ca3af', fontSize: 11 }}>{v}</span>}
                />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(v: number) => formatCurrency(v)}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Transactions */}
        <div className="card lg:col-span-2">
          <h3 className="text-sm font-semibold mb-3">Recent Transactions</h3>
          <div className="space-y-1.5">
            {recentTx.length === 0 && <p className="text-sm text-gray-500">No transactions this month.</p>}
            {recentTx.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-gray-800/50 last:border-0">
                <div>
                  <div className="text-sm text-gray-100 truncate max-w-[220px]">{tx.description}</div>
                  <div className="text-xs text-gray-500">{formatDate(tx.date)} · {tx.category_name ?? tx.type}</div>
                </div>
                <div className={`text-sm font-mono font-medium ${['income','refund'].includes(tx.type) ? 'pos' : 'neg'}`}>
                  {['income','refund'].includes(tx.type) ? '+' : '-'}{formatCurrency(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column — Loans + Charges */}
        <div className="space-y-4">
          {/* Active Loans */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3">Active Loans</h3>
            {loans.length === 0 && <p className="text-xs text-gray-500">No active loans.</p>}
            {loans.map(loan => (
              <div key={loan.id} className="mb-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300">{loan.name}</span>
                  <span className="neg font-medium">{formatCurrency(loan.current_balance)}</span>
                </div>
                <div className="mt-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full"
                    style={{ width: `${Math.min(100, (loan.current_balance / loan.original_principal) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{formatCurrency(loan.original_principal - loan.current_balance)} paid off</div>
              </div>
            ))}
            {loans.length > 0 && (
              <div className="border-t border-gray-800 pt-2 mt-2 text-xs flex justify-between">
                <span className="text-gray-400">Total owed</span>
                <span className="neg font-medium">{formatCurrency(totalLoanBalance)}</span>
              </div>
            )}
          </div>

          {/* Upcoming Charges */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3">Upcoming Charges</h3>
            {upcomingCharges.length === 0 && <p className="text-xs text-gray-500">No upcoming charges.</p>}
            {upcomingCharges.map(c => {
              const days = daysUntil(c.due_date)
              return (
                <div key={c.id} className="flex justify-between items-start mb-3 last:mb-0">
                  <div>
                    <div className="text-xs text-gray-200">{c.name}</div>
                    <div className={`text-xs mt-0.5 ${days <= 14 ? 'text-red-400' : days <= 30 ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {days === 0 ? 'Due today' : days < 0 ? `${Math.abs(days)}d overdue` : `in ${days} days`}
                    </div>
                  </div>
                  <div className="text-xs font-medium neg">{formatCurrency(c.expected_amount)}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
