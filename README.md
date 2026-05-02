# Desktop Finance App

A Vite + Electron desktop application for managing finances.

## Setup & Installation

### Prerequisites
- Node.js (v16+)
- npm or yarn

### Install Dependencies
```bash
npm install
```

## Development

### Start Dev Server
```bash
npm run dev
```

This starts:
- Vite dev server on `http://localhost:5173` (hot reload enabled)
- Electron app pointing to that dev server
- Changes to React code auto-refresh in the app

### Development Tips
- **Frontend changes**: Edit files in `src/renderer/` - they hot reload automatically
- **Main process changes**: Edit `src/main/index.ts` - you'll need to restart the app
- **Preload changes**: Edit `src/preload/index.ts` - restart the app

## Building

### Build for Production
```bash
npm run build
```

This creates:
- Compiled main process in `dist/main/`
- Optimized React bundle in `dist/renderer/`
- Production-ready Electron app

### Create Installers
```bash
npm run dist
```

Creates platform-specific installers:
- **Windows**: `.exe` installer and portable version
- **macOS**: `.dmg` and `.zip` files
- **Linux**: AppImage and `.deb` packages

## Project Structure

```
src/
├── main/              # Electron main process
│   └── index.ts      # App window creation, IPC handlers
├── preload/          # Security bridge between renderer and main
│   └── index.ts      # Exposes safe IPC API
└── renderer/         # React frontend
    ├── main.tsx      # React entry point
    ├── App.css       # Styles
    ├── index.html    # HTML entry point
    └── electron.d.ts # Type definitions for electron API

vite.config.ts                    # Vite configuration
electron.vite.config.ts          # Electron-vite configuration
electron-builder.config.ts       # Build/installer configuration
tsconfig.json                    # TypeScript configuration
```

## Architecture

### Process Communication (IPC)

**Renderer → Main (invoke)**
```typescript
const result = await window.electron.invoke('channel-name', data)
```

**Main → Renderer (send)**
```typescript
mainWindow.webContents.send('channel-name', data)
```

**Setting up handlers in main process:**
```typescript
ipcMain.handle('my-handler', async (event, arg) => {
  // Handle request, return result
  return result
})
```

**Listening in renderer:**
```typescript
window.electron.on('my-event', (event, data) => {
  // Handle data from main
})
```

## Security Best Practices

✅ **Already configured:**
- Context isolation enabled (`contextIsolation: true`)
- Preload script used for secure API exposure
- Sandbox enabled (`sandbox: true`)
- Remote module disabled (`enableRemoteModule: false`)

⚠️ **Remember:**
- Never use `eval()` or `Function()` with user input
- Validate all data passed between processes
- Don't expose dangerous Electron APIs to renderer
- Keep sensitive operations in the main process

## Performance Tips

1. **Lazy load heavy modules** in the renderer
2. **Use code splitting** in React for large apps
3. **Minimize IPC calls** - batch requests when possible
4. **Profile with DevTools** - `Ctrl+Shift+I` in dev mode

## Next Steps for Your Finance App

1. **Design the UI** - Replace the starter template in `src/renderer/`
2. **Add routing** - Install `react-router-dom` for navigation
3. **State management** - Use Redux, Zustand, or Context API
4. **Database** - Consider SQLite with `better-sqlite3` for local data
5. **Authentication** - Implement user auth if needed
6. **Charts/Graphs** - Use `recharts` or `chart.js`

## Troubleshooting

**App won't start in dev?**
- Kill any existing processes: `pkill -f electron` or `pkill -f "node.*electron-vite"`
- Clear `dist/` folder and try again

**Hot reload not working?**
- Verify Vite dev server is running on port 5173
- Check browser console for errors

**Build fails?**
- Ensure all imports are correct
- Check `dist/` folder exists and has expected files

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Vite Documentation](https://vitejs.dev)
- [electron-vite](https://electron-vite.org)
- [Electron Security Best Practices](https://www.electronjs.org/docs/tutorial/security)
