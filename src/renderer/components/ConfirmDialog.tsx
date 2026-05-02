import React, { useState } from 'react'

interface DialogState {
  message: string
  resolve: (v: boolean) => void
  confirmLabel?: string
  danger?: boolean
}

/**
 * useConfirm — drop-in replacement for window.confirm() that works in Electron.
 *
 * Usage:
 *   const { confirm, dialog } = useConfirm()
 *   // ...
 *   if (!await confirm('Delete this?')) return
 *   // ...
 *   return <div>{dialog} ... rest of JSX</div>
 */
export function useConfirm() {
  const [state, setState] = useState<DialogState | null>(null)

  function confirm(message: string, opts?: { confirmLabel?: string; danger?: boolean }): Promise<boolean> {
    return new Promise(resolve => {
      setState({ message, resolve, confirmLabel: opts?.confirmLabel, danger: opts?.danger })
    })
  }

  const dialog = state ? (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="card w-full max-w-sm shadow-xl">
        <p className="text-sm leading-relaxed mb-6">{state.message}</p>
        <div className="flex justify-end gap-3">
          <button
            className="btn-secondary"
            onClick={() => { state.resolve(false); setState(null) }}
          >
            Cancel
          </button>
          <button
            className={state.danger ? 'btn-danger' : 'btn-primary'}
            onClick={() => { state.resolve(true); setState(null) }}
          >
            {state.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, dialog }
}
