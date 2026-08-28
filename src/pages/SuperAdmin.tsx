import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
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
  cn,
} from '../components/ui'
import {
  useAddMember,
  useAddPerson,
  useAllProfiles,
  useCreateGroup,
  useDeleteGroup,
  useDeletePerson,
  useGroupMembers,
  useGroupPeople,
  useGroups,
  useRemoveMember,
  useSetApproved,
  useSetMemberRole,
  useUpdateGroup,
} from '../lib/groups'
import type { GroupRole } from '../types/database.types'

const TABS = ['Väntande', 'Familjer', 'Medlemskap', 'Personer', 'Nya konton', 'Loggar'] as const
type Tab = (typeof TABS)[number]

const ROLES: { value: GroupRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'medlem', label: 'Medlem' },
  { value: 'begransad', label: 'Begränsad' },
]

export function SuperAdmin() {
  const [tab, setTab] = useState<Tab>('Väntande')

  return (
    <div>
      <PageHeader title="Administration" description="Godkänn konton, skapa familjer, tilldela roller." />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
              tab === t
                ? 'border-brand-600 text-brand-800'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Väntande' && <PendingTab />}
      {tab === 'Familjer' && <GroupsTab />}
      {tab === 'Medlemskap' && <MembersTab />}
      {tab === 'Personer' && <PeopleTab />}
      {tab === 'Nya konton' && <NewUserTab />}
      {tab === 'Loggar' && <LogsTab />}
    </div>
  )
}

