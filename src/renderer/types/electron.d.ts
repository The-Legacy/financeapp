// Global API bridge (set by preload)
declare global {
  interface Window {
    api: {
      invoke: (channel: string, ...args: any[]) => Promise<{ ok: boolean; data?: any; error?: string }>
    }
  }
}

export {}
