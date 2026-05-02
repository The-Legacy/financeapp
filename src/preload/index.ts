import { contextBridge, ipcRenderer } from 'electron'

// Expose a secure API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  on: (channel: string, listener: (event: any, ...args: any[]) => void) =>
    ipcRenderer.on(channel, listener),
  off: (channel: string, listener: (event: any, ...args: any[]) => void) =>
    ipcRenderer.off(channel, listener)
})
