import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { markSplashSeen } from '../../lib/intro'

// Intro: particles gather into the MockerAI voice mark, re-form as the serif
// wordmark, then burst outward while the overlay fades. Canvas 2D, seeded so
// it looks the same every time. Shown once per browser session.

const DURATION = 3600
const REDUCED_DURATION = 700
const FADE_MS = 480
// Park–Miller PRNG so the particle field is identical on every run.
function seeded(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const range = (v, a, b) => clamp((v - a) / (b - a), 0, 1)
const easeOut = (t) => 1 - (1 - t) ** 3
const lerp = (a, b, t) => a + (b - a) * t

// Rasterise a drawing offscreen and return the filled points on a grid.
function sample(width, height, step, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  draw(ctx)
  const data = ctx.getImageData(0, 0, width, height).data
  const points = []
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] > 128) points.push({ x, y })
    }
  }
  return points
}

// The voice mark: an outer ring, a thinner inner ring and a solid core.
function markPoints(w, h, step, small) {
  const r = Math.min(w * (small ? 0.3 : 0.17), h * 0.26)
  return sample(w, h, step, (ctx) => {
    ctx.lineWidth = r * 0.12
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = r * 0.05
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r * 0.68, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r * 0.36, 0, Math.PI * 2)
    ctx.fill()
  })
}

function wordPoints(w, h, step, small) {
  const size = Math.min(w * (small ? 0.2 : 0.14), h * 0.3)
  return sample(w, h, step, (ctx) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `400 ${size}px "Instrument Serif", Georgia, serif`
    ctx.fillText('MockerAI', w / 2, h / 2)
  })
}

export default function Splash({ onDone }) {
  const reduce = useReducedMotion()
  const canvasRef = useRef(null)
  const [fading, setFading] = useState(false)
  const [mounted, setMounted] = useState(true)
  const doneRef = useRef(onDone)

  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const styles = getComputedStyle(document.documentElement)
    const accent = styles.getPropertyValue('--accent').trim() || '#d62e2f'
    const ink = styles.getPropertyValue('--ink').trim() || '#293f76'
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const duration = reduce ? REDUCED_DURATION : DURATION

    let w = window.innerWidth
    let h = window.innerHeight
    let particles = []
    let raf = 0
    let start
    let finished = false
    let fadeTimer
    let cancelled = false

    const size = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const build = () => {
      const small = w < 640
      const a = markPoints(w, h, 4, small)
      const b = wordPoints(w, h, 4, small)
      const count = Math.min(small ? 1800 : 4500, Math.max(a.length, b.length, 1))
      const rand = seeded(11)
      particles = Array.from({ length: count }, () => ({
        hx: rand() * w,
        hy: rand() * h,
        ox: (rand() - 0.5) * w * 1.6 + w / 2,
        oy: (rand() - 0.5) * h * 1.6 + h / 2,
        a: a[Math.floor(rand() * a.length)] ?? { x: w / 2, y: h / 2 },
        b: b[Math.floor(rand() * b.length)] ?? { x: w / 2, y: h / 2 },
        r: 0.6 + rand() * 1.6,
      }))
    }

    const frame = (now) => {
      if (start === undefined) start = now
      const t = Math.min(1, (now - start) / duration)
      const toMark = easeOut(range(t, 0.12, 0.38))
      const toWord = easeOut(range(t, 0.46, 0.68))
      const burst = easeOut(range(t, 0.76, 1))

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = t > 0.5 ? ink : accent
      ctx.globalAlpha = burst > 0 ? 1 - burst : 1
      for (const p of particles) {
        let x = lerp(p.hx, p.a.x, toMark)
        let y = lerp(p.hy, p.a.y, toMark)
        x = lerp(x, p.b.x, toWord)
        y = lerp(y, p.b.y, toWord)
        x = lerp(x, p.ox, burst)
        y = lerp(y, p.oy, burst)
        ctx.beginPath()
        ctx.arc(x, y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      if (!finished && t >= 0.9) {
        finished = true
        setFading(true)
        fadeTimer = setTimeout(() => {
          markSplashSeen()
          setMounted(false)
          doneRef.current?.()
        }, FADE_MS)
      }
      if (t < 1) raf = requestAnimationFrame(frame)
    }

    size()
    // The wordmark is sampled from Instrument Serif, so wait for it (briefly).
    const fontReady = Promise.race([
      document.fonts?.load('400 64px "Instrument Serif"') ?? Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, 600)),
    ])
    fontReady.then(() => {
      if (cancelled) return
      build()
      raf = requestAnimationFrame(frame)
    })

    const onResize = () => {
      size()
      build()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearTimeout(fadeTimer)
      window.removeEventListener('resize', onResize)
    }
  }, [reduce])

  if (!mounted) return null
  return (
    <div className="splash" data-fading={fading || undefined} role="status" aria-label="Loading MockerAI">
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  )
}
