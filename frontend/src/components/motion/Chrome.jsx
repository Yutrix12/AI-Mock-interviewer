import { useEffect, useState } from 'react'
import { motion, useMotionValueEvent, useScroll, useSpring, useMotionValue, useReducedMotion } from 'motion/react'
import { ArrowUpIcon } from '@phosphor-icons/react'
import { scrollToTop } from '../../lib/scroll'

// Thin accent line along the top edge showing how far down the page you are.
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40, restDelta: 0.001 })
  return <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden="true" />
}

// Back-to-top button whose ring fills with scroll progress.
export function BackToTop() {
  const { scrollY, scrollYProgress } = useScroll()
  const [shown, setShown] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => {
    const next = y > 700
    if (next !== shown) setShown(next)
  })
  return (
    <div className="back-to-top" data-shown={shown || undefined}>
      <button type="button" onClick={() => scrollToTop()} aria-label="Back to top" tabIndex={shown ? 0 : -1}>
        <svg viewBox="0 0 64 64" aria-hidden="true" className="back-to-top-ring">
          <circle cx="32" cy="32" r="30" pathLength="1" className="ring-track" />
          <motion.circle cx="32" cy="32" r="30" pathLength="1" className="ring-fill" style={{ pathLength: scrollYProgress }} />
        </svg>
        <span className="back-to-top-core">
          <ArrowUpIcon weight="bold" aria-hidden="true" />
        </span>
      </button>
    </div>
  )
}

// Small accent dot that trails the pointer (fine pointers only; the system cursor stays).
export function CursorDot() {
  const reduce = useReducedMotion()
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const sx = useSpring(x, { stiffness: 500, damping: 40, mass: 0.4 })
  const sy = useSpring(y, { stiffness: 500, damping: 40, mass: 0.4 })
  const [enabled] = useState(() => window.matchMedia('(pointer: fine)').matches)
  const active = enabled && !reduce

  useEffect(() => {
    if (!active) return
    const move = (e) => {
      x.set(e.clientX)
      y.set(e.clientY)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [active, x, y])

  if (!active) return null
  return <motion.div className="cursor-dot" style={{ x: sx, y: sy }} aria-hidden="true" />
}
