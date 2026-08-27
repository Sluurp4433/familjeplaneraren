import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PublicHome } from './pages/PublicHome'
import { Register } from './pages/Register'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { PendingApproval } from './pages/PendingApproval'
import { Home } from './pages/Home'

export function App() {
  return (
    <Routes>
      {/* Publika */}
      <Route path="/" element={<PublicHome />} />
      <Route path="/registrera" element={<Register />} />
      <Route path="/glomt-losenord" element={<ForgotPassword />} />
      <Route path="/aterstall-losenord" element={<ResetPassword />} />

      {/* Inloggad men ej godkänd */}
      <Route path="/vantar" element={<PendingApproval />} />

      {/* Godkänd */}
      <Route
        path="/hem"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
