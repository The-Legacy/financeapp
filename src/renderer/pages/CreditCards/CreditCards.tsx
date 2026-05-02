import React, { useEffect, useState, useCallback } from 'react'
import { invoke } from '../../lib/api'
import { formatCurrency, formatDate, today } from '../../lib/formatters'
import { useConfirm } from '../../components/ConfirmDialog'
import type { Account, Transaction, Category } from '../../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function utilization(balance: number, limit: number | null | undefined): number | null {
  if (!limit || limit <= 0) return null
  // balance is negative for CC debt (e.g. -500 means you owe $500)
  const owed = Math.max(0, -balance)
  return Math.min(100, (owed / limit) * 100)
}

function utilizationColor(pct: number): string {
  if (pct >= 90) return 'var(--color-red, #ef4444)'
  if (pct >= 70) return 'var(--color-orange, #f97316)'
  if (pct >= 40) return 'var(--color-yellow, #eab308)'
  return 'var(--color-green, #22c55e)'
}

function daysUntilDue(dueDay: number | null | undefined): number | null {
  if (!dueDay) return null
  const today = new Date()
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dueDay)
  if (thisMonth <= today) {
    // due day already passed this month — next month
    const next = new Date(today.getFullYear(), today.getMonth() + 1, dueDay)
    return Math.ceil((next.getTime() - today.getTime()) / 86400000)
  }
  return Math.ceil((thisMonth.getTime() - today.getTime()) / 86400000)
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

interface PaymentModalProps {
  card: Account
  categories: Category[]
  onSave: (tx: Partial<Transaction>) => Promise<void>
  onClose: () => void
}

