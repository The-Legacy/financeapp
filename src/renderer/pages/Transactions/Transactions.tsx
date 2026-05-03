import React, { useEffect, useState, useCallback } from 'react'
import { invoke } from '../../lib/api'
import { formatCurrency, formatDate, today, toLabel } from '../../lib/formatters'
import { useConfirm } from '../../components/ConfirmDialog'
import type { Transaction, Category, Account, Loan } from '../../types'

const TX_TYPES = ['income','expense','cc_payment','transfer','loan_payment','charge_payment','refund','adjustment','investment_buy','investment_sell']

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    income: 'badge-green', expense: 'badge-red', refund: 'badge-green',
    transfer: 'badge-blue', loan_payment: 'badge-yellow', charge_payment: 'badge-yellow',
    cc_payment: 'badge-blue',
    investment_buy: 'badge-blue', investment_sell: 'badge-green', adjustment: 'badge-gray',
  }
  return <span className={map[type] ?? 'badge-gray'}>{toLabel(type)}</span>
}

interface TxFormProps {
  initial?: Partial<Transaction>
  categories: Category[]
  accounts: Account[]
  loans: Loan[]
  onSave: (tx: Partial<Transaction>) => Promise<void>
  onClose: () => void
}

type ExpenseTargetOption =
  | { value: string; label: string; kind: 'category' }
  | { value: string; label: string; kind: 'loan' }

