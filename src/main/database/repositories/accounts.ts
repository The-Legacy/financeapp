import { getDb } from '../db'

export interface Account {
  id?: number
  name: string
  type: string
  starting_balance: number
  institution?: string
  notes?: string
  active?: number
  // Credit card specific
  credit_limit?: number | null
  apr?: number | null
  minimum_payment?: number | null
  due_day?: number | null
  statement_close_day?: number | null
  // Calculated
  current_balance?: number
}

export function getAccounts(): Account[] {
  const db = getDb()
  // Calculate current balance from starting_balance + sum of transaction effects
  return db.prepare(`
    SELECT a.*,
      a.starting_balance + COALESCE((
        SELECT SUM(CASE
          WHEN t.type IN ('income','refund','cc_payment') THEN t.amount
          WHEN t.type IN ('expense','charge_payment','loan_payment') THEN -t.amount
          WHEN t.type = 'investment_buy' THEN -t.amount
          WHEN t.type = 'investment_sell' THEN t.amount
          ELSE 0
        END)
        FROM transactions t
        WHERE t.account_id = a.id AND t.deleted = 0
      ), 0) as current_balance
    FROM accounts a
    WHERE a.active = 1
    ORDER BY a.name
  `).all() as Account[]
}

export function createAccount(acc: Omit<Account, 'id' | 'current_balance'>): Account {
  const db = getDb()
  const params = {
    name: acc.name,
    type: acc.type,
    starting_balance: acc.starting_balance,
    institution: acc.institution ?? null,
    notes: acc.notes ?? null,
    credit_limit: acc.credit_limit ?? null,
    apr: acc.apr ?? null,
    minimum_payment: acc.minimum_payment ?? null,
    due_day: acc.due_day ?? null,
    statement_close_day: acc.statement_close_day ?? null,
  }
  const result = db.prepare(`
    INSERT INTO accounts (name, type, starting_balance, institution, notes, credit_limit, apr, minimum_payment, due_day, statement_close_day)
    VALUES (@name, @type, @starting_balance, @institution, @notes, @credit_limit, @apr, @minimum_payment, @due_day, @statement_close_day)
  `).run(params)
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid) as Account
}

const ALLOWED_ACCOUNT_UPDATE_FIELDS = new Set([
  'name', 'type', 'starting_balance', 'institution', 'notes', 'active',
  'credit_limit', 'apr', 'minimum_payment', 'due_day', 'statement_close_day',
])

export function updateAccount(id: number, acc: Partial<Account>): Account {
  const db = getDb()
  const fields = Object.keys(acc)
    .filter(k => ALLOWED_ACCOUNT_UPDATE_FIELDS.has(k))
    .map(k => `${k} = @${k}`)
    .join(', ')
  if (!fields) throw new Error('No valid fields to update')
  db.prepare(`UPDATE accounts SET ${fields} WHERE id = @id`).run({ ...acc, id })
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account
}

export function deleteAccount(id: number): void {
  getDb().prepare("UPDATE accounts SET active = 0 WHERE id = ?").run(id)
}