function PaymentModal({ card, categories, onSave, onClose }: PaymentModalProps) {
  const owed = Math.max(0, -(card.current_balance ?? 0))
  const minPmt = card.minimum_payment ?? 0

  const [amount, setAmount] = useState(minPmt > 0 ? minPmt : owed)
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        date,
        type: 'cc_payment' as any,
        description: `CC Payment — ${card.name}`,
        amount,
        account_id: card.id,
        notes: notes || undefined,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm">
        <h2 className="text-lg font-semibold mb-4">Record Payment</h2>
        <p className="text-sm t-muted mb-4">
          {card.name}{' '}
          {owed > 0 && <span>— Balance: <span className="neg font-medium">{formatCurrency(owed)}</span></span>}
          {minPmt > 0 && <span className="ml-2 text-xs">(Min: {formatCurrency(minPmt)})</span>}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="label">Amount</label>
              <input type="number" step="0.01" min="0.01" className="input" value={amount} onChange={e => setAmount(e.target.value === '' ? 0 : parseFloat(e.target.value))} required />
            </div>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. paid via bank transfer" />
          </div>
          {minPmt > 0 && (
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={() => setAmount(minPmt)}>Min {formatCurrency(minPmt)}</button>
              {owed > 0 && <button type="button" className="btn-secondary text-xs" onClick={() => setAmount(owed)}>Full {formatCurrency(owed)}</button>}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Card Panel ───────────────────────────────────────────────────────────────

interface CardPanelProps {
  card: Account
  transactions: Transaction[]
  onPayment: (card: Account) => void
  onEdit: (card: Account) => void
}

function CardPanel({ card, transactions, onPayment, onEdit }: CardPanelProps) {
  const owed = Math.max(0, -(card.current_balance ?? 0))
  const available = card.credit_limit ? Math.max(0, card.credit_limit - owed) : null
  const util = utilization(card.current_balance ?? 0, card.credit_limit)
  const dueDays = daysUntilDue(card.due_day)
  const recentTx = transactions.slice(0, 5)

  return (
    <div className="card space-y-4">
      {/* Card header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold t-text text-base">{card.name}</div>
          {card.institution && <div className="text-xs t-muted">{card.institution}</div>}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs" onClick={() => onEdit(card)}>Edit</button>
          <button className="btn-primary text-xs" onClick={() => onPayment(card)}>Record Payment</button>
        </div>
      </div>

      {/* Balance + limit row */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded p-2" style={{ background: 'var(--bg)' }}>
          <div className="text-xs t-muted mb-0.5">Current Balance</div>
          <div className="text-lg font-bold neg">{formatCurrency(owed)}</div>
        </div>
        <div className="rounded p-2" style={{ background: 'var(--bg)' }}>
          <div className="text-xs t-muted mb-0.5">Credit Limit</div>
          <div className="text-lg font-bold t-text">{card.credit_limit ? formatCurrency(card.credit_limit) : '—'}</div>
        </div>
        <div className="rounded p-2" style={{ background: 'var(--bg)' }}>
          <div className="text-xs t-muted mb-0.5">Available</div>
          <div className="text-lg font-bold pos">{available != null ? formatCurrency(available) : '—'}</div>
        </div>
      </div>

      {/* Utilization bar */}
      {util != null && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs t-muted">Utilization</span>
            <span className="text-xs font-medium" style={{ color: utilizationColor(util) }}>{util.toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${util}%`,
              background: utilizationColor(util),
            }} />
          </div>
        </div>
      )}

      {/* APR / due date / min payment row */}
      <div className="flex flex-wrap gap-4 text-sm">
        {card.apr != null && card.apr > 0 && (
          <div>
            <span className="t-muted text-xs">APR </span>
            <span className="font-medium t-text">{card.apr.toFixed(2)}%</span>
          </div>
        )}
        {card.minimum_payment != null && card.minimum_payment > 0 && (
          <div>
            <span className="t-muted text-xs">Min Payment </span>
            <span className="font-medium t-text">{formatCurrency(card.minimum_payment)}</span>
          </div>
        )}
        {card.due_day != null && (
          <div>
            <span className="t-muted text-xs">Due Day </span>
            <span className="font-medium t-text">{card.due_day}</span>
            {dueDays != null && (
              <span className={`ml-1 text-xs ${dueDays <= 5 ? 'neg' : dueDays <= 10 ? 'c-yellow' : 't-muted'}`}>
                ({dueDays}d)
              </span>
            )}
          </div>
        )}
        {card.statement_close_day != null && (
          <div>
            <span className="t-muted text-xs">Statement Closes </span>
            <span className="font-medium t-text">Day {card.statement_close_day}</span>
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div>
        <div className="text-xs font-medium t-muted uppercase tracking-wide mb-2">Recent Activity</div>
        {recentTx.length === 0 ? (
          <div className="text-xs t-muted">No transactions yet.</div>
        ) : (
          <div className="space-y-1.5">
            {recentTx.map(tx => (
              <div key={tx.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs t-muted whitespace-nowrap">{formatDate(tx.date)}</span>
                  <span className="t-text truncate">{tx.description}</span>
                </div>
                <span className={`font-mono font-medium ml-3 whitespace-nowrap ${
                  tx.type === 'cc_payment' ? 'pos' :
                  ['income','refund'].includes(tx.type) ? 'pos' : 'neg'
                }`}>
                  {tx.type === 'cc_payment' ? '+' : ['income','refund'].includes(tx.type) ? '+' : '-'}
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
        {transactions.length > 5 && (
          <div className="text-xs t-muted mt-2">{transactions.length - 5} more transactions…</div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CreditCards() {
  const [cards, setCards] = useState<Account[]>([])
  const [allTx, setAllTx] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  const [payingCard, setPayingCard] = useState<Account | null>(null)
  const [editingCard, setEditingCard] = useState<Account | null>(null)
  const { confirm, dialog: confirmDialog } = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    const [accts, cats] = await Promise.all([
      invoke<Account[]>('accounts:list'),
      invoke<Category[]>('categories:list'),
    ])
    const ccards = accts.filter(a => a.type === 'credit_card')
    setCards(ccards)
    setCategories(cats)

    // Load transactions for all CC accounts
    if (ccards.length > 0) {
      const txPromises = ccards.map(c => invoke<Transaction[]>('transactions:list', { account_id: c.id }))
      const txResults = await Promise.all(txPromises)
      const merged: Transaction[] = txResults.flat()
      merged.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : (b.id ?? 0) - (a.id ?? 0)))
      setAllTx(merged)
    } else {
      setAllTx([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const txByCard = (cardId: number) => allTx.filter(t => t.account_id === cardId)

  async function handlePayment(tx: Partial<Transaction>) {
    await invoke('transactions:create', tx)
    await load()
  }

  async function handleEditSave(updated: Partial<Account>) {
    if (editingCard?.id) {
      await invoke('accounts:update', editingCard.id, updated)
      setEditingCard(null)
      await load()
    }
  }

  const totalOwed   = cards.reduce((s, c) => s + Math.max(0, -(c.current_balance ?? 0)), 0)
  const totalLimit  = cards.reduce((s, c) => s + (c.credit_limit ?? 0), 0)
  const totalAvail  = cards.reduce((s, c) => {
    const owed = Math.max(0, -(c.current_balance ?? 0))
    return s + (c.credit_limit ? Math.max(0, c.credit_limit - owed) : 0)
  }, 0)
  const overallUtil = totalLimit > 0 ? Math.min(100, (totalOwed / totalLimit) * 100) : null

  const visibleCards = selectedCardId ? cards.filter(c => c.id === selectedCardId) : cards

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Credit Cards</h1>
        <select
          className="input w-48 text-sm"
          value={selectedCardId ?? ''}
          onChange={e => setSelectedCardId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">All Cards</option>
          {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-xs t-muted mb-1">Total Owed</div>
          <div className="text-xl font-bold neg">{formatCurrency(totalOwed)}</div>
        </div>
        <div className="card text-center">
          <div className="text-xs t-muted mb-1">Total Limit</div>
          <div className="text-xl font-bold t-text">{formatCurrency(totalLimit)}</div>
        </div>
        <div className="card text-center">
          <div className="text-xs t-muted mb-1">Available Credit</div>
          <div className="text-xl font-bold pos">{formatCurrency(totalAvail)}</div>
        </div>
        <div className="card text-center">
          <div className="text-xs t-muted mb-1">Overall Utilization</div>
          <div className="text-xl font-bold" style={{ color: overallUtil != null ? utilizationColor(overallUtil) : 'var(--text-muted)' }}>
            {overallUtil != null ? `${overallUtil.toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>

      {/* Due-soon alerts */}
      {cards.some(c => { const d = daysUntilDue(c.due_day); return d != null && d <= 7 }) && (
        <div className="card border" style={{ borderColor: 'var(--color-orange, #f97316)' }}>
          <div className="font-medium text-sm mb-1" style={{ color: 'var(--color-orange, #f97316)' }}>Payments Due Soon</div>
          <div className="space-y-1">
            {cards
              .filter(c => { const d = daysUntilDue(c.due_day); return d != null && d <= 7 })
              .sort((a, b) => (daysUntilDue(a.due_day) ?? 99) - (daysUntilDue(b.due_day) ?? 99))
              .map(c => {
                const d = daysUntilDue(c.due_day)!
                const owed = Math.max(0, -(c.current_balance ?? 0))
                return (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="t-text">{c.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="t-muted">Min: {c.minimum_payment ? formatCurrency(c.minimum_payment) : '—'}</span>
                      <span className="neg font-medium">Balance: {formatCurrency(owed)}</span>
                      <span className={`text-xs font-medium ${d === 0 ? 'neg' : 'c-orange'}`}>
                        {d === 0 ? 'Due today' : `${d}d left`}
                      </span>
                      <button className="btn-primary text-xs" onClick={() => setPayingCard(c)}>Pay Now</button>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Card panels */}
      {loading ? (
        <div className="card text-sm t-muted">Loading…</div>
      ) : cards.length === 0 ? (
        <div className="card text-sm t-muted">
          No credit card accounts found. Add an account with type "Credit Card" in the Accounts page.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleCards.map(card => (
            <CardPanel
              key={card.id}
              card={card}
              transactions={txByCard(card.id!)}
              onPayment={c => setPayingCard(c)}
              onEdit={c => setEditingCard(c)}
            />
          ))}
        </div>
      )}

      {/* Payment modal */}
      {payingCard && (
        <PaymentModal
          card={payingCard}
          categories={categories}
          onSave={handlePayment}
          onClose={() => setPayingCard(null)}
        />
      )}

      {/* Edit card modal (reuse inline form) */}
      {editingCard && (
        <EditCardModal
          card={editingCard}
          onSave={handleEditSave}
          onClose={() => setEditingCard(null)}
        />
      )}

      {confirmDialog}
    </div>
  )
}

// ─── Inline edit modal for CC-specific fields ─────────────────────────────────

interface EditCardModalProps {
  card: Account
  onSave: (a: Partial<Account>) => Promise<void>
  onClose: () => void
}

function EditCardModal({ card, onSave, onClose }: EditCardModalProps) {
  const [form, setForm] = useState<Partial<Account>>({ ...card })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Account, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try { await onSave(form); onClose() } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="card w-full max-w-md my-4">
        <h2 className="text-lg font-semibold mb-4">Edit — {card.name}</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Credit Limit</label>
              <input type="number" step="0.01" min="0" className="input" value={form.credit_limit ?? ''} onChange={e => set('credit_limit', e.target.value ? parseFloat(e.target.value) : null)} placeholder="5000" />
            </div>
            <div>
              <label className="label">APR (%)</label>
              <input type="number" step="0.01" min="0" className="input" value={form.apr ?? ''} onChange={e => set('apr', e.target.value ? parseFloat(e.target.value) : null)} placeholder="24.99" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Min Payment</label>
              <input type="number" step="0.01" min="0" className="input" value={form.minimum_payment ?? ''} onChange={e => set('minimum_payment', e.target.value ? parseFloat(e.target.value) : null)} placeholder="25" />
            </div>
            <div>
              <label className="label">Due Day</label>
              <input type="number" min="1" max="31" className="input" value={form.due_day ?? ''} onChange={e => set('due_day', e.target.value ? parseInt(e.target.value) : null)} placeholder="15" />
            </div>
            <div>
              <label className="label">Statement Closes</label>
              <input type="number" min="1" max="31" className="input" value={form.statement_close_day ?? ''} onChange={e => set('statement_close_day', e.target.value ? parseInt(e.target.value) : null)} placeholder="8" />
            </div>
          </div>
          <div>
            <label className="label">Institution</label>
            <input className="input" value={form.institution ?? ''} onChange={e => set('institution', e.target.value)} />
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
