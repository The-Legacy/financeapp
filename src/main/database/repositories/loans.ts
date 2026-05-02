import { getDb } from '../db'

export interface Loan {
  id?: number
  name: string
  original_principal: number
  current_balance: number
  interest_rate?: number
  minimum_payment: number
  due_day?: number
  start_date?: string
  expected_payoff_date?: string
  notes?: string
  status: string
}

export function getLoans(): Loan[] {
  return getDb().prepare('SELECT * FROM loans ORDER BY status, name').all() as Loan[]
}

export function getLoan(id: number): Loan | undefined {
  return getDb().prepare('SELECT * FROM loans WHERE id = ?').get(id) as Loan | undefined
}

export function createLoan(loan: Omit<Loan, 'id'>): Loan {
  const db = getDb()
  const params = {
    name: loan.name,
    original_principal: loan.original_principal,
    current_balance: loan.current_balance,
    interest_rate: loan.interest_rate ?? null,
    minimum_payment: loan.minimum_payment,
    due_day: loan.due_day ?? null,
    start_date: loan.start_date ?? null,
    expected_payoff_date: loan.expected_payoff_date ?? null,
    notes: loan.notes ?? null,
    status: loan.status,
  }
  const result = db.prepare(`
    INSERT INTO loans (name, original_principal, current_balance, interest_rate,
      minimum_payment, due_day, start_date, expected_payoff_date, notes, status)
    VALUES (@name, @original_principal, @current_balance, @interest_rate,
      @minimum_payment, @due_day, @start_date, @expected_payoff_date, @notes, @status)
  `).run(params)
  return db.prepare('SELECT * FROM loans WHERE id = ?').get(result.lastInsertRowid) as Loan
}

const ALLOWED_LOAN_UPDATE_FIELDS = new Set([
  'name', 'original_principal', 'current_balance', 'interest_rate',
  'minimum_payment', 'due_day', 'start_date', 'expected_payoff_date', 'notes', 'status',
])

export function updateLoan(id: number, loan: Partial<Loan>): Loan {
  const db = getDb()
  const fields = Object.keys(loan)
    .filter(k => ALLOWED_LOAN_UPDATE_FIELDS.has(k))
    .map(k => `${k} = @${k}`)
    .join(', ')
  if (!fields) throw new Error('No valid fields to update')
  db.prepare(`UPDATE loans SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...loan, id })
  return db.prepare('SELECT * FROM loans WHERE id = ?').get(id) as Loan
}

export function recordLoanPayment(loanId: number, amount: number): void {
  const db = getDb()
  const loan = getLoan(loanId)
  if (!loan) throw new Error(`Loan ${loanId} not found`)
  const newBalance = Math.max(0, loan.current_balance - amount)
  db.prepare("UPDATE loans SET current_balance = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newBalance, loanId)
  if (newBalance === 0) {
    db.prepare("UPDATE loans SET status = 'paid_off', updated_at = datetime('now') WHERE id = ?")
      .run(loanId)
  }
}

export interface Charge {
  id?: number
  name: string
  description?: string
  expected_amount: number
  due_date: string
  category_id?: number
  status: string
  notes?: string
}

export function getCharges(): Charge[] {
  return getDb().prepare(`
    SELECT ch.*, c.name as category_name
    FROM charges ch
    LEFT JOIN categories c ON ch.category_id = c.id
    WHERE ch.status != 'canceled'
    ORDER BY ch.due_date
  `).all() as Charge[]
}

export function createCharge(charge: Omit<Charge, 'id'>): Charge {
  const db = getDb()
  const params = {
    name: charge.name,
    description: charge.description ?? null,
    expected_amount: charge.expected_amount,
    due_date: charge.due_date,
    category_id: charge.category_id ?? null,
    status: charge.status,
    notes: charge.notes ?? null,
  }
  const result = db.prepare(`
    INSERT INTO charges (name, description, expected_amount, due_date, category_id, status, notes)
    VALUES (@name, @description, @expected_amount, @due_date, @category_id, @status, @notes)
  `).run(params)
  return db.prepare('SELECT * FROM charges WHERE id = ?').get(result.lastInsertRowid) as Charge
}

const ALLOWED_CHARGE_UPDATE_FIELDS = new Set([
  'name', 'description', 'expected_amount', 'due_date', 'category_id', 'status', 'notes',
])

export function updateCharge(id: number, charge: Partial<Charge>): Charge {
  const db = getDb()
  const fields = Object.keys(charge)
    .filter(k => ALLOWED_CHARGE_UPDATE_FIELDS.has(k))
    .map(k => `${k} = @${k}`)
    .join(', ')
  if (!fields) throw new Error('No valid fields to update')
  db.prepare(`UPDATE charges SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...charge, id })
  return db.prepare('SELECT * FROM charges WHERE id = ?').get(id) as Charge
}

export function getChargePaidAmount(chargeId: number): number {
  const row = getDb().prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM charge_payments WHERE charge_id = ?
  `).get(chargeId) as { total: number }
  return row.total
}
