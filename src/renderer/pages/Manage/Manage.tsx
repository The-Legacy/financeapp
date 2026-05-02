import React, { useEffect, useState, useCallback } from 'react'
import { invoke } from '../../lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Category {
  id?: number
  name: string
  type: string
  color?: string
  icon?: string
  active?: number
}

interface Tag {
  id?: number
  name: string
  color?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CAT_TYPES = ['income', 'expense', 'financial', 'transfer', 'other']

const PRESET_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316',
  '#eab308','#22c55e','#14b8a6','#3b82f6','#06b6d4',
  '#84cc16','#a78bfa','#f43f5e','#10b981','#64748b',
]

// ─── Color Swatch ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full border-2 transition-transform ${value === c ? 'border-white scale-110' : 'border-transparent hover:scale-110'}`}
          style={{ background: c }}
        />
      ))}
      <input
        type="color"
        value={value || '#6366f1'}
        onChange={e => onChange(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
        title="Custom color"
      />
    </div>
  )
}

// ─── Category Form Modal ──────────────────────────────────────────────────────

function CategoryModal({ initial, onSave, onClose }: {
  initial?: Category
  onSave: (c: Partial<Category>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Category>>({
    name: '', type: 'expense', color: '#6366f1', icon: '', ...initial
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Category, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try { await onSave(form); onClose() } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <h2 className="text-base font-semibold mb-4">{initial?.id ? 'Edit' : 'New'} Category</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input className="input" value={form.name ?? ''} onChange={e => set('name', e.target.value)} required />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type ?? 'expense'} onChange={e => set('type', e.target.value)}>
                {CAT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Icon (emoji, optional)</label>
            <input className="input w-24 text-center text-xl" value={form.icon ?? ''} onChange={e => set('icon', e.target.value)} placeholder="🏠" />
          </div>
          <div>
            <label className="label">Color</label>
            <ColorPicker value={form.color ?? '#6366f1'} onChange={c => set('color', c)} />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Tag Form Modal ───────────────────────────────────────────────────────────

function TagModal({ initial, onSave, onClose }: {
  initial?: Tag
  onSave: (t: Partial<Tag>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Tag>>({ name: '', color: '#6366f1', ...initial })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Tag, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try { await onSave(form); onClose() } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm">
        <h2 className="text-base font-semibold mb-4">{initial?.id ? 'Edit' : 'New'} Tag</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name ?? ''} onChange={e => set('name', e.target.value)} required />
          </div>
          <div>
            <label className="label">Color</label>
            <ColorPicker value={form.color ?? '#6366f1'} onChange={c => set('color', c)} />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Categories Section ───────────────────────────────────────────────────────

function CategoriesSection() {
  const [cats, setCats] = useState<Category[]>([])
  const [modal, setModal] = useState<'new' | Category | null>(null)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    setCats(await invoke<Category[]>('categories:list'))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(c: Partial<Category>) {
    if (typeof modal === 'object' && modal !== null && (modal as Category).id) {
      await invoke('categories:update', (modal as Category).id, c)
    } else {
      await invoke('categories:create', c)
    }
    await load()
  }

  async function handleDelete(id: number) {
    if (!confirm('Remove this category? Existing transactions will keep their category assignment.')) return
    await invoke('categories:delete', id)
    await load()
  }

  const filtered = filter === 'all' ? cats : cats.filter(c => c.type === filter)

  // Group by type for display
  const byType = filtered.reduce<Record<string, Category[]>>((acc, c) => {
    acc[c.type] = acc[c.type] ?? []
    acc[c.type].push(c)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-gray-200">Categories</h2>
          <select className="input text-xs py-1 px-2 w-auto" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All types</option>
            {CAT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button className="btn-primary text-xs" onClick={() => setModal('new')}>+ Add Category</button>
      </div>

      {Object.entries(byType).length === 0 && (
        <div className="card text-sm text-gray-500">No categories found.</div>
      )}

      {Object.entries(byType).map(([type, items]) => (
        <div key={type}>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{type}</div>
          <div className="grid grid-cols-1 gap-2">
            {items.map(cat => (
              <div key={cat.id} className="card flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: cat.color ?? '#6366f1' }}
                  >
                    {cat.icon || cat.name[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-100">{cat.name}</span>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary text-xs" onClick={() => setModal(cat)}>Edit</button>
                  <button className="btn-danger text-xs" onClick={() => handleDelete(cat.id!)}>Del</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {modal !== null && (
        <CategoryModal
          initial={modal === 'new' ? undefined : (modal as Category)}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ─── Tags Section ─────────────────────────────────────────────────────────────

function TagsSection() {
  const [tags, setTags] = useState<Tag[]>([])
  const [modal, setModal] = useState<'new' | Tag | null>(null)

  const load = useCallback(async () => {
    setTags(await invoke<Tag[]>('tags:list'))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(t: Partial<Tag>) {
    if (typeof modal === 'object' && modal !== null && (modal as Tag).id) {
      await invoke('tags:update', (modal as Tag).id, t)
    } else {
      await invoke('tags:create', t)
    }
    await load()
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this tag? It will be removed from all transactions.')) return
    await invoke('tags:delete', id)
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-200">Tags</h2>
        <button className="btn-primary text-xs" onClick={() => setModal('new')}>+ Add Tag</button>
      </div>

      {tags.length === 0 && (
        <div className="card text-sm text-gray-500">No tags yet. Tags can be applied to transactions for flexible filtering.</div>
      )}

      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <div
            key={tag.id}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
            style={{ background: (tag.color ?? '#6366f1') + '33', borderColor: tag.color ?? '#6366f1', border: '1px solid' }}
          >
            <span style={{ color: tag.color ?? '#6366f1' }}>{tag.name}</span>
            <button
              className="text-gray-500 hover:text-gray-200 text-xs ml-1"
              onClick={() => setModal(tag)}
              title="Edit"
            >✎</button>
            <button
              className="text-gray-500 hover:text-red-400 text-xs"
              onClick={() => handleDelete(tag.id!)}
              title="Delete"
            >✕</button>
          </div>
        ))}
      </div>

      {modal !== null && (
        <TagModal
          initial={modal === 'new' ? undefined : (modal as Tag)}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'categories' | 'tags'

export default function Manage() {
  const [tab, setTab] = useState<Tab>('categories')

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold">Manage</h1>

      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit">
        {(['categories', 'tags'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        {tab === 'categories' && <CategoriesSection />}
        {tab === 'tags' && <TagsSection />}
      </div>
    </div>
  )
}
