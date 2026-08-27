import { iconFor } from '../lib/activityIcons'
import { cn } from './ui'

export function ActivityIcon({
  iconKey,
  className,
}: {
  iconKey: string | null | undefined
  className?: string
}) {
  const icon = iconFor(iconKey)
  if (!icon) return null
  return (
    <span role="img" aria-label={icon.label} className={cn('leading-none', className)}>
      {icon.emoji}
    </span>
  )
}
