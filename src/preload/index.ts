import { contextBridge, ipcRenderer } from 'electron'

// Allowed IPC channels (whitelist)
const CHANNELS = [
  'transactions:list', 'transactions:create', 'transactions:update', 'transactions:delete',
  'transactions:summary', 'transactions:byCategory', 'transactions:monthlyPnL',
  'categories:list', 'categories:create', 'categories:update', 'categories:delete',
  'accounts:list', 'accounts:create', 'accounts:update', 'accounts:delete',
  'budgets:profiles:list', 'budgets:profiles:create', 'budgets:profiles:update', 'budgets:profiles:delete',
  'budgets:items:list', 'budgets:items:upsert', 'budgets:items:delete',
  'budgets:month:get', 'budgets:month:set', 'budgets:month:finalize',
  'budgets:month:snapshot', 'budgets:month:effective',
  'loans:list', 'loans:create', 'loans:update', 'loans:payment',
  'charges:list', 'charges:create', 'charges:update', 'charges:paid',
  'settings:get', 'settings:set', 'settings:all',
  'tags:list', 'tags:create', 'tags:update', 'tags:delete',
  'data:import:csv', 'data:export:csv', 'data:export:pdf',
  'dev:seed',
]

const api = {
  invoke: (channel: string, ...args: any[]) => {
    if (!CHANNELS.includes(channel)) {
      throw new Error(`IPC channel not allowed: ${channel}`)
    }
    return ipcRenderer.invoke(channel, ...args)
  }
}

contextBridge.exposeInMainWorld('api', api)
