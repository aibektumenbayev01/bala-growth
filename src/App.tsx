import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      <header className="max-w-4xl mx-auto flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-bold">Bala Growth Monitoring 🇰🇿</h1>
          <p className="text-slate-500 text-sm">Система мониторинга развития детей</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <PlusCircle size={20} /> Добавить ребенка
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App