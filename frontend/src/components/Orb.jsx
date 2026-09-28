// The interviewer's presence. `state` picks the idle animation; while
// listening, useRecorder drives its scale through the `--level` variable.
export default function Orb({ state = 'idle', orbRef, className = '' }) {
  return (
    <div ref={orbRef} className={`orb ${className}`} data-state={state} aria-hidden="true">
      <span className="orb-layer orb-layer-a" />
      <span className="orb-layer orb-layer-b" />
      <span className="orb-sheen" />
    </div>
  )
}
