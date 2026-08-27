import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useActiveGroup } from '../group/ActiveGroupProvider'
import { GroupSwitcher } from './GroupSwitcher'
import { Badge, Button, cn } from './ui'

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    isActive ? 'bg-brand-100 text-brand-800' : 'text-slate-600 hover:bg-slate-100',
  )
}

export function Layout() {
  const { profile, isSuperAdmin, signOut } = useAuth()
  const { isGroupAdmin, activeGroup } = useActiveGroup()

  return (
    <div className="min-h-dvh bg-brand-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span className="font-semibold text-brand-800">Familjeplaneraren</span>
          <GroupSwitcher />
          <nav className="flex items-center gap-1">
            <NavLink to="/hem" className={navClass}>
              Hem
            </NavLink>
            {isGroupAdmin && activeGroup && (
              <NavLink to="/familj" className={navClass}>
                Familj
              </NavLink>
            )}
            {isSuperAdmin && (
              <NavLink to="/admin" className={navClass}>
                Admin
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {isSuperAdmin && <Badge color="amber">Superadmin</Badge>}
            <span className="hidden text-sm text-slate-500 sm:inline">
              {profile?.name ?? profile?.email}
            </span>
            <Button variant="ghost" onClick={() => signOut()}>
              Logga ut
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
