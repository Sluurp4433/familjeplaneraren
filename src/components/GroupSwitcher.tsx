import { useActiveGroup } from '../group/ActiveGroupProvider'
import { Select } from './ui'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  medlem: 'Medlem',
  begransad: 'Begränsad',
}

export function GroupSwitcher() {
  const { groups, activeGroup, setActiveGroup } = useActiveGroup()

  if (groups.length === 0) return null

  if (groups.length === 1) {
    return (
      <span className="text-sm font-medium text-brand-800">
        {groups[0].name}
      </span>
    )
  }

  return (
    <Select
      aria-label="Välj familj"
      value={activeGroup?.id ?? ''}
      onChange={(e) => setActiveGroup(e.target.value)}
      className="max-w-[14rem]"
    >
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name} · {ROLE_LABEL[g.role] ?? g.role}
        </option>
      ))}
    </Select>
  )
}
