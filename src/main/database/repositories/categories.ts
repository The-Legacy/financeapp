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
  const result = db.prepare(`
    INSERT INTO categories (name, type, parent_id, color, icon)
    VALUES (@name, @type, @parent_id, @color, @icon)
  `).run(cat)
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid) as Category
}

export function updateCategory(id: number, cat: Partial<Category>): Category {
  const db = getDb()
  const fields = Object.keys(cat).filter(k => k !== 'id').map(k => `${k} = @${k}`).join(', ')
  db.prepare(`UPDATE categories SET ${fields} WHERE id = @id`).run({ ...cat, id })
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category
}

export function deleteCategory(id: number): void {
  getDb().prepare("UPDATE categories SET active = 0 WHERE id = ?").run(id)
}
