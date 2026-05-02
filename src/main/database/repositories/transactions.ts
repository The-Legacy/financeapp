import { getDb } from '../db'

export interface Transaction {
  id?: number
  date: string
  type: string
  category_id?: number | null
  subcategory?: string
  description: string
  amount: number
  account_id?: number | null
  payment_method?: string
  notes?: string
  linked_loan_id?: number | null
  linked_charge_id?: number | null
  linked_investment_id?: number | null
  deleted?: number
  created_at?: string
  updated_at?: string
  // Joined fields
  category_name?: string
  account_name?: string
}

export interface TransactionFilters {
  startDate?: string
  endDate?: string
  type?: string
  category_id?: number
  account_id?: number
  search?: string
  tags?: string[]
}

export function getTransactions(filters: TransactionFilters = {}): Transaction[] {
  const db = getDb()
  let sql = `
    SELECT t.*, c.name as category_name, a.name as account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.deleted = 0
  `
  const params: any[] = []

  if (filters.startDate) { sql += ' AND t.date >= ?'; params.push(filters.startDate) }
  if (filters.endDate) { sql += ' AND t.date <= ?'; params.push(filters.endDate) }
  if (filters.type) { sql += ' AND t.type = ?'; params.push(filters.type) }
  if (filters.category_id) { sql += ' AND t.category_id = ?'; params.push(filters.category_id) }
  if (filters.account_id) { sql += ' AND t.account_id = ?'; params.push(filters.account_id) }
  if (filters.search) {
    sql += ' AND (t.description LIKE ? OR t.notes LIKE ?)'
    params.push(`%${filters.search}%`, `%${filters.search}%`)
  }

  sql += ' ORDER BY t.date DESC, t.id DESC'

  return db.prepare(sql).all(...params) as Transaction[]
}

export function getTransactionById(id: number): Transaction | undefined {
  const db = getDb()
  return db.prepare(`
    SELECT t.*, c.name as category_name, a.name as account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.id = ? AND t.deleted = 0
  `).get(id) as Transaction | undefined
}

export function createTransaction(tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Transaction {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO transactions (date, type, category_id, subcategory, description, amount, account_id,
      payment_method, notes, linked_loan_id, linked_charge_id, linked_investment_id)
    VALUES (@date, @type, @category_id, @subcategory, @description, @amount, @account_id,
      @payment_method, @notes, @linked_loan_id, @linked_charge_id, @linked_investment_id)
  `).run(tx)
  return getTransactionById(result.lastInsertRowid as number)!
}

export function updateTransaction(id: number, tx: Partial<Transaction>): Transaction {
  const db = getDb()
  const fields = Object.keys(tx)
    .filter(k => !['id', 'created_at', 'updated_at', 'category_name', 'account_name'].includes(k))
    .map(k => `${k} = @${k}`)
    .join(', ')
  db.prepare(`UPDATE transactions SET ${fields}, updated_at = datetime('now') WHERE id = @id`)
    .run({ ...tx, id })
  return getTransactionById(id)!
}

export function deleteTransaction(id: number): void {
  const db = getDb()
  // Soft delete
  db.prepare("UPDATE transactions SET deleted = 1, updated_at = datetime('now') WHERE id = ?").run(id)
}

export function getTransactionSummary(startDate: string, endDate: string) {
  const db = getDb()
  const rows = db.prepare(`
    SELECT type, SUM(amount) as total
    FROM transactions
    WHERE deleted = 0 AND date >= ? AND date <= ?
    GROUP BY type
  `).all(startDate, endDate) as Array<{ type: string; total: number }>

  let income = 0, expenses = 0
  for (const row of rows) {
    if (['income', 'refund'].includes(row.type)) income += row.total
    else if (['expense', 'charge_payment'].includes(row.type)) expenses += row.total
  }
  return { income, expenses, net: income - expenses, rows }
}

export function getSpendingByCategory(startDate: string, endDate: string) {
  const db = getDb()
  return db.prepare(`
    SELECT c.name as category, c.color, SUM(t.amount) as total
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.deleted = 0 AND t.type IN ('expense','charge_payment') AND t.date >= ? AND t.date <= ?
    GROUP BY t.category_id
    ORDER BY total DESC
  `).all(startDate, endDate) as Array<{ category: string; color: string; total: number }>
}
