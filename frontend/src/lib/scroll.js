import Lenis from 'lenis'

// One shared smooth-scroll instance. Stays null under reduced motion,
// in which case the helpers fall back to native scrolling.
let lenis = null

export function startSmoothScroll() {
  // Every view opens at the top; a restored scroll position would briefly
  // put scroll-driven UI (header glass, back-to-top) in the wrong state.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  if (lenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  lenis = new Lenis({ lerp: 0.1, anchors: { offset: -100 }, autoRaf: true })
  return () => {
    lenis?.destroy()
    lenis = null
  }
}

export function scrollToTop({ immediate = false } = {}) {
  if (lenis) lenis.scrollTo(0, { immediate })
  else window.scrollTo({ top: 0, behavior: immediate ? 'auto' : 'smooth' })
}

export function scrollToId(id) {
  const target = document.getElementById(id)
  if (!target) return
  if (lenis) lenis.scrollTo(target, { offset: -100 })
  else target.scrollIntoView({ behavior: 'smooth' })
}
