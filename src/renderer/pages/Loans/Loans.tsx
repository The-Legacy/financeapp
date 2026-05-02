import React, { useEffect, useState, useCallback } from 'react'
import { invoke } from '../../lib/api'
import { formatCurrency } from '../../lib/formatters'
import type { Loan } from '../../types'

function LoanForm({ initial, onSave, onClose }: {
  initial?: Partial<Loan>
  onSave: (l: Partial<Loan>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Loan>>({
    name: '', original_principal: 0, current_balance: 0, minimum_payment: 0, status: 'active', ...initial
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Loan, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try { await onSave(form); onClose() } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg">
        <h2 className="text-lg font-semibold mb-4">{initial?.id ? 'Edit' : 'New'} Loan</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Loan Name</label>
            <input className="input" value={form.name ?? ''} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Original Principal</label>
              <input type="number" step="0.01" className="input" value={form.original_principal ?? ''} onChange={e => set('original_principal', parseFloat(e.target.value))} required />
            </div>
            <div>
              <label className="label">Current Balance</label>
              <input type="number" step="0.01" className="input" value={form.current_balance ?? ''} onChange={e => set('current_balance', parseFloat(e.target.value))} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Interest Rate %</label>
              <input type="number" step="0.01" className="input" value={form.interest_rate ?? ''} onChange={e => set('interest_rate', parseFloat(e.target.value))} />
            </div>
            <div>
              <label className="label">Min Payment</label>
              <input type="number" step="0.01" className="input" value={form.minimum_payment ?? ''} onChange={e => set('minimum_payment', parseFloat(e.target.value))} />
            </div>
            <div>
              <label className="label">Due Day</label>
              <input type="number" min="1" max="31" className="input" value={form.due_day ?? ''} onChange={e => set('due_day', parseInt(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={form.start_date ?? ''} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status ?? 'active'} onChange={e => set('status', e.target.value as any)}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="paid_off">Paid Off</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PayoffCalculator({ loan }: { loan: Loan }) {
  const [extra, setExtra] = useState(0)

  const r = (loan.interest_rate ?? 0) / 100 / 12
  const payment = (loan.minimum_payment ?? 0) + extra
  let months = 0
  let interest = 0
  if (payment > 0 && loan.current_balance > 0) {
    let bal = loan.current_balance
    while (bal > 0 && months < 600) {
      const intCharge = bal * r
      interest += intCharge
      bal = bal + intCharge - payment
      months++
      if (bal <= 0) break
    }
  }

  const payoffDate = new Date()
  payoffDate.setMonth(payoffDate.getMonth() + months)

  return (
    <div className="mt-3 p-3 bg-gray-800 rounded-lg space-y-2 text-xs">
      <div className="font-medium text-gray-300">Payoff Calculator</div>
      <div className="flex items-center gap-2">
        <label className="text-gray-400">Extra payment:</label>
        <input type="number" step="10" min="0" className="input w-24 py-1 text-xs"
          value={extra} onChange={e => setExtra(Number(e.target.value))} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-gray-300">
        <div>Monthly payment: <span className="text-white font-medium">{formatCurrency(payment)}</span></div>
        <div>Months remaining: <span className="text-white font-medium">{months}</span></div>
        <div>Total interest: <span className="neg font-medium">{formatCurrency(interest)}</span></div>
        <div>Payoff date: <span className="text-white font-medium">{months < 600 ? payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}</span></div>
      </div>
    </div>
  )
}

export default function Loans() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Loan | undefined>()
  const [showCalc, setShowCalc] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoans(await invoke<Loan[]>('loans:list'))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(l: Partial<Loan>) {
    if (editing?.id) await invoke('loans:update', editing.id, l)
    else await invoke('loans:create', l)
    await load()
  }

  async function handlePayment(loan: Loan) {
    const input = prompt(`Record payment for "${loan.name}". Current balance: ${formatCurrency(loan.current_balance)}\nEnter payment amount:`)
    if (!input) return
    const amt = parseFloat(input)
    if (isNaN(amt) || amt <= 0) return
    await invoke('loans:payment', loan.id, amt)
    await load()
  }

  const active = loans.filter(l => l.status === 'active')
  const inactive = loans.filter(l => l.status !== 'active')

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Loans</h1>
        <button className="btn-primary" onClick={() => { setEditing(undefined); setShowForm(true) }}>+ Add Loan</button>
      </div>

      {active.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Active</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map(loan => {
              const paidOff = loan.original_principal - loan.current_balance
              const pct = Math.min(100, (paidOff / loan.original_principal) * 100)
              return (
                <div key={loan.id} className="card space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{loan.name}</div>
                      {loan.interest_rate && <div className="text-xs text-gray-400">{loan.interest_rate}% APR</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold neg">{formatCurrency(loan.current_balance)}</div>
                      <div className="text-xs text-gray-500">remaining</div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{formatCurrency(paidOff)} paid</span>
                      <span>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary text-xs flex-1" onClick={() => handlePayment(loan)}>Record Payment</button>
                    <button className="btn-secondary text-xs" onClick={() => setShowCalc(showCalc === loan.id ? null : loan.id!)}>Calc</button>
                    <button className="btn-secondary text-xs" onClick={() => { setEditing(loan); setShowForm(true) }}>Edit</button>
                  </div>
                  {showCalc === loan.id && <PayoffCalculator loan={loan} />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loans.length === 0 && (
        <div className="card text-sm text-gray-500">No loans tracked yet.</div>
      )}

      {inactive.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Inactive / Paid Off</h2>
          <div className="space-y-2">
            {inactive.map(l => (
              <div key={l.id} className="card flex justify-between items-center">
                <span className="text-sm text-gray-400">{l.name}</span>
                <span className="badge-gray">{l.status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <LoanForm initial={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(undefined) }} />
      )}
    </div>
  )
}
