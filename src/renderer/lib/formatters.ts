export function formatCurrency(amount: number, symbol = '$'): string {
  const abs = Math.abs(amount)
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function monthStart(yyyyMM: string): string {
  return `${yyyyMM}-01`
}

export function monthEnd(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-').map(Number)
  const last = new Date(year, month, 0).getDate()
  return `${yyyyMM}-${String(last).padStart(2, '0')}`
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
