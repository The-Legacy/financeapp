import type { IpcMain } from 'electron'
import {
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
  getTransactionSummary, getSpendingByCategory
} from '../database/repositories/transactions'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../database/repositories/categories'
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../database/repositories/accounts'
import {
  getBudgetProfiles, createBudgetProfile, updateBudgetProfile, deleteBudgetProfile,
  getBudgetItems, upsertBudgetItem, deleteBudgetItem,
  getMonthAssignment, setMonthAssignment, finalizeMonth, getBudgetSnapshot, getEffectiveBudgetItems
} from '../database/repositories/budgets'
import {
  getLoans, getLoan, createLoan, updateLoan, recordLoanPayment,
  getCharges, createCharge, updateCharge, getChargePaidAmount
} from '../database/repositories/loans'
import { getTags, createTag, updateTag, deleteTag } from '../database/repositories/tags'
import { getDb } from '../database/db'

function handle(ipcMain: IpcMain, channel: string, fn: (...args: any[]) => any) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, data: fn(...args) }
    } catch (err: any) {
      console.error(`IPC error [${channel}]:`, err)
      return { ok: false, error: err?.message ?? 'Unknown error' }
    }
  })
}

export function registerAllHandlers(ipcMain: IpcMain): void {
  // Transactions
  handle(ipcMain, 'transactions:list',    (filters) => getTransactions(filters))
  handle(ipcMain, 'transactions:create',  (tx) => createTransaction(tx))
  handle(ipcMain, 'transactions:update',  (id, tx) => updateTransaction(id, tx))
  handle(ipcMain, 'transactions:delete',  (id) => deleteTransaction(id))
  handle(ipcMain, 'transactions:summary', (start, end) => getTransactionSummary(start, end))
  handle(ipcMain, 'transactions:byCategory', (start, end) => getSpendingByCategory(start, end))

  // Monthly P&L (last 12 months)
  handle(ipcMain, 'transactions:monthlyPnL', () => {
    const db = getDb()
    return db.prepare(`
      SELECT strftime('%Y-%m', date) as month,
        SUM(CASE WHEN type IN ('income','refund') THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type IN ('expense','charge_payment') THEN amount ELSE 0 END) as expenses
      FROM transactions
      WHERE deleted = 0 AND date >= date('now', '-12 months')
      GROUP BY month
      ORDER BY month
    `).all()
  })

  // Categories
  handle(ipcMain, 'categories:list',   () => getCategories())
  handle(ipcMain, 'categories:create', (cat) => createCategory(cat))
  handle(ipcMain, 'categories:update', (id, cat) => updateCategory(id, cat))
  handle(ipcMain, 'categories:delete', (id) => deleteCategory(id))

  // Tags
  handle(ipcMain, 'tags:list',   () => getTags())
  handle(ipcMain, 'tags:create', (tag) => createTag(tag))
  handle(ipcMain, 'tags:update', (id, tag) => updateTag(id, tag))
  handle(ipcMain, 'tags:delete', (id) => deleteTag(id))

  // Accounts
  handle(ipcMain, 'accounts:list',   () => getAccounts())
  handle(ipcMain, 'accounts:create', (acc) => createAccount(acc))
  handle(ipcMain, 'accounts:update', (id, acc) => updateAccount(id, acc))
  handle(ipcMain, 'accounts:delete', (id) => deleteAccount(id))

  // Budget profiles
  handle(ipcMain, 'budgets:profiles:list',   () => getBudgetProfiles())
  handle(ipcMain, 'budgets:profiles:create', (p) => createBudgetProfile(p))
  handle(ipcMain, 'budgets:profiles:update', (id, p) => updateBudgetProfile(id, p))
  handle(ipcMain, 'budgets:profiles:delete', (id) => deleteBudgetProfile(id))

  // Budget items
  handle(ipcMain, 'budgets:items:list',   (profileId) => getBudgetItems(profileId))
  handle(ipcMain, 'budgets:items:upsert', (item) => upsertBudgetItem(item))
  handle(ipcMain, 'budgets:items:delete', (id) => deleteBudgetItem(id))

  // Month assignments + snapshots
  handle(ipcMain, 'budgets:month:get',       (month) => getMonthAssignment(month))
  handle(ipcMain, 'budgets:month:set',       (month, profileId) => setMonthAssignment(month, profileId))
  handle(ipcMain, 'budgets:month:finalize',  (month) => finalizeMonth(month))
  handle(ipcMain, 'budgets:month:snapshot',  (month) => getBudgetSnapshot(month))
  handle(ipcMain, 'budgets:month:effective', (month) => getEffectiveBudgetItems(month))

  // Loans
  handle(ipcMain, 'loans:list',       () => getLoans())
  handle(ipcMain, 'loans:create',     (loan) => createLoan(loan))
  handle(ipcMain, 'loans:update',     (id, loan) => updateLoan(id, loan))
  handle(ipcMain, 'loans:payment',    (loanId, amount) => recordLoanPayment(loanId, amount))

  // Charges
  handle(ipcMain, 'charges:list',     () => getCharges())
  handle(ipcMain, 'charges:create',   (c) => createCharge(c))
  handle(ipcMain, 'charges:update',   (id, c) => updateCharge(id, c))
  handle(ipcMain, 'charges:paid',     (id) => getChargePaidAmount(id))

  // Settings
  handle(ipcMain, 'settings:get', (key) => {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as any
    return row?.value
  })
  handle(ipcMain, 'settings:set', (key, value) => {
    getDb().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  })
  handle(ipcMain, 'settings:all', () => {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as Array<{key:string; value:string}>
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  })

  // Seed demo data
  handle(ipcMain, 'dev:seed', () => seedDemoData())
}