function TxForm({ initial, categories, accounts, loans, onSave, onClose }: TxFormProps) {
  const [form, setForm] = useState<Partial<Transaction>>({
    date: today(), type: 'expense', amount: 0, description: '', ...initial
  })
  const [saving, setSaving] = useState(false)

  const expenseCategories = categories.filter(c => c.type === 'expense')
  const activeLoans = loans.filter(loan => loan.status === 'active')
  const loanTargetOptions: ExpenseTargetOption[] = activeLoans.map(loan => ({
    value: `loan:${loan.id}`,
    label: `${loan.name} (Loan)`,
    kind: 'loan' as const,
  }))
  const expenseTargetOptions: ExpenseTargetOption[] = [
    ...expenseCategories.map(category => ({
      value: `category:${category.id}`,
      label: category.name,
      kind: 'category' as const,
    })),
    ...loanTargetOptions,
  ]
  const genericCategoryOptions: ExpenseTargetOption[] = categories.map(category => ({
    value: `category:${category.id}`,
    label: category.name,
    kind: 'category' as const,
  }))

  const targetOptions = form.type === 'loan_payment'
    ? loanTargetOptions
    : form.type === 'expense'
      ? expenseTargetOptions
      : genericCategoryOptions
  const targetLabel = form.type === 'loan_payment'
    ? 'Loan'
    : form.type === 'expense'
      ? 'Expense / Loan'
      : 'Category'

  const selectedExpenseTarget = form.linked_loan_id
    ? `loan:${form.linked_loan_id}`
    : form.category_id
      ? `category:${form.category_id}`
      : ''

  const set = (key: keyof Transaction, val: any) => setForm(f => ({ ...f, [key]: val }))

  function setType(nextType: string) {
    setForm(f => {
      const next: Partial<Transaction> = { ...f, type: nextType as Transaction['type'] }
      if (nextType === 'loan_payment') {
        next.category_id = null
      } else {
        next.linked_loan_id = null
      }
      return next
    })
  }

  function setExpenseTarget(value: string) {
    if (!value) {
      setForm(f => ({ ...f, category_id: null, linked_loan_id: null }))
      return
    }

    const [kind, rawId] = value.split(':')
    const id = Number(rawId)
    setForm(f => ({
      ...f,
      type: kind === 'loan' ? 'loan_payment' : f.type === 'loan_payment' ? 'expense' : f.type,
      category_id: kind === 'category' ? id : null,
      linked_loan_id: kind === 'loan' ? id : null,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg">
        <h2 className="text-lg font-semibold mb-5">{initial?.id ? 'Edit' : 'New'} Transaction</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date ?? ''} onChange={e => set('date', e.target.value)} required />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type ?? 'expense'} onChange={e => setType(e.target.value)}>
                {TX_TYPES.map(t => <option key={t} value={t}>{toLabel(t)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input type="text" className="input" value={form.description ?? ''} onChange={e => set('description', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount</label>
              <input type="number" step="0.01" min="0" className="input" value={form.amount ?? ''} onChange={e => set('amount', e.target.value === '' ? 0 : parseFloat(e.target.value))} required />
            </div>
            <div>
              <label className="label">{targetLabel}</label>
              <select className="input" value={selectedExpenseTarget} onChange={e => setExpenseTarget(e.target.value)}>
                <option value="">— None —</option>
                {targetOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Account</label>
              <select className="input" value={form.account_id ?? ''} onChange={e => set('account_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">— None —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Payment Method</label>
              <input type="text" className="input" placeholder="Card, Cash…" value={form.payment_method ?? ''} onChange={e => set('payment_method', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Transaction | undefined>()
  const [filters, setFilters] = useState({ search: '', type: '', accountId: '', startDate: '', endDate: '' })
  const { confirm, dialog: confirmDialog } = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    const f: any = {}
    if (filters.search) f.search = filters.search
    if (filters.type) f.type = filters.type
    if (filters.accountId) f.account_id = Number(filters.accountId)
    if (filters.startDate) f.startDate = filters.startDate
    if (filters.endDate) f.endDate = filters.endDate
    const [txs, cats, accts, loanList] = await Promise.all([
      invoke<Transaction[]>('transactions:list', f),
      invoke<Category[]>('categories:list'),
      invoke<Account[]>('accounts:list'),
      invoke<Loan[]>('loans:list'),
    ])
    setTransactions(txs)
    setCategories(cats)
    setAccounts(accts)
    setLoans(loanList)
    setLoading(false)
  }, [filters])

  useEffect(() => { load() }, [load])

  async function handleSave(tx: Partial<Transaction>) {
    if (editing?.id) {
      await invoke('transactions:update', editing.id, tx)
    } else {
      await invoke('transactions:create', tx)
    }
    await load()
  }

  async function handleDelete(id: number) {
    if (!await confirm('Delete this transaction?', { danger: true, confirmLabel: 'Delete' })) return
    await invoke('transactions:delete', id)
    await load()
  }

  const totalIncome = transactions.filter(t => ['income','refund'].includes(t.type)).reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter(t => ['expense','charge_payment','loan_payment'].includes(t.type)).reduce((s, t) => s + t.amount, 0)
  const net = totalIncome - totalExpenses

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Transactions</h1>
        <button className="btn-primary" onClick={() => { setEditing(undefined); setShowForm(true) }}>+ Add Transaction</button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-xs t-muted mb-1">Income</div>
          <div className="text-lg font-semibold pos">{formatCurrency(totalIncome)}</div>
        </div>
        <div className="card text-center">
          <div className="text-xs t-muted mb-1">Expenses</div>
          <div className="text-lg font-semibold neg">{formatCurrency(totalExpenses)}</div>
        </div>
        <div className="card text-center">
          <div className="text-xs t-muted mb-1">Net</div>
          <div className={`text-lg font-semibold ${net >= 0 ? 'pos' : 'neg'}`}>{formatCurrency(net)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Search…" className="input w-44" value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        <select className="input w-40" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
          <option value="">All types</option>
          {TX_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input w-40" value={filters.accountId} onChange={e => setFilters(f => ({ ...f, accountId: e.target.value }))}>
          <option value="">All accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input type="date" className="input w-40" value={filters.startDate}
          onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
        <span className="t-muted text-sm">to</span>
        <input type="date" className="input w-40" value={filters.endDate}
          onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
        <button className="btn-secondary text-xs" onClick={() => setFilters({ search: '', type: '', accountId: '', startDate: '', endDate: '' })}>
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b t-divider text-left">
              <th className="px-4 py-3 t-muted font-medium">Date</th>
              <th className="px-4 py-3 t-muted font-medium">Description</th>
              <th className="px-4 py-3 t-muted font-medium">Type</th>
              <th className="px-4 py-3 t-muted font-medium">Category</th>
              <th className="px-4 py-3 t-muted font-medium">Account</th>
              <th className="px-4 py-3 t-muted font-medium text-right">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center t-muted">Loading…</td></tr>
            )}
            {!loading && transactions.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center t-muted">No transactions found.</td></tr>
            )}
            {transactions.map(tx => (
              <tr key={tx.id} className="border-b t-divider t-row transition-colors">
                <td className="px-4 py-3 t-muted whitespace-nowrap">{formatDate(tx.date)}</td>
                <td className="px-4 py-3 t-text max-w-xs truncate">{tx.description}</td>
                <td className="px-4 py-3"><TypeBadge type={tx.type} /></td>
                <td className="px-4 py-3 t-muted">{tx.category_name ?? '—'}</td>
                <td className="px-4 py-3 t-muted">{tx.account_name ?? '—'}</td>
                <td className={`px-4 py-3 text-right font-mono font-medium ${['income','refund','cc_payment'].includes(tx.type) ? 'pos' : ['expense','charge_payment','loan_payment'].includes(tx.type) ? 'neg' : 'neutral'}`}>
                  {formatCurrency(tx.amount)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 justify-end">
                    <button className="btn-secondary py-1 px-2 text-xs" onClick={() => { setEditing(tx); setShowForm(true) }}>Edit</button>
                    <button className="btn-danger py-1 px-2 text-xs" onClick={() => handleDelete(tx.id!)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <TxForm
          initial={editing}
          categories={categories}
          accounts={accounts}
          loans={loans}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(undefined) }}
        />
      )}
      {confirmDialog}
    </div>
  )
}
