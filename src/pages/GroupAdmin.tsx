import { useState } from 'react'
import { useActiveGroup } from '../group/ActiveGroupProvider'
import { useAuth } from '../auth/AuthProvider'
import { useToast } from '../components/Toast'
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from '../components/ui'
import {
  useAddPerson,
  useDeletePerson,
  useGroupMembers,
  useGroupPeople,
  useRemoveMember,
  useSetMemberRole,
  useUpdateGroup,
} from '../lib/groups'
import type { GroupRole } from '../types/database.types'

const ROLES: { value: GroupRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'medlem', label: 'Medlem' },
  { value: 'begransad', label: 'Begränsad' },
]

export function GroupAdmin() {
  const { activeGroup } = useActiveGroup()
  const { user } = useAuth()
  const toast = useToast()
  const groupId = activeGroup?.id ?? null

  const { data: members, isLoading: mLoading } = useGroupMembers(groupId)
  const { data: people, isLoading: pLoading } = useGroupPeople(groupId)
  const setRole = useSetMemberRole()
  const removeMember = useRemoveMember()
  const addPerson = useAddPerson()
  const deletePerson = useDeletePerson()
  const updateGroup = useUpdateGroup()

  const [name, setName] = useState('')
  const [kind, setKind] = useState<'adult' | 'child'>('child')

  if (!activeGroup || !groupId) return <LoadingState />

  return (
    <div className="space-y-6">
      <PageHeader title={activeGroup.name} description="Hantera din familjs medlemmar och personer." />

      <Card className="p-4">
        <Field label="Familjens namn">
          <div className="flex gap-2">
            <Input
              defaultValue={activeGroup.name}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== activeGroup.name) {
                  updateGroup.mutate(
                    { id: groupId, name: e.target.value.trim() },
                    { onSuccess: () => toast.success('Sparat') },
                  )
                }
              }}
            />
          </div>
        </Field>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 font-semibold text-brand-800">Medlemmar</h3>
        {mLoading ? (
          <LoadingState />
        ) : (
          <ul className="divide-y divide-slate-100">
            {(members ?? []).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
                <div className="min-w-[10rem] flex-1">
                  <div className="text-sm font-medium text-slate-800">
                    {m.name || m.email} {m.user_id === user?.id && <span className="text-xs text-slate-400">(du)</span>}
                  </div>
                  <div className="text-xs text-slate-500">{m.email}</div>
                </div>
                <Select
                  value={m.role}
                  onChange={(e) =>
                    setRole.mutate(
                      { id: m.id, role: e.target.value as GroupRole, groupId },
                      {
                        onSuccess: () => toast.success('Roll ändrad'),
                        onError: () => toast.error('Gick inte (sista admin?)'),
                      },
                    )
                  }
                  className="w-36"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="ghost"
                  className="text-red-600"
                  onClick={() =>
                    removeMember.mutate(
                      { id: m.id, groupId },
                      {
                        onSuccess: () => toast.success('Borttagen'),
                        onError: () => toast.error('Gick inte (sista admin?)'),
                      },
                    )
                  }
                >
                  Ta bort
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Nya medlemmar läggs till av superadmin (behöver ett godkänt konto).
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 font-semibold text-brand-800">Personer</h3>
        <form
          className="mb-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            addPerson.mutate(
              { group_id: groupId, name: name.trim(), kind },
              {
                onSuccess: () => {
                  setName('')
                  toast.success('Person tillagd')
                },
                onError: () => toast.error('Kunde inte lägga till'),
              },
            )
          }}
        >
          <Input
            placeholder="Namn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Select value={kind} onChange={(e) => setKind(e.target.value as 'adult' | 'child')} className="w-28">
            <option value="child">Barn</option>
            <option value="adult">Vuxen</option>
          </Select>
          <Button type="submit">Lägg till</Button>
        </form>
        {pLoading ? (
          <LoadingState />
        ) : (
          <ul className="divide-y divide-slate-100">
            {(people ?? []).map((person) => (
              <li key={person.id} className="flex items-center gap-2 py-2">
                <span className="text-sm font-medium text-slate-800">{person.name}</span>
                <Badge color={person.kind === 'adult' ? 'blue' : 'green'}>
                  {person.kind === 'adult' ? 'Vuxen' : 'Barn'}
                </Badge>
                <Button
                  variant="ghost"
                  className="ml-auto text-red-600"
                  onClick={() => {
                    if (confirm(`Ta bort ${person.name}?`)) {
                      deletePerson.mutate(
                        { id: person.id, groupId },
                        { onSuccess: () => toast.success('Borttagen') },
                      )
                    }
                  }}
                >
                  Ta bort
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
