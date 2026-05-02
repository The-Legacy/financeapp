import React, { useEffect, useState, useCallback } from 'react'
import { invoke } from '../../lib/api'
import { formatCurrency, formatDate, daysUntil } from '../../lib/formatters'
import type { Charge, Category } from '../../types'

function ChargeForm({ initial, categories, onSave, onClose }: {
  initial?: Partial<Charge>
  categories: Category[]
  onSave: (c: Partial<Charge>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Charge>>({
    name: '', expected_amount: 0, due_date: '', status: 'upcoming', ...initial
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Charge, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try { await onSave(form); onClose() } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg">
        <h2 className="text-lg font-semibold mb-4">{initial?.id ? 'Edit' : 'New'} Charge</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name ?? ''} onChange={e => set('name', e.target.value)} required />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description ?? ''} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Expected Amount</label>
              <input type="number" step="0.01" className="input" value={form.expected_amount ?? ''} onChange={e => set('expected_amount', parseFloat(e.target.value))} required />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input" value={form.due_date ?? ''} onChange={e => set('due_date', e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category_id ?? ''} onChange={e => set('category_id', e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">— None —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status ?? 'upcoming'} onChange={e => set('status', e.target.value as any)}>
                <option value="upcoming">Upcoming</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
                <option value="canceled">Canceled</option>
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    upcoming: 'badge-blue',
    partially_paid: 'badge-yellow',
    paid: 'badge-green',
    canceled: 'badge-gray',
  }
  return <span className={map[status] ?? 'badge-gray'}>{status.replace('_', ' ')}</span>
}

export default function Charges() {
  const [charges, setCharges] = useState<Charge[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Charge | undefined>()

  const load = useCallback(async () => {
    const [ch, cats] = await Promise.all([
      invoke<Charge[]>('charges:list'),
      invoke<Category[]>('categories:list'),
    ])
    setCharges(ch)
    setCategories(cats)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(c: Partial<Charge>) {
    if (editing?.id) await invoke('charges:update', editing.id, c)
    else await invoke('charges:create', c)
    await load()
  }

  const upcoming = charges.filter(c => ['upcoming','partially_paid'].includes(c.status))
  const past = charges.filter(c => ['paid','canceled'].includes(c.status))

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Charges & Deadlines</h1>
        <button className="btn-primary" onClick={() => { setEditing(undefined); setShowForm(true) }}>+ Add Charge</button>
      </div>

      <div className="space-y-3">
        {upcoming.length === 0 && <div className="card text-sm text-gray-500">No upcoming charges.</div>}
        {upcoming.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()).map(c => {
          const days = daysUntil(c.due_date)
          return (
            <div key={c.id} className="card flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-100">{c.name}</span>
                  <StatusBadge status={c.status} />
                </div>
                {c.description && <div className="text-xs text-gray-400 mt-0.5">{c.description}</div>}
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  <span className="text-gray-400">Due: {formatDate(c.due_date)}</span>
                  <span className={days <= 14 ? 'text-red-400 font-medium' : days <= 30 ? 'text-yellow-400' : 'text-gray-500'}>
                    {days === 0 ? 'Today' : days < 0 ? `${Math.abs(days)}d overdue` : `${days} days left`}
                  </span>
                  {c.category_name && <span className="text-gray-500">{c.category_name}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold neg">{formatCurrency(c.expected_amount)}</div>
                <button className="btn-secondary text-xs mt-2" onClick={() => { setEditing(c); setShowForm(true) }}>Edit</button>
              </div>
            </div>
          )
        })}
      </div>

      {past.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Completed / Canceled</h2>
          <div className="space-y-2">
            {past.map(c => (
              <div key={c.id} className="card flex justify-between items-center opacity-60">
                <span className="text-sm text-gray-300">{c.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">{formatCurrency(c.expected_amount)}</span>
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <ChargeForm initial={editing} categories={categories} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(undefined) }} />
      )}
    </div>
  )
}
