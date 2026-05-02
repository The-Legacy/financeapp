import { getDb } from '../db'

export interface Category {
  id?: number
  name: string
  type: string
  parent_id?: number | null
  color?: string
  icon?: string
  active?: number
}

export function getCategories(): Category[] {
  return getDb().prepare('SELECT * FROM categories WHERE active = 1 ORDER BY type, name').all() as Category[]
}

export function createCategory(cat: Omit<Category, 'id'>): Category {
  const db = getDb()
  const params = {
    name: cat.name,
    type: cat.type,
    parent_id: cat.parent_id ?? null,
    color: cat.color ?? '#6b7280',
    icon: cat.icon ?? null,
  }
  const result = db.prepare(`
    INSERT INTO categories (name, type, parent_id, color, icon)
    VALUES (@name, @type, @parent_id, @color, @icon)
  `).run(params)
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid) as Category
}

const ALLOWED_CATEGORY_UPDATE_FIELDS = new Set(['name', 'type', 'parent_id', 'color', 'icon', 'active'])

export function updateCategory(id: number, cat: Partial<Category>): Category {
  const db = getDb()
  const fields = Object.keys(cat)
    .filter(k => ALLOWED_CATEGORY_UPDATE_FIELDS.has(k))
    .map(k => `${k} = @${k}`).join(', ')
  if (!fields) throw new Error('No valid fields to update')
  db.prepare(`UPDATE categories SET ${fields} WHERE id = @id`).run({ ...cat, id })
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category
}

export function deleteCategory(id: number): void {
  getDb().prepare("UPDATE categories SET active = 0 WHERE id = ?").run(id)
}
