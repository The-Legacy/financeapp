import Database from 'better-sqlite3'

export function runMigrations(db: Database.Database): void {
  db.exec(`
    -- Settings
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      type       TEXT NOT NULL CHECK(type IN ('income','expense','transfer','investment','loan','charge')),
      parent_id  INTEGER REFERENCES categories(id),
      color      TEXT DEFAULT '#6b7280',
      icon       TEXT,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Accounts
    CREATE TABLE IF NOT EXISTS accounts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      type            TEXT NOT NULL CHECK(type IN ('checking','savings','cash','credit_card','loan','brokerage','other')),
      starting_balance REAL NOT NULL DEFAULT 0,
      institution     TEXT,
      notes           TEXT,
      active          INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Tags
    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    -- Transactions
    CREATE TABLE IF NOT EXISTS transactions (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      date                 TEXT NOT NULL,
      type                 TEXT NOT NULL CHECK(type IN ('income','expense','investment_buy','investment_sell','transfer','loan_payment','charge_payment','refund','adjustment')),
      category_id          INTEGER REFERENCES categories(id),
      subcategory          TEXT,
      description          TEXT NOT NULL,
      amount               REAL NOT NULL,
      account_id           INTEGER REFERENCES accounts(id),
      payment_method       TEXT,
      notes                TEXT,
      linked_loan_id       INTEGER,
      linked_charge_id     INTEGER,
      linked_investment_id INTEGER,
      deleted              INTEGER NOT NULL DEFAULT 0,
      created_at           TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Transaction Tags (many-to-many)
    CREATE TABLE IF NOT EXISTS transaction_tags (
      transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      tag_id         INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (transaction_id, tag_id)
    );

    -- Budget Profiles
    CREATE TABLE IF NOT EXISTS budget_profiles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      season_type TEXT DEFAULT 'none' CHECK(season_type IN ('summer','school_year','winter','custom','none')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Budget Items (per-category limits within a profile)
    CREATE TABLE IF NOT EXISTS budget_items (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_profile_id INTEGER NOT NULL REFERENCES budget_profiles(id) ON DELETE CASCADE,
      category_id       INTEGER NOT NULL REFERENCES categories(id),
      monthly_limit     REAL NOT NULL DEFAULT 0,
      notes             TEXT,
      UNIQUE(budget_profile_id, category_id)
    );

    -- Month Budget Assignments (which profile applies to each YYYY-MM)
    CREATE TABLE IF NOT EXISTS month_budget_assignments (
      month             TEXT PRIMARY KEY, -- 'YYYY-MM'
      budget_profile_id INTEGER NOT NULL REFERENCES budget_profiles(id),
      finalized         INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Budget Snapshots (frozen copy when a month is finalized)
    CREATE TABLE IF NOT EXISTS month_budget_snapshots (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      month                    TEXT NOT NULL UNIQUE, -- 'YYYY-MM'
      original_budget_profile_id INTEGER REFERENCES budget_profiles(id),
      snapshot_name            TEXT,
      snapshot_items_json      TEXT NOT NULL, -- JSON array of {category_id, category_name, monthly_limit}
      notes                    TEXT,
      created_at               TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Seasons
    CREATE TABLE IF NOT EXISTS seasons (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      name               TEXT NOT NULL,
      default_profile_id INTEGER REFERENCES budget_profiles(id),
      created_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Season Months (which calendar months belong to a season)
    CREATE TABLE IF NOT EXISTS season_months (
      season_id    INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
      month_number INTEGER NOT NULL CHECK(month_number BETWEEN 1 AND 12),
      PRIMARY KEY (season_id, month_number)
    );

    -- Loans
    CREATE TABLE IF NOT EXISTS loans (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      name                  TEXT NOT NULL,
      original_principal    REAL NOT NULL,
      current_balance       REAL NOT NULL,
      interest_rate         REAL,
      minimum_payment       REAL NOT NULL DEFAULT 0,
      due_day               INTEGER,
      start_date            TEXT,
      expected_payoff_date  TEXT,
      notes                 TEXT,
      status                TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paid_off','paused')),
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Charges / Deadlines
    CREATE TABLE IF NOT EXISTS charges (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      description     TEXT,
      expected_amount REAL NOT NULL,
      due_date        TEXT NOT NULL,
      category_id     INTEGER REFERENCES categories(id),
      status          TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming','partially_paid','paid','canceled')),
      notes           TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Charge Payments (link transactions to a charge)
    CREATE TABLE IF NOT EXISTS charge_payments (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      charge_id      INTEGER NOT NULL REFERENCES charges(id) ON DELETE CASCADE,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id),
      amount         REAL NOT NULL,
      notes          TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Investment Accounts
    CREATE TABLE IF NOT EXISTS investment_accounts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'brokerage' CHECK(account_type IN ('brokerage','retirement','crypto','other')),
      notes        TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Investment Holdings
    CREATE TABLE IF NOT EXISTS investment_holdings (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id        INTEGER NOT NULL REFERENCES investment_accounts(id) ON DELETE CASCADE,
      symbol            TEXT NOT NULL,
      name              TEXT,
      asset_type        TEXT NOT NULL DEFAULT 'stock' CHECK(asset_type IN ('stock','ETF','mutual_fund','crypto','other')),
      quantity          REAL NOT NULL DEFAULT 0,
      avg_cost_basis    REAL NOT NULL DEFAULT 0,
      current_price     REAL NOT NULL DEFAULT 0,
      notes             TEXT,
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Investment Transactions
    CREATE TABLE IF NOT EXISTS investment_transactions (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      date                  TEXT NOT NULL,
      type                  TEXT NOT NULL CHECK(type IN ('buy','sell','dividend','contribution','withdrawal','price_update')),
      account_id            INTEGER NOT NULL REFERENCES investment_accounts(id),
      symbol                TEXT NOT NULL,
      quantity              REAL,
      price                 REAL,
      fees                  REAL DEFAULT 0,
      linked_transaction_id INTEGER REFERENCES transactions(id),
      notes                 TEXT,
      created_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Recurring Transactions
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      name                 TEXT NOT NULL,
      type                 TEXT NOT NULL,
      category_id          INTEGER REFERENCES categories(id),
      amount               REAL NOT NULL,
      account_id           INTEGER REFERENCES accounts(id),
      frequency            TEXT NOT NULL CHECK(frequency IN ('daily','weekly','biweekly','monthly','yearly')),
      start_date           TEXT NOT NULL,
      end_date             TEXT,
      next_expected_date   TEXT,
      auto_create          INTEGER NOT NULL DEFAULT 0,
      notes                TEXT,
      active               INTEGER NOT NULL DEFAULT 1,
      created_at           TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Net Worth Snapshots
    CREATE TABLE IF NOT EXISTS net_worth_snapshots (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      date             TEXT NOT NULL,
      assets_total     REAL NOT NULL,
      liabilities_total REAL NOT NULL,
      net_worth        REAL NOT NULL,
      notes            TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_transactions_date        ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_type        ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_account_id  ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_deleted     ON transactions(deleted);
  `)

  // Seed default categories if none exist
  const count = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as any).c
  if (count === 0) {
    seedDefaultCategories(db)
  }

  // Seed default seasons if none exist
  const seasonCount = (db.prepare('SELECT COUNT(*) as c FROM seasons').get() as any).c
  if (seasonCount === 0) {
    seedDefaultSeasons(db)
  }

  // Seed default settings if none exist
  const settingsCount = (db.prepare('SELECT COUNT(*) as c FROM settings').get() as any).c
  if (settingsCount === 0) {
    seedDefaultSettings(db)
  }
}

