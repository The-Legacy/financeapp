import { getDb } from '../db'

export interface BudgetProfile {
  id?: number
  name: string
  description?: string
  season_type?: string
  created_at?: string
  updated_at?: string
}

export interface BudgetItem {
  id?: number
  budget_profile_id: number
  category_id?: number | null
  linked_loan_id?: number | null
  monthly_limit: number
  notes?: string
  // Joined
  category_name?: string
  category_color?: string
}

export interface MonthBudgetAssignment {
  month: string
  budget_profile_id: number
  finalized: number
  profile_name?: string
}

export interface BudgetSnapshot {
  id?: number
  month: string
  original_budget_profile_id?: number
  snapshot_name?: string
  snapshot_items_json: string
  notes?: string
  created_at?: string
}

export function getBudgetProfiles(): BudgetProfile[] {
  return getDb().prepare('SELECT * FROM budget_profiles ORDER BY name').all() as BudgetProfile[]
}

export function getBudgetProfile(id: number): BudgetProfile | undefined {
  return getDb().prepare('SELECT * FROM budget_profiles WHERE id = ?').get(id) as BudgetProfile | undefined
}

export function createBudgetProfile(profile: Omit<BudgetProfile, 'id' | 'created_at' | 'updated_at'>): BudgetProfile {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO budget_profiles (name, description, season_type) VALUES (@name, @description, @season_type)
  `).run(profile)
  return db.prepare('SELECT * FROM budget_profiles WHERE id = ?').get(result.lastInsertRowid) as BudgetProfile
}

const ALLOWED_PROFILE_UPDATE_FIELDS = new Set(['name', 'description', 'season_type'])

export function updateBudgetProfile(id: number, profile: Partial<BudgetProfile>): BudgetProfile {
  const db = getDb()
  const fields = Object.keys(profile)
    .filter(k => ALLOWED_PROFILE_UPDATE_FIELDS.has(k))
    .map(k => `${k} = @${k}`)
    .join(', ')
  if (!fields) throw new Error('No valid fields to update')
  db.prepare(`UPDATE budget_profiles SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...profile, id })
  return db.prepare('SELECT * FROM budget_profiles WHERE id = ?').get(id) as BudgetProfile
}

export function deleteBudgetProfile(id: number): void {
  getDb().prepare('DELETE FROM budget_profiles WHERE id = ?').run(id)
}

export function getBudgetItems(profileId: number): BudgetItem[] {
  return getDb().prepare(`
    SELECT bi.*,
      COALESCE(c.name, l.name) as category_name,
      COALESCE(c.color, '#f97316') as category_color
    FROM budget_items bi
    LEFT JOIN categories c ON bi.category_id = c.id
    LEFT JOIN loans l ON bi.linked_loan_id = l.id
    WHERE bi.budget_profile_id = ?
    ORDER BY COALESCE(c.name, l.name)
  `).all(profileId) as BudgetItem[]
}

export function upsertBudgetItem(item: Omit<BudgetItem, 'id' | 'category_name' | 'category_color'>): void {
  const db = getDb()
  const params = {
    budget_profile_id: item.budget_profile_id,
    category_id: item.category_id ?? null,
    linked_loan_id: item.linked_loan_id ?? null,
    monthly_limit: item.monthly_limit,
    notes: item.notes ?? null,
  }

  if (params.category_id == null && params.linked_loan_id == null) {
    throw new Error('Budget item must reference a category or loan')
  }

  if (params.category_id != null && params.linked_loan_id != null) {
    throw new Error('Budget item cannot reference both a category and loan')
  }

  if (params.category_id != null) {
    const updated = db.prepare(`
      UPDATE budget_items
      SET monthly_limit = @monthly_limit, notes = @notes
      WHERE budget_profile_id = @budget_profile_id AND category_id = @category_id
    `).run(params)
    if (updated.changes === 0) {
      db.prepare(`
        INSERT INTO budget_items (budget_profile_id, category_id, linked_loan_id, monthly_limit, notes)
        VALUES (@budget_profile_id, @category_id, NULL, @monthly_limit, @notes)
      `).run(params)
    }
    return
  }

  const updated = db.prepare(`
    UPDATE budget_items
    SET monthly_limit = @monthly_limit, notes = @notes
    WHERE budget_profile_id = @budget_profile_id AND linked_loan_id = @linked_loan_id
  `).run(params)
  if (updated.changes === 0) {
    db.prepare(`
      INSERT INTO budget_items (budget_profile_id, category_id, linked_loan_id, monthly_limit, notes)
      VALUES (@budget_profile_id, NULL, @linked_loan_id, @monthly_limit, @notes)
    `).run(params)
  }
}

export function deleteBudgetItem(id: number): void {
  getDb().prepare('DELETE FROM budget_items WHERE id = ?').run(id)
}

export function getMonthAssignment(month: string): MonthBudgetAssignment | undefined {
  return getDb().prepare(`
    SELECT mba.*, bp.name as profile_name
    FROM month_budget_assignments mba
    JOIN budget_profiles bp ON mba.budget_profile_id = bp.id
    WHERE mba.month = ?
  `).get(month) as MonthBudgetAssignment | undefined
}

export function setMonthAssignment(month: string, profileId: number): void {
  getDb().prepare(`
    INSERT INTO month_budget_assignments (month, budget_profile_id)
    VALUES (?, ?)
    ON CONFLICT(month) DO UPDATE SET budget_profile_id = excluded.budget_profile_id, updated_at = datetime('now')
  `).run(month, profileId)
}

export function finalizeMonth(month: string): void {
  const db = getDb()
  const assignment = getMonthAssignment(month)
  if (!assignment) throw new Error(`No budget assignment for month ${month}`)

  const items = getBudgetItems(assignment.budget_profile_id)
  const profile = getBudgetProfile(assignment.budget_profile_id)

  const snapshotItems = items.map(i => ({
    category_id: i.category_id,
    linked_loan_id: i.linked_loan_id,
    category_name: i.category_name,
    monthly_limit: i.monthly_limit
  }))

  db.prepare(`
    INSERT INTO month_budget_snapshots (month, original_budget_profile_id, snapshot_name, snapshot_items_json)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(month) DO UPDATE SET snapshot_items_json = excluded.snapshot_items_json
  `).run(month, assignment.budget_profile_id, profile?.name ?? 'Snapshot', JSON.stringify(snapshotItems))

  db.prepare(`
    UPDATE month_budget_assignments SET finalized = 1, updated_at = datetime('now') WHERE month = ?
  `).run(month)
}

export function getBudgetSnapshot(month: string): BudgetSnapshot | undefined {
  return getDb().prepare('SELECT * FROM month_budget_snapshots WHERE month = ?').get(month) as BudgetSnapshot | undefined
}

/**
 * Returns the effective budget items for a given month.
 * If the month is finalized, uses the frozen snapshot.
 * Otherwise uses the currently assigned profile.
 */
export function getEffectiveBudgetItems(month: string): Array<{ category_id?: number | null; linked_loan_id?: number | null; category_name: string; monthly_limit: number }> {
  const snapshot = getBudgetSnapshot(month)
  if (snapshot) {
    return JSON.parse(snapshot.snapshot_items_json)
  }
  const assignment = getMonthAssignment(month)
  if (!assignment) return []
  return getBudgetItems(assignment.budget_profile_id).map(i => ({
    category_id: i.category_id,
    linked_loan_id: i.linked_loan_id,
    category_name: i.category_name ?? '',
    monthly_limit: i.monthly_limit
  }))
}
