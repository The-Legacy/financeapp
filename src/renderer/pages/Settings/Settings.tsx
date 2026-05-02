import React, { useEffect, useState, useCallback } from 'react'
import { invoke } from '../../lib/api'
import { exportTransactionsCSV, exportTransactionsPDF, importTransactionsCSV } from '../../lib/dataIO'
import { useConfirm } from '../../components/ConfirmDialog'

function ThemeToggle({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-2">
      {['light', 'dark'].map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
            value === t
              ? 'border-transparent text-white'
              : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
          style={value === t ? { background: 'var(--primary)' } : { background: 'var(--bg-input)' }}
        >
          {t === 'light' ? 'Light' : 'Dark'}
        </button>
      ))}
    </div>
  )
}

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [seeded, setSeeded] = useState(false)
  const { confirm, dialog: confirmDialog } = useConfirm()

  const load = useCallback(async () => {
    const s = await invoke<Record<string, string>>('settings:all')
    setSettings(s)
  }, [])

  useEffect(() => { load() }, [load])

  function applyTheme(t: string) {
    if (t === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', t)
    setSettings(s => ({ ...s, theme: t }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(settings).map(([k, v]) => invoke('settings:set', k, v))
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const set = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }))

  async function handleExportCSV() {
    const txs = await invoke<any[]>('transactions:list', {})
    exportTransactionsCSV(txs)
  }

  async function handleExportPDF() {
    const txs = await invoke<any[]>('transactions:list', {})
    exportTransactionsPDF(txs, 'All Transactions')
  }

  async function handleImportCSV() {
    setImporting(true)
    setImportResult(null)
    try {
      const rows = await importTransactionsCSV()
      if (!rows) { setImportResult('Cancelled.'); return }

      let created = 0
      let skipped = 0
      for (const row of rows) {
        const amount = parseFloat(String(row.amount))
        if (!row.date || isNaN(amount)) { skipped++; continue }
        try {
          await invoke('transactions:create', {
            date:        row.date,
            type:        row.type || 'expense',
            description: row.description || '',
            amount:      Math.abs(amount),
            notes:       row.notes || '',
          })
          created++
        } catch { skipped++ }
      }
      setImportResult(`Imported ${created} transaction${created !== 1 ? 's' : ''}${skipped ? `, skipped ${skipped}` : ''}.`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Settings</h1>

      {/* ── Appearance ── */}
      <div className="card space-y-5">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Appearance</h2>
        <div>
          <label className="label">Theme</label>
          <ThemeToggle value={settings.theme ?? 'dark'} onChange={applyTheme} />
        </div>
      </div>

      {/* ── Preferences ── */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Preferences</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Currency Symbol</label>
            <input className="input w-24" value={settings.currency_symbol ?? '$'} onChange={e => set('currency_symbol', e.target.value)} />
          </div>
          <div>
            <label className="label">Date Format</label>
            <select className="input" value={settings.date_format ?? 'MM/DD/YYYY'} onChange={e => set('date_format', e.target.value)}>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Import / Export ── */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Import / Export</h2>

        <div>
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            Import transactions from a CSV file. Required columns: <code className="px-1 rounded" style={{ background: 'var(--bg-input)' }}>date, type, description, amount</code>. Optional: <code className="px-1 rounded" style={{ background: 'var(--bg-input)' }}>category, account, notes</code>
          </div>
          <button className="btn-accent text-sm" onClick={handleImportCSV} disabled={importing}>
            {importing ? 'Importing...' : 'Import CSV'}
          </button>
          {importResult && <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{importResult}</p>}
        </div>

        <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Export all transactions</div>
          <div className="flex gap-3">
            <button className="btn-secondary text-sm" onClick={handleExportCSV}>Export CSV</button>
            <button className="btn-secondary text-sm" onClick={handleExportPDF}>Export PDF</button>
          </div>
        </div>
      </div>

      {/* ── Data ── */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Data</h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          All data is stored locally in a SQLite database — no cloud sync required.
        </p>
        <button
          className="btn-secondary text-sm"
          onClick={async () => {
            if (!await confirm('Load demo data? This only runs if no transactions exist yet.', { confirmLabel: 'Load' })) return
            await invoke('dev:seed')
            setSeeded(true)
          }}
        >
          Load Demo Data
          {seeded && <span className="ml-2 text-emerald-500 text-xs">Done!</span>}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      {saved && <span className="text-xs text-emerald-500">Saved!</span>}
      </div>
      </div>
      {confirmDialog}
    </>
  )
}
