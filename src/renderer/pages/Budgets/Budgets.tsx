import React, { useEffect, useState, useCallback } from 'react'
import { invoke } from '../../lib/api'
import { formatCurrency, formatMonth, currentMonth, monthStart, monthEnd } from '../../lib/formatters'
import type { BudgetProfile, BudgetItem, Category, MonthBudgetAssignment, EffectiveBudgetItem, Transaction } from '../../types'

// ---- Budget Profile Form ----
function ProfileForm({ initial, onSave, onClose }: {
  initial?: Partial<BudgetProfile>
  onSave: (p: Partial<BudgetProfile>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({ name: '', description: '', season_type: 'none', ...initial })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try { await onSave(form); onClose() } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">{initial?.id ? 'Edit' : 'New'} Budget Profile</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Season Type</label>
            <select className="input" value={form.season_type} onChange={e => setForm(f => ({ ...f, season_type: e.target.value }))}>
              <option value="none">None</option>
              <option value="summer">Summer</option>
              <option value="school_year">School Year</option>
              <option value="winter">Winter</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
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

// ---- Budget Items Editor ----
function BudgetItemsEditor({ profile, categories, onClose }: {
  profile: BudgetProfile
  categories: Category[]
  onClose: () => void
}) {
  const [items, setItems] = useState<BudgetItem[]>([])
  const [adding, setAdding] = useState<{ category_id: number; monthly_limit: number }>({ category_id: 0, monthly_limit: 0 })

  useEffect(() => {
    invoke<BudgetItem[]>('budgets:items:list', profile.id).then(setItems)
  }, [profile.id])

  async function handleUpsert(item: Omit<BudgetItem, 'id' | 'category_name' | 'category_color'>) {
    await invoke('budgets:items:upsert', item)
    const updated = await invoke<BudgetItem[]>('budgets:items:list', profile.id)
    setItems(updated)
  }

  async function handleDelete(id: number) {
    await invoke('budgets:items:delete', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const expenseCategories = categories.filter(c => c.type === 'expense')

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Budget Items — {profile.name}</h2>
          <button className="btn-secondary text-xs" onClick={onClose}>Close</button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg">
              <div className="flex-1 text-sm">{item.category_name}</div>
              <input
                type="number" step="0.01" min="0"
                className="input w-28 text-right"
                defaultValue={item.monthly_limit}
                onBlur={async (e) => {
                  await handleUpsert({ budget_profile_id: profile.id!, category_id: item.category_id, monthly_limit: parseFloat(e.target.value), notes: item.notes })
                }}
              />
              <button className="btn-danger py-1 px-2 text-xs" onClick={() => handleDelete(item.id!)}>✕</button>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-800 flex gap-2 items-end">
          <div className="flex-1">
            <label className="label">Add Category</label>
            <select className="input" value={adding.category_id} onChange={e => setAdding(a => ({ ...a, category_id: Number(e.target.value) }))}>
              <option value={0}>— Select —</option>
              {expenseCategories.filter(c => !items.find(i => i.category_id === c.id)).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="label">Monthly Limit</label>
            <input type="number" step="0.01" min="0" className="input" value={adding.monthly_limit}
              onChange={e => setAdding(a => ({ ...a, monthly_limit: parseFloat(e.target.value) }))} />
          </div>
          <button className="btn-primary" onClick={async () => {
            if (!adding.category_id) return
            await handleUpsert({ budget_profile_id: profile.id!, ...adding, notes: '' })
            setAdding({ category_id: 0, monthly_limit: 0 })
          }}>Add</button>
        </div>
      </div>
    </div>
  )
}

// ---- Monthly Budget Summary ----
function MonthSummary({ month, profiles }: { month: string; profiles: BudgetProfile[] }) {
  const [assignment, setAssignment] = useState<MonthBudgetAssignment | undefined>()
  const [budgetItems, setBudgetItems] = useState<EffectiveBudgetItem[]>([])
  const [spending, setSpending] = useState<Array<{ category_id?: number; category: string; total: number }>>([])
  const [summary, setSummary] = useState<{ income: number; expenses: number; net: number } | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<number>(0)

  const load = useCallback(async () => {
    const [asgn, eff, catSpend, summ] = await Promise.all([
      invoke<MonthBudgetAssignment | undefined>('budgets:month:get', month),
      invoke<EffectiveBudgetItem[]>('budgets:month:effective', month),
      invoke<Array<{ category: string; color: string; total: number }>>('transactions:byCategory', monthStart(month), monthEnd(month)),
      invoke<{ income: number; expenses: number; net: number }>('transactions:summary', monthStart(month), monthEnd(month)),
    ])
    setAssignment(asgn ?? undefined)
    setBudgetItems(eff)
    setSpending(catSpend)
    setSummary(summ)
    if (asgn) setSelectedProfile(asgn.budget_profile_id)
  }, [month])

  useEffect(() => { load() }, [load])

  async function assignProfile() {
    if (!selectedProfile) return
    await invoke('budgets:month:set', month, selectedProfile)
    await load()
    setAssigning(false)
  }

  async function finalizeMonth() {
    if (!confirm(`Finalize ${formatMonth(month)}? This will freeze the budget snapshot and cannot be undone.`)) return
    await invoke('budgets:month:finalize', month)
    await load()
  }

  const spendByCategory = new Map(spending.map(s => [s.category, s.total]))

  const totalBudgeted = budgetItems.reduce((s, i) => s + i.monthly_limit, 0)
  const totalSpent = spending.reduce((s, c) => s + c.total, 0)
  const overBudget = budgetItems.filter(i => (spendByCategory.get(i.category_name) ?? 0) > i.monthly_limit)

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-100">{formatMonth(month)}</div>
          {assignment ? (
            <div className="text-xs text-gray-400 mt-0.5">
              Profile: <span className="text-indigo-400">{assignment.profile_name}</span>
              {assignment.finalized === 1 && <span className="badge-blue ml-2">Frozen</span>}
            </div>
          ) : (
            <div className="text-xs text-gray-500">No budget assigned</div>
          )}
        </div>
        <div className="flex gap-2">
          {assignment && !assignment.finalized && (
            <button className="btn-secondary text-xs" onClick={finalizeMonth}>Finalize Month</button>
          )}
          <button className="btn-secondary text-xs" onClick={() => setAssigning(true)}>
            {assignment ? 'Change' : 'Assign'} Profile
          </button>
        </div>
      </div>

      {assigning && (
        <div className="flex gap-2 items-center p-3 bg-gray-800 rounded-lg">
          <select className="input flex-1" value={selectedProfile} onChange={e => setSelectedProfile(Number(e.target.value))}>
            <option value={0}>— Select profile —</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn-primary text-xs" onClick={assignProfile}>Save</button>
          <button className="btn-secondary text-xs" onClick={() => setAssigning(false)}>Cancel</button>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400">Income</div>
            <div className="text-sm font-semibold pos">{formatCurrency(summary.income)}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400">Spent</div>
            <div className="text-sm font-semibold neg">{formatCurrency(summary.expenses)}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400">Net</div>
            <div className={`text-sm font-semibold ${summary.net >= 0 ? 'pos' : 'neg'}`}>{formatCurrency(summary.net)}</div>
          </div>
        </div>
      )}

      {budgetItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Budget vs Actual</span>
            <span>{formatCurrency(totalBudgeted)} budgeted · {formatCurrency(totalSpent)} spent</span>
          </div>
          {budgetItems.map(item => {
            const spent = spendByCategory.get(item.category_name) ?? 0
            const pct = item.monthly_limit > 0 ? Math.min(100, (spent / item.monthly_limit) * 100) : 0
            const over = spent > item.monthly_limit
            return (
              <div key={item.category_id}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className={over ? 'text-red-400 font-medium' : 'text-gray-300'}>{item.category_name}</span>
                  <span className={over ? 'neg' : 'text-gray-400'}>
                    {formatCurrency(spent)} / {formatCurrency(item.monthly_limit)}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-indigo-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
          {overBudget.length > 0 && (
            <div className="text-xs text-red-400 pt-1">
              ⚠ Over budget: {overBudget.map(i => i.category_name).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Budgets() {
  const [profiles, setProfiles] = useState<BudgetProfile[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [editingProfile, setEditingProfile] = useState<BudgetProfile | undefined>()
  const [editingItems, setEditingItems] = useState<BudgetProfile | undefined>()

  const months = [0, 1, 2].map(offset => {
    const d = new Date()
    d.setMonth(d.getMonth() - offset)
    return d.toISOString().slice(0, 7)
  })

  const load = useCallback(async () => {
    const [profs, cats] = await Promise.all([
      invoke<BudgetProfile[]>('budgets:profiles:list'),
      invoke<Category[]>('categories:list'),
    ])
    setProfiles(profs)
    setCategories(cats)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSaveProfile(p: Partial<BudgetProfile>) {
    if (editingProfile?.id) await invoke('budgets:profiles:update', editingProfile.id, p)
    else await invoke('budgets:profiles:create', p)
    await load()
  }

  async function handleDeleteProfile(id: number) {
    if (!confirm('Delete this budget profile?')) return
    await invoke('budgets:profiles:delete', id)
    await load()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Budgets</h1>
        <button className="btn-primary" onClick={() => { setEditingProfile(undefined); setShowProfileForm(true) }}>+ New Profile</button>
      </div>

      {/* Budget Profiles */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Budget Profiles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {profiles.map(p => (
            <div key={p.id} className="card flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-100">{p.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{p.season_type !== 'none' ? p.season_type : 'Custom'}</div>
                {p.description && <div className="text-xs text-gray-500 mt-0.5">{p.description}</div>}
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary text-xs" onClick={() => setEditingItems(p)}>Edit Items</button>
                <button className="btn-secondary text-xs" onClick={() => { setEditingProfile(p); setShowProfileForm(true) }}>Edit</button>
                <button className="btn-danger text-xs" onClick={() => handleDeleteProfile(p.id!)}>Del</button>
              </div>
            </div>
          ))}
          {profiles.length === 0 && (
            <div className="card text-sm text-gray-500">No budget profiles yet. Create one to get started.</div>
          )}
        </div>
      </div>

      {/* Monthly Summaries */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Monthly Budget Summaries</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {months.map(m => <MonthSummary key={m} month={m} profiles={profiles} />)}
        </div>
      </div>

      {showProfileForm && (
        <ProfileForm
          initial={editingProfile}
          onSave={handleSaveProfile}
          onClose={() => { setShowProfileForm(false); setEditingProfile(undefined) }}
        />
      )}

      {editingItems && (
        <BudgetItemsEditor
          profile={editingItems}
          categories={categories}
          onClose={() => setEditingItems(undefined)}
        />
      )}
    </div>
  )
}
