import { Routes, Route } from 'react-router-dom'

function Home() {
  return (
    <div className="flex items-center justify-center h-screen bg-neutral-950 text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Samhällsinformation</h1>
        <p className="text-neutral-400">Frontend är uppsatt och redo. Nyhetsflödet kommer i nästa steg.</p>
      </div>
    </div>
  )
}

function Profile() {
  return (
    <div className="flex items-center justify-center h-screen bg-neutral-950 text-white">
      <h1 className="text-3xl font-bold">Profil (kommer snart)</h1>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/profil" element={<Profile />} />
    </Routes>
  )
}
