import type { ReactNode } from 'react'
import { Card } from './ui'

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-brand-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-brand-800">Familjeplaneraren</h1>
        </div>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-brand-800">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-4">{children}</div>
        </Card>
        {footer && <div className="mt-4 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </main>
  )
}
