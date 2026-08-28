import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { GroupGate } from './components/GroupGate'
import { Layout } from './components/Layout'
import { PublicHome } from './pages/PublicHome'
import { Register } from './pages/Register'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { PendingApproval } from './pages/PendingApproval'
import { NoGroups } from './pages/NoGroups'
import { Calendar } from './pages/Calendar'
import { Lists } from './pages/Lists'
import { ListDetail } from './pages/ListDetail'
import { Meals } from './pages/Meals'
import { Profile } from './pages/Profile'
import { SuperAdmin } from './pages/SuperAdmin'
import { GroupAdmin } from './pages/GroupAdmin'

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

      {/* Godkänd, men saknar familjegrupp */}
      <Route
        path="/valj-familj"
        element={
          <ProtectedRoute>
            <NoGroups />
          </ProtectedRoute>
        }
      />

      {/* Godkänd – appskal med navigering */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/kalender"
          element={
            <GroupGate>
              <Calendar />
            </GroupGate>
          }
        />
        <Route
          path="/listor"
          element={
            <GroupGate>
              <Lists />
            </GroupGate>
          }
        />
        <Route
          path="/listor/:id"
          element={
            <GroupGate>
              <ListDetail />
            </GroupGate>
          }
        />
        <Route
          path="/matsedel"
          element={
            <GroupGate>
              <Meals />
            </GroupGate>
          }
        />
        <Route path="/profil" element={<Profile />} />
        <Route
          path="/familj"
          element={
            <GroupGate admin>
              <GroupAdmin />
            </GroupGate>
          }
        />
        <Route
          path="/admin"
          element={
            <GroupGate superAdmin>
              <SuperAdmin />
            </GroupGate>
          }
        />
      </Route>

      <Route path="/hem" element={<Navigate to="/kalender" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
