import { useEffect, useState } from 'react'
import { WarningCircleIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import Orb from './Orb'
import { formatClock } from '../lib/format'

// Full-panel state for slow local-model work: shows honest elapsed time
// instead of a fake progress bar, and offers a way out.
export function Working({ title, detail, onCancel, cancelLabel = 'Cancel' }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const startedAt = performance.now()
    const id = setInterval(() => setSeconds(Math.floor((performance.now() - startedAt) / 1000)), 500)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="panel working bezel enter" aria-busy="true" aria-labelledby="working-title">
      <Orb state="thinking" className="orb-working" />
      <h1 id="working-title" className="working-title" role="status">
        {title}
      </h1>
      <p className="working-detail">{detail}</p>
      <p className="working-time mono" aria-hidden="true">
        {formatClock(seconds)}
      </p>
      {onCancel && (
        <button type="button" className="btn btn-link" onClick={onCancel}>
          {cancelLabel}
        </button>
      )}
    </section>
  )
}

export function Failed({ title, message, onRetry, onBack, backLabel = 'Go back' }) {
  return (
    <section className="panel working bezel enter" role="alert" aria-labelledby="failed-title">
      <WarningCircleIcon className="error-icon" aria-hidden="true" />
      <h1 id="failed-title" className="working-title">
        {title}
      </h1>
      <p className="working-detail">{message}</p>
      <div className="stage-controls stage-controls-row">
        {onRetry && (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            <ArrowCounterClockwiseIcon aria-hidden="true" weight="bold" />
            <span>Try again</span>
          </button>
        )}
        {onBack && (
          <button type="button" className="btn btn-link" onClick={onBack}>
            {backLabel}
          </button>
        )}
      </div>
    </section>
  )
}