function seedDefaultCategories(db: Database.Database): void {
  const insert = db.prepare(
    'INSERT INTO categories (name, type, color) VALUES (?, ?, ?)'
  )
  const insertMany = db.transaction((cats: Array<[string, string, string]>) => {
    for (const [name, type, color] of cats) {
      insert.run(name, type, color)
    }
  })

  insertMany([
    // Income
    ['Paycheck', 'income', '#22c55e'],
    ['Freelance', 'income', '#16a34a'],
    ['Business Income', 'income', '#15803d'],
    ['Scholarship', 'income', '#4ade80'],
    ['Gift', 'income', '#86efac'],
    ['Refund', 'income', '#bbf7d0'],
    ['Other Income', 'income', '#dcfce7'],
    // Expenses
    ['Rent', 'expense', '#ef4444'],
    ['Utilities', 'expense', '#f97316'],
    ['Groceries', 'expense', '#f59e0b'],
    ['Eating Out', 'expense', '#eab308'],
    ['Gas', 'expense', '#84cc16'],
    ['Car Maintenance', 'expense', '#22d3ee'],
    ['Insurance', 'expense', '#3b82f6'],
    ['Tuition', 'expense', '#6366f1'],
    ['Books/School', 'expense', '#8b5cf6'],
    ['Subscriptions', 'expense', '#a855f7'],
    ['Entertainment', 'expense', '#ec4899'],
    ['Shopping', 'expense', '#f43f5e'],
    ['Medical', 'expense', '#14b8a6'],
    ['Travel', 'expense', '#06b6d4'],
    ['Miscellaneous', 'expense', '#6b7280'],
    // Financial
    ['Savings', 'transfer', '#0ea5e9'],
    ['Investments', 'investment', '#8b5cf6'],
    ['Loan Payment', 'loan', '#f97316'],
    ['Charge Payment', 'charge', '#ef4444'],
    ['Transfer', 'transfer', '#94a3b8'],
  ])
}

function seedDefaultSeasons(db: Database.Database): void {
  const insertSeason = db.prepare('INSERT INTO seasons (name) VALUES (?)')
  const insertMonth = db.prepare('INSERT INTO season_months (season_id, month_number) VALUES (?, ?)')

  const summer = insertSeason.run('Summer')
  for (const m of [5, 6, 7, 8]) insertMonth.run(summer.lastInsertRowid, m)

  const schoolYear = insertSeason.run('School Year')
  for (const m of [9, 10, 11, 12, 1, 2, 3, 4]) insertMonth.run(schoolYear.lastInsertRowid, m)
}

function seedDefaultSettings(db: Database.Database): void {
  const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
  insert.run('currency_symbol', '$')
  insert.run('date_format', 'MM/DD/YYYY')
  insert.run('theme', 'dark')
}
