import { DIMENSIONS } from '../lib/config'
import { formatScore } from '../lib/format'

export default function DimensionScores({ scores, className = '' }) {
  return (
    <dl className={`dimensions ${className}`}>
      {DIMENSIONS.map((d) => (
        <div key={d.id} className="dimension">
          <dt>{d.label}</dt>
          <dd className="mono">{formatScore(scores?.[d.id])}</dd>
        </div>
      ))}
    </dl>
  )
}
