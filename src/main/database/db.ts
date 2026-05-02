import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initializeDatabase() first.')
  return db
}

export function initializeDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'finance.db')

  db = new Database(dbPath)

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  console.log(`Database initialized at: ${dbPath}`)
}
