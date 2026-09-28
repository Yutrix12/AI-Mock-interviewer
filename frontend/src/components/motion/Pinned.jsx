import { useRef } from 'react'
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react'

// A tall section whose stage stays pinned while steps cross-fade with scroll.
// Under reduced motion (and on small screens, via CSS) it becomes a plain list.

function Step({ step, index, count, progress }) {
  const span = 1 / count
  const start = index * span
  const end = start + span
  const fade = span * 0.18
  const isFirst = index === 0
  const isLast = index === count - 1

  // Visible across its own slice of the scroll; fades in over the last bit of the
  // previous slice and out over the end of its own. First/last stay put at the edges.
  const visibility = (p) => {
    if (!isFirst && p < start - fade) return 0
    if (!isFirst && p < start) return (p - (start - fade)) / fade
    if (!isLast && p > end) return 0
    if (!isLast && p > end - fade) return (end - p) / fade
    return 1
  }
  const opacity = useTransform(progress, visibility)
  const y = useTransform(progress, (p) => (1 - visibility(p)) * (p < start + span / 2 ? 40 : -40))
  const flip = index % 2 === 1

  return (
    <motion.article className="pin-step" data-flip={flip || undefined} style={{ opacity, y }}>
      <div className="pin-step-title">
        <span className="pin-step-num display" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h3 className="display">{step.title}</h3>
      </div>
      <div className="pin-step-body">
        <p>{step.body}</p>
        <span className="eyebrow">{step.meta}</span>
      </div>
    </motion.article>
  )
}

function Segment({ index, count, progress }) {
  const start = index / count
  const scaleX = useTransform(progress, [start, start + 1 / count], [0, 1])
  return (
    <span className="pin-segment">
      <motion.span style={{ scaleX }} />
    </span>
  )
}

export default function PinnedSteps({ steps }) {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })

  if (reduce) {
    return (
      <ol className="pin-list">
        {steps.map((step, i) => (
          <li key={step.title} className="pin-list-item">
            <span className="pin-step-num display" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <h3 className="display">{step.title}</h3>
              <p>{step.body}</p>
              <span className="eyebrow">{step.meta}</span>
            </div>
          </li>
        ))}
      </ol>
    )
  }

  return (
    <div ref={ref} className="pin-track" style={{ height: `${steps.length * 90 + 40}vh` }}>
      <div className="pin-stage" aria-hidden="true">
        {steps.map((step, i) => (
          <Step key={step.title} step={step} index={i} count={steps.length} progress={scrollYProgress} />
        ))}
        <div className="pin-segments" aria-hidden="true">
          {steps.map((step, i) => (
            <Segment key={step.title} index={i} count={steps.length} progress={scrollYProgress} />
          ))}
        </div>
      </div>
      {/* Content for assistive tech, independent of scroll position. */}
      <ol className="visually-hidden">
        {steps.map((step) => (
          <li key={step.title}>
            {step.title}. {step.body}
          </li>
        ))}
      </ol>
    </div>
  )
}
