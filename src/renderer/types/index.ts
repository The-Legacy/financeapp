export interface Transaction {
  id?: number
  date: string
  type: 'income' | 'expense' | 'cc_payment' | 'investment_buy' | 'investment_sell' | 'transfer' | 'loan_payment' | 'charge_payment' | 'refund' | 'adjustment'
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
  created_at?: string
  updated_at?: string
  // Joined
  category_name?: string
  account_name?: string
  loan_name?: string
}

export interface Category {
  id?: number
  name: string
  type: 'income' | 'expense' | 'transfer' | 'investment' | 'loan' | 'charge'
  parent_id?: number | null
  color?: string
  icon?: string
  active?: number
}

export interface Account {
  id?: number
  name: string
  type: 'checking' | 'savings' | 'cash' | 'credit_card' | 'loan' | 'brokerage' | 'other'
  starting_balance: number
  institution?: string
  notes?: string
  active?: number
  current_balance?: number
  // Credit card specific
  credit_limit?: number | null
  apr?: number | null
  minimum_payment?: number | null
  due_day?: number | null
  statement_close_day?: number | null
}

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
  status: 'active' | 'paid_off' | 'paused'
}

export interface Charge {
  id?: number
  name: string
  description?: string
  expected_amount: number
  due_date: string
  category_id?: number
  status: 'upcoming' | 'partially_paid' | 'paid' | 'canceled'
  notes?: string
  category_name?: string
}

export interface TransactionSummary {
  income: number
  expenses: number
  net: number
}

export interface MonthlyPnL {
  month: string
  income: number
  expenses: number
}

export interface SpendingByCategory {
  category: string
  color: string
  total: number
}

export interface EffectiveBudgetItem {
  category_id?: number | null
  linked_loan_id?: number | null
  category_name: string
  monthly_limit: number
}
