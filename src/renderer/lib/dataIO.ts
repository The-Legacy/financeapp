import Papa from 'papaparse'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { invoke } from './api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TransactionRow {
  date: string
  type: string
  description: string
  amount: number | string
  category: string
  account: string
  notes: string
}

// ── CSV Export ─────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportTransactionsCSV(transactions: any[]): void {
  const rows = transactions.map(t => ({
    date:        t.date ?? '',
    type:        t.type ?? '',
    description: t.description ?? '',
    amount:      t.amount ?? 0,
    category:    t.category_name ?? '',
    account:     t.account_name ?? '',
    notes:       t.notes ?? '',
  }))
  const csv = Papa.unparse(rows)
  const date = new Date().toISOString().slice(0, 10)
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `transactions-${date}.csv`)
}

// ── CSV Import ─────────────────────────────────────────────────────────────────

/** Opens a file dialog, reads CSV, returns parsed rows. Returns null if cancelled. */
export async function importTransactionsCSV(): Promise<TransactionRow[] | null> {
  const raw = await invoke<string | null>('data:import:csv')
  if (!raw) return null

  const result = Papa.parse<TransactionRow>(raw, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (result.errors.length) {
    console.warn('CSV parse warnings:', result.errors)
  }

  return result.data
}

// ── PDF Export ─────────────────────────────────────────────────────────────────

export function exportTransactionsPDF(transactions: any[], title = 'Transactions'): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })

  // Header bar
  doc.setFillColor(29, 78, 216)   // navy blue
  doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Finance — ' + title, 40, 26)

  doc.setTextColor(180, 180, 180)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated ${new Date().toLocaleDateString()}`, doc.internal.pageSize.width - 40, 26, { align: 'right' })

  const rows = transactions.map(t => [
    t.date ?? '',
    t.type ?? '',
    t.description ?? '',
    typeof t.amount === 'number' ? `$${t.amount.toFixed(2)}` : t.amount,
    t.category_name ?? '',
    t.account_name ?? '',
  ])

  autoTable(doc, {
    startY: 50,
    head: [['Date', 'Type', 'Description', 'Amount', 'Category', 'Account']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: {
      fillColor: [245, 158, 11],  // gold
      textColor: [15, 17, 23],
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [248, 249, 251] },
    margin: { left: 40, right: 40 },
  })

  const date = new Date().toISOString().slice(0, 10)
  doc.save(`transactions-${date}.pdf`)
}

export function exportBudgetPDF(
  month: string,
  items: any[],
  actuals: Record<string, number>
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })

  doc.setFillColor(29, 78, 216)
  doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`Budget Report — ${month}`, 40, 26)

  const rows = items.map(item => {
    const actual = actuals[item.category_id] ?? 0
    const remaining = item.amount - actual
    return [
      item.category_name ?? '',
      `$${item.amount.toFixed(2)}`,
      `$${actual.toFixed(2)}`,
      remaining >= 0 ? `$${remaining.toFixed(2)}` : `-$${Math.abs(remaining).toFixed(2)}`,
      remaining < 0 ? 'Over Budget' : 'On Track',
    ]
  })

  autoTable(doc, {
    startY: 50,
    head: [['Category', 'Budget', 'Actual', 'Remaining', 'Status']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [245, 158, 11], textColor: [15, 17, 23], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 249, 251] },
    margin: { left: 40, right: 40 },
  })

  doc.save(`budget-${month}.pdf`)
}
