import { getDb } from '../db'

export interface Tag {
  id?: number
  name: string
  color?: string
}

export function getTags(): Tag[] {
  return getDb().prepare('SELECT * FROM tags ORDER BY name').all() as Tag[]
}

export function createTag(tag: Omit<Tag, 'id'>): Tag {
  const db = getDb()
  const result = db.prepare('INSERT INTO tags (name, color) VALUES (@name, @color)').run(tag)
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid) as Tag
}

export function updateTag(id: number, tag: Partial<Tag>): Tag {
  const db = getDb()
  const fields = Object.keys(tag).filter(k => k !== 'id').map(k => `${k} = @${k}`).join(', ')
  db.prepare(`UPDATE tags SET ${fields} WHERE id = @id`).run({ ...tag, id })
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag
}

export function deleteTag(id: number): void {
  getDb().prepare('DELETE FROM tags WHERE id = ?').run(id)
}
