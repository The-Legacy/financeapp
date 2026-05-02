import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  const isDev = process.env.ELECTRON_VITE_DEV === '1'
  const url = isDev
    ? `http://localhost:5173`
    : `file://${join(__dirname, '../renderer/index.html')}`

  mainWindow.loadURL(url)
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (mainWindow === null) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Example IPC handler
ipcMain.handle('get-data', async () => {
  return { message: 'Data from main process' }
})
