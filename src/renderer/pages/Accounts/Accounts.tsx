import React, { useEffect, useState, useCallback } from 'react'
import { invoke } from '../../lib/api'
import { formatCurrency } from '../../lib/formatters'
import { useConfirm } from '../../components/ConfirmDialog'
import type { Account } from '../../types'

const ACCOUNT_TYPES = ['checking','savings','cash','credit_card','loan','brokerage','other']

function AccountForm({ initial, onSave, onClose }: {
  initial?: Partial<Account>
  onSave: (a: Partial<Account>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Account>>({
    name: '', type: 'checking', starting_balance: 0, ...initial
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Account, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try { await onSave(form); onClose() } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">{initial?.id ? 'Edit' : 'New'} Account</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Account Name</label>
            <input className="input" value={form.name ?? ''} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type ?? 'checking'} onChange={e => set('type', e.target.value as any)}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Starting Balance</label>
              <input type="number" step="0.01" className="input" value={form.starting_balance ?? 0} onChange={e => set('starting_balance', parseFloat(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="label">Institution (optional)</label>
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

function typeColor(type: string): string {
  const map: Record<string, string> = {
    checking: 'c-blue', savings: 'c-green', cash: 'c-yellow',
    credit_card: 'c-red', loan: 'c-orange', brokerage: 'c-purple', other: 't-muted'
  }
  return map[type] ?? 't-muted'
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Account | undefined>()
  const { confirm, dialog: confirmDialog } = useConfirm()

  const load = useCallback(async () => {
    setAccounts(await invoke<Account[]>('accounts:list'))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(a: Partial<Account>) {
    if (editing?.id) await invoke('accounts:update', editing.id, a)
    else await invoke('accounts:create', a)
    await load()
  }

  async function handleDelete(id: number) {
    if (!await confirm('Remove this account?', { danger: true, confirmLabel: 'Remove' })) return
    await invoke('accounts:delete', id)
    await load()
  }

  const totalBalance = accounts.filter(a => !['credit_card','loan'].includes(a.type)).reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const totalDebt = accounts.filter(a => ['credit_card','loan'].includes(a.type)).reduce((s, a) => s + (a.current_balance ?? 0), 0)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Accounts</h1>
        <button className="btn-primary" onClick={() => { setEditing(undefined); setShowForm(true) }}>+ Add Account</button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <div className="text-xs t-muted mb-1">Total Assets</div>
          <div className="text-2xl font-bold c-green">{formatCurrency(totalBalance)}</div>
        </div>
        <div className="card text-center">
          <div className="text-xs t-muted mb-1">Total Debt</div>
          <div className="text-2xl font-bold c-red">{formatCurrency(totalDebt)}</div>
        </div>
      </div>

      <div className="space-y-3">
        {accounts.length === 0 && <div className="card text-sm t-muted">No accounts yet.</div>}
        {accounts.map(a => (
          <div key={a.id} className="card flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium t-text">{a.name}</span>
                <span className={`text-xs font-medium ${typeColor(a.type)}`}>{a.type.replace('_', ' ')}</span>
              </div>
              {a.institution && <div className="text-xs t-muted mt-0.5">{a.institution}</div>}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className={`text-lg font-bold ${(a.current_balance ?? 0) >= 0 ? 'c-green' : 'c-red'}`}>
                  {formatCurrency(a.current_balance ?? 0)}
                </div>
                <div className="text-xs t-muted">Starting: {formatCurrency(a.starting_balance)}</div>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary text-xs" onClick={() => { setEditing(a); setShowForm(true) }}>Edit</button>
                <button className="btn-danger text-xs" onClick={() => handleDelete(a.id!)}>Del</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <AccountForm initial={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(undefined) }} />
      )}
      {confirmDialog}
    </div>
  )
}
