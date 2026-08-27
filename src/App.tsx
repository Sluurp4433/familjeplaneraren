import { Navigate, Route, Routes } from 'react-router-dom'

// Skelett. Riktiga rutter (login, kalender, listor, matsedel, admin) byggs milstolpe för milstolpe.
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Scaffold />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function Scaffold() {
  return (
    <main className="grid min-h-dvh place-items-center bg-brand-50 p-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold text-brand-800">Familjeplaneraren</h1>
        <p className="text-brand-700">
          Grundställningen är på plats. Inloggning byggs i nästa steg (M0), därefter kalendern.
        </p>
        <p className="text-sm text-brand-500">
          Vite · React · TypeScript · Tailwind · Supabase
        </p>
      </div>
    </main>
  )
}