function seedDemoData(): void {
  const db = getDb()
  const already = (db.prepare('SELECT COUNT(*) as c FROM transactions').get() as any).c
  if (already > 0) return // only seed once

  // Create a checking account
  const acct = db.prepare(`INSERT INTO accounts (name, type, starting_balance) VALUES ('Checking', 'checking', 1000) RETURNING id`).get() as any
  const savings = db.prepare(`INSERT INTO accounts (name, type, starting_balance) VALUES ('Savings', 'savings', 2500) RETURNING id`).get() as any

  const paycheck_cat = (db.prepare("SELECT id FROM categories WHERE name = 'Paycheck'").get() as any)?.id
  const groceries_cat = (db.prepare("SELECT id FROM categories WHERE name = 'Groceries'").get() as any)?.id
  const rent_cat = (db.prepare("SELECT id FROM categories WHERE name = 'Rent'").get() as any)?.id
  const gas_cat = (db.prepare("SELECT id FROM categories WHERE name = 'Gas'").get() as any)?.id
  const subs_cat = (db.prepare("SELECT id FROM categories WHERE name = 'Subscriptions'").get() as any)?.id
  const tuition_cat = (db.prepare("SELECT id FROM categories WHERE name = 'Tuition'").get() as any)?.id

  const txInsert = db.prepare(`
    INSERT INTO transactions (date, type, category_id, description, amount, account_id)
    VALUES (@date, @type, @category_id, @description, @amount, @account_id)
  `)

  const insertMany = db.transaction(() => {
    // Income
    txInsert.run({ date: '2026-05-01', type: 'income', category_id: paycheck_cat, description: 'Paycheck - Week 1', amount: 850, account_id: acct.id })
    txInsert.run({ date: '2026-05-08', type: 'income', category_id: paycheck_cat, description: 'Paycheck - Week 2', amount: 850, account_id: acct.id })
    txInsert.run({ date: '2026-04-15', type: 'income', category_id: paycheck_cat, description: 'Paycheck April', amount: 1700, account_id: acct.id })
    // Expenses
    txInsert.run({ date: '2026-05-01', type: 'expense', category_id: rent_cat, description: 'May Rent', amount: 750, account_id: acct.id })
    txInsert.run({ date: '2026-05-03', type: 'expense', category_id: groceries_cat, description: 'Grocery run', amount: 62.45, account_id: acct.id })
    txInsert.run({ date: '2026-05-04', type: 'expense', category_id: gas_cat, description: 'Gas fill-up', amount: 48, account_id: acct.id })
    txInsert.run({ date: '2026-05-05', type: 'expense', category_id: subs_cat, description: 'Spotify', amount: 10.99, account_id: acct.id })
    txInsert.run({ date: '2026-05-05', type: 'expense', category_id: subs_cat, description: 'Netflix', amount: 15.49, account_id: acct.id })
    txInsert.run({ date: '2026-04-01', type: 'expense', category_id: rent_cat, description: 'April Rent', amount: 750, account_id: acct.id })
  })
  insertMany()

  // Budget profile
  const profile = db.prepare(`INSERT INTO budget_profiles (name, season_type, description) VALUES ('Summer Budget', 'summer', 'May - Aug budget') RETURNING id`).get() as any
  const schoolProfile = db.prepare(`INSERT INTO budget_profiles (name, season_type, description) VALUES ('School Year Budget', 'school_year', 'Sep - Apr budget') RETURNING id`).get() as any

  // Budget items
  const budgetInsert = db.prepare(`INSERT INTO budget_items (budget_profile_id, category_id, monthly_limit) VALUES (?, ?, ?)`)
  budgetInsert.run(profile.id, rent_cat, 800)
  budgetInsert.run(profile.id, groceries_cat, 300)
  budgetInsert.run(profile.id, gas_cat, 150)
  budgetInsert.run(profile.id, subs_cat, 50)
  budgetInsert.run(schoolProfile.id, rent_cat, 800)
  budgetInsert.run(schoolProfile.id, tuition_cat, 3000)
  budgetInsert.run(schoolProfile.id, groceries_cat, 250)

  // Assign May 2026 to Summer Budget
  db.prepare(`INSERT INTO month_budget_assignments (month, budget_profile_id) VALUES ('2026-05', ?)`)
    .run(profile.id)

  // Loan
  db.prepare(`INSERT INTO loans (name, original_principal, current_balance, interest_rate, minimum_payment, due_day, status)
    VALUES ('Car Loan', 8500, 6230, 5.9, 200, 15, 'active')`).run()

  // Upcoming charge
  db.prepare(`INSERT INTO charges (name, description, expected_amount, due_date, category_id, status)
    VALUES ('Fall 2026 Tuition', 'Tuition due before classes', 3800, '2026-08-25', ?, 'upcoming')`)
    .run(tuition_cat)

  console.log('Demo data seeded.')
}