/* ---------- Nya konton ---------- */
function NewUserTab() {
  const { data: groups } = useGroups()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState('')
  const [role, setRole] = useState<GroupRole>('medlem')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setResult(null)
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { email: email.trim(), name: name.trim(), groupId: groupId || null, role },
    })
    setBusy(false)
    if (error || data?.error) {
      toast.error(data?.error ?? 'Kunde inte skapa kontot')
      return
    }
    setResult({ email: data.email, tempPassword: data.tempPassword })
    setEmail('')
    setName('')
  }

  return (
    <Card className="p-4">
      <h3 className="mb-3 font-semibold text-brand-800">Skapa konto med tillfälligt lösenord</h3>
      <form className="space-y-3" onSubmit={submit}>
        <Field label="E-post">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Namn">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Field label="Lägg i familj (valfritt)">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">–</option>
              {(groups ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          {groupId && (
            <Field label="Roll">
              <Select value={role} onChange={(e) => setRole(e.target.value as GroupRole)}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <Button type="submit" loading={busy}>
          Skapa konto
        </Button>
      </form>

      {result && (
        <div className="mt-4 rounded-lg border border-accent-200 bg-accent-50 p-3 text-sm">
          <p className="font-medium text-accent-800">Konto skapat</p>
          <p className="mt-1 text-slate-700">
            {result.email}
            <br />
            Tillfälligt lösenord: <code className="rounded bg-white px-1">{result.tempPassword}</code>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Visas bara nu – kopiera och skicka till personen. De byter det under Min profil.
          </p>
        </div>
      )}
    </Card>
  )
}

/* ---------- Loggar ---------- */
function LogsTab() {
  const audit = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, created_at, action, table_name, user_id')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })
  const reminders = useQuery({
    queryKey: ['admin', 'reminder-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminder_log')
        .select('id, fire_at, status, attempts, sent_at, error')
        .order('fire_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="mb-3 font-semibold text-brand-800">Påminnelser (senaste 50)</h3>
        {reminders.isLoading ? (
          <LoadingState />
        ) : (reminders.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">Inga påminnelser skickade än.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-1 pr-3">Tid</th>
                  <th className="py-1 pr-3">Status</th>
                  <th className="py-1 pr-3">Försök</th>
                  <th className="py-1">Fel</th>
                </tr>
              </thead>
              <tbody>
                {(reminders.data ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-1 pr-3 text-slate-600">
                      {new Date(r.fire_at).toLocaleString('sv-SE')}
                    </td>
                    <td className="py-1 pr-3">
                      <Badge color={r.status === 'sent' ? 'green' : r.status === 'failed' ? 'red' : 'slate'}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-1 pr-3">{r.attempts}</td>
                    <td className="py-1 text-red-600">{r.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 font-semibold text-brand-800">Aktivitetslogg (senaste 50)</h3>
        {audit.isLoading ? (
          <LoadingState />
        ) : (
          <ul className="divide-y divide-slate-100 text-xs">
            {(audit.data ?? []).map((a) => (
              <li key={a.id} className="flex gap-3 py-1.5">
                <span className="w-36 shrink-0 text-slate-400">
                  {new Date(a.created_at).toLocaleString('sv-SE')}
                </span>
                <span className="text-slate-700">
                  {a.action} {a.table_name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

/* ---------- Väntande godkännanden ---------- */
function PendingTab() {
  const { data: profiles, isLoading } = useAllProfiles()
  const setApproved = useSetApproved()
  const toast = useToast()

  if (isLoading) return <LoadingState />
  const pending = (profiles ?? []).filter((p) => !p.approved && !p.is_super_admin)
  const approved = (profiles ?? []).filter((p) => p.approved || p.is_super_admin)

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="mb-3 font-semibold text-brand-800">
          Väntar på godkännande ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">Inga väntande konton.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <div className="text-sm font-medium text-slate-800">{p.name || '(namn saknas)'}</div>
                  <div className="text-xs text-slate-500">{p.email}</div>
                </div>
                <Button
                  onClick={() =>
                    setApproved.mutate(
                      { id: p.id, approved: true },
                      { onSuccess: () => toast.success('Godkänd') },
                    )
                  }
                >
                  Godkänn
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 font-semibold text-brand-800">Godkända ({approved.length})</h3>
        <ul className="divide-y divide-slate-100">
          {approved.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <div className="text-sm font-medium text-slate-800">
                  {p.name || p.email}{' '}
                  {p.is_super_admin && <Badge color="amber">Superadmin</Badge>}
                </div>
                <div className="text-xs text-slate-500">{p.email}</div>
              </div>
              {!p.is_super_admin && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    setApproved.mutate(
                      { id: p.id, approved: false },
                      { onSuccess: () => toast.success('Åtkomst indragen') },
                    )
                  }
                >
                  Dra in
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/* ---------- Familjer ---------- */
function GroupsTab() {
  const { data: groups, isLoading } = useGroups()
  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()
  const toast = useToast()
  const [name, setName] = useState('')

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="mb-3 font-semibold text-brand-800">Ny familj</h3>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            createGroup.mutate(
              { name: name.trim() },
              {
                onSuccess: () => {
                  setName('')
                  toast.success('Familj skapad')
                },
                onError: () => toast.error('Kunde inte skapa'),
              },
            )
          }}
        >
          <Input
            placeholder="t.ex. Familjen Höfling"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" loading={createGroup.isPending}>
            Skapa
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 font-semibold text-brand-800">Familjer ({groups?.length ?? 0})</h3>
        <ul className="divide-y divide-slate-100">
          {(groups ?? []).map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2 py-2">
              <input
                defaultValue={g.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== g.name) {
                    updateGroup.mutate(
                      { id: g.id, name: e.target.value.trim() },
                      { onSuccess: () => toast.success('Sparat') },
                    )
                  }
                }}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
              <span className="text-xs text-slate-400">{g.timezone}</span>
              <Button
                variant="ghost"
                className="ml-auto text-red-600"
                onClick={() => {
                  if (confirm(`Radera "${g.name}" och all dess data?`)) {
                    deleteGroup.mutate(g.id, { onSuccess: () => toast.success('Raderad') })
                  }
                }}
              >
                Radera
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/* ---------- Medlemskap ---------- */
function MembersTab() {
  const { data: groups } = useGroups()
  const { data: profiles } = useAllProfiles()
  const [groupId, setGroupId] = useState<string>('')
  const { data: members, isLoading } = useGroupMembers(groupId || null)
  const addMember = useAddMember()
  const setRole = useSetMemberRole()
  const removeMember = useRemoveMember()
  const toast = useToast()
  const [addUser, setAddUser] = useState('')
  const [addRole, setAddRole] = useState<GroupRole>('medlem')

  const memberIds = new Set((members ?? []).map((m) => m.user_id))
  const available = (profiles ?? []).filter(
    (p) => (p.approved || p.is_super_admin) && !memberIds.has(p.id),
  )

  return (
    <div className="space-y-4">
      <Field label="Familj">
        <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Välj familj…</option>
          {(groups ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </Field>

      {groupId && (
        <>
          <Card className="p-4">
            <h3 className="mb-3 font-semibold text-brand-800">Lägg till medlem</h3>
            <div className="flex flex-wrap gap-2">
              <Select
                value={addUser}
                onChange={(e) => setAddUser(e.target.value)}
                className="min-w-[12rem] flex-1"
              >
                <option value="">Välj godkänd användare…</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.email}
                  </option>
                ))}
              </Select>
              <Select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as GroupRole)}
                className="w-36"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
              <Button
                disabled={!addUser}
                onClick={() =>
                  addMember.mutate(
                    { groupId, userId: addUser, role: addRole },
                    {
                      onSuccess: () => {
                        setAddUser('')
                        toast.success('Tillagd')
                      },
                      onError: () => toast.error('Kunde inte lägga till'),
                    },
                  )
                }
              >
                Lägg till
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 font-semibold text-brand-800">Medlemmar</h3>
            {isLoading ? (
              <LoadingState />
            ) : (members ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">Inga medlemmar än.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(members ?? []).map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
                    <div className="min-w-[10rem] flex-1">
                      <div className="text-sm font-medium text-slate-800">{m.name || m.email}</div>
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
          </Card>
        </>
      )}
    </div>
  )
}

/* ---------- Personer ---------- */
function PeopleTab() {
  const { data: groups } = useGroups()
  const [groupId, setGroupId] = useState<string>('')
  const { data: people, isLoading } = useGroupPeople(groupId || null)
  const { data: members } = useGroupMembers(groupId || null)
  const addPerson = useAddPerson()
  const deletePerson = useDeletePerson()
  const toast = useToast()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'adult' | 'child'>('child')
  const [linked, setLinked] = useState('')

  return (
    <div className="space-y-4">
      <Field label="Familj">
        <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Välj familj…</option>
          {(groups ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </Field>

      {groupId && (
        <>
          <Card className="p-4">
            <h3 className="mb-3 font-semibold text-brand-800">Ny person</h3>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!name.trim()) return
                addPerson.mutate(
                  {
                    group_id: groupId,
                    name: name.trim(),
                    kind,
                    linked_user_id: linked || null,
                  },
                  {
                    onSuccess: () => {
                      setName('')
                      setLinked('')
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
              <Select value={linked} onChange={(e) => setLinked(e.target.value)} className="w-44">
                <option value="">Inget konto</option>
                {(members ?? []).map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name || m.email}
                  </option>
                ))}
              </Select>
              <Button type="submit">Lägg till</Button>
            </form>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 font-semibold text-brand-800">Personer</h3>
            {isLoading ? (
              <LoadingState />
            ) : (people ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">Inga personer än.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(people ?? []).map((person) => (
                  <li key={person.id} className="flex items-center gap-2 py-2">
                    <span className="text-sm font-medium text-slate-800">{person.name}</span>
                    <Badge color={person.kind === 'adult' ? 'blue' : 'green'}>
                      {person.kind === 'adult' ? 'Vuxen' : 'Barn'}
                    </Badge>
                    {person.linked_user_id && <Badge color="slate">Har konto</Badge>}
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
        </>
      )}
    </div>
  )
}
