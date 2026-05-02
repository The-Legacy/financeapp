import React, { useEffect, useState, useCallback } from 'react'
import { invoke } from '../../lib/api'

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    const s = await invoke<Record<string, string>>('settings:all')
    setSettings(s)
  }, [])

  useEffect(() => { load() }, [load])

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

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <h1 className="text-xl font-bold">Settings</h1>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Preferences</h2>
        <div>
          <label className="label">Currency Symbol</label>
          <input className="input w-24" value={settings.currency_symbol ?? '$'} onChange={e => set('currency_symbol', e.target.value)} />
        </div>
        <div>
          <label className="label">Date Format</label>
          <select className="input w-48" value={settings.date_format ?? 'MM/DD/YYYY'} onChange={e => set('date_format', e.target.value)}>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
        <div>
          <label className="label">Theme</label>
          <select className="input w-32" value={settings.theme ?? 'dark'} onChange={e => set('theme', e.target.value)}>
            <option value="dark">Dark</option>
            <option value="light">Light (coming soon)</option>
          </select>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Data</h2>
        <div className="text-xs text-gray-400">
          Your data is stored locally in a SQLite database in your app data folder. No cloud sync, no accounts required.
        </div>
        <div className="flex gap-3">
          <button
            className="btn-secondary text-xs"
            onClick={async () => {
              if (!confirm('Load demo data? (Only adds data if no transactions exist)')) return
              await invoke('dev:seed')
              alert('Demo data loaded!')
            }}
          >
            Load Demo Data
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
        {saved && <span className="text-xs text-green-400">Saved!</span>}
      </div>
    </div>
  )
}
