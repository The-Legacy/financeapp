import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './App.css'

function App() {
  const [data, setData] = useState<string>('')

  useEffect(() => {
    // Example: Call IPC to get data from main process
    if (window.electron) {
      window.electron.invoke('get-data').then((result: any) => {
        setData(result.message)
      })
    }
  }, [])

  return (
    <div className="container">
      <h1>Desktop Finance App</h1>
      <p>Message from Electron: {data}</p>
      <p>Build features here!</p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
