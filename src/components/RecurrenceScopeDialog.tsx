import { Modal } from './Modal'
import { Button } from './ui'

export type Scope = 'single' | 'future' | 'all'

export function RecurrenceScopeDialog({
  open,
  action,
  onPick,
  onCancel,
}: {
  open: boolean
  action: 'edit' | 'delete'
  onPick: (scope: Scope) => void
  onCancel: () => void
}) {
  const verb = action === 'edit' ? 'ändra' : 'ta bort'
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={`Återkommande händelse`}
      footer={
        <Button variant="secondary" onClick={onCancel}>
          Avbryt
        </Button>
      }
    >
      <p className="mb-4 text-sm text-slate-600">Vad vill du {verb}?</p>
      <div className="space-y-2">
        <Button className="w-full justify-start" variant="secondary" onClick={() => onPick('single')}>
          Bara denna händelse
        </Button>
        <Button className="w-full justify-start" variant="secondary" onClick={() => onPick('future')}>
          Denna och kommande
        </Button>
        <Button className="w-full justify-start" variant="secondary" onClick={() => onPick('all')}>
          Hela serien
        </Button>
      </div>
    </Modal>
  )
}
