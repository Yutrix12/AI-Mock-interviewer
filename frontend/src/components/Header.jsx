import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { SpeakerHighIcon, SpeakerSlashIcon, XIcon } from '@phosphor-icons/react'
import { scrollToId } from '../lib/scroll'

const SECTIONS = [
  { id: 'tracks', label: 'Tracks' },
  { id: 'how', label: 'How it works' },
  { id: 'scoring', label: 'Scoring' },
]

export function Wordmark() {
  return (
    <span className="wordmark" translate="no">
      MockerAI<span className="wordmark-dot" aria-hidden="true" />
    </span>
  )
}

export default function Header({ view, voiceOn, onToggleVoice, onEndInterview, onHome, onUpload }) {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  const [tone, setTone] = useState('light')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const goTo = (id) => {
    setMenuOpen(false)
    // Let the overlay start closing before the page scrolls underneath it.
    requestAnimationFrame(() => scrollToId(id))
  }

  // Match the pill to whatever section is behind it (dark glass over dark sections).
  const probeTone = () => {
    const under = document.elementsFromPoint(window.innerWidth / 2, 48).find((el) => !el.closest('.site-header'))
    const next = under?.closest('.section-dark') ? 'dark' : under?.closest('.surface-light') ? 'light' : 'page'
    setTone((current) => (current === next ? current : next))
  }

  useMotionValueEvent(scrollY, 'change', (y) => {
    const next = y > 24
    if (next !== scrolled) setScrolled(next)
    probeTone()
  })

  useEffect(() => {
    const frame = requestAnimationFrame(probeTone)
    return () => cancelAnimationFrame(frame)
  }, [view])

  const inInterview = view === 'interview'
  const onHomePage = view === 'home'

  return (
    <header className="site-header">
      <div className="nav-pill" data-scrolled={scrolled || !onHomePage || undefined} data-tone={tone}>
        {inInterview ? (
          <span className="logo">
            <Wordmark />
          </span>
        ) : (
          <button type="button" className="logo logo-button" onClick={onHome} aria-label="MockerAI home">
            <Wordmark />
          </button>
        )}

        {onHomePage && (
          <nav className="nav-links" aria-label="Sections">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="link-wipe nav-link"
                onClick={(e) => {
                  e.preventDefault()
                  scrollToId(s.id)
                }}
              >
                <span>{s.label}</span>
              </a>
            ))}
          </nav>
        )}

        <div className="nav-actions">
          <button
            type="button"
            className="btn btn-quiet nav-voice"
            aria-pressed={voiceOn}
            onClick={onToggleVoice}
            title={voiceOn ? 'The interviewer reads questions and feedback aloud' : 'Questions and feedback are shown as text only'}
          >
            {voiceOn ? <SpeakerHighIcon aria-hidden="true" /> : <SpeakerSlashIcon aria-hidden="true" />}
            <span className="nav-voice-label">{voiceOn ? 'Voice on' : 'Voice off'}</span>
          </button>
          {onHomePage && (
            <button
              type="button"
              className="nav-menu-btn"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span />
              <span />
            </button>
          )}
          {inInterview ? (
            <button type="button" className="btn btn-secondary" onClick={onEndInterview}>
              <XIcon aria-hidden="true" />
              <span>End interview</span>
            </button>
          ) : (
            onHomePage && (
              <button type="button" className="btn btn-primary nav-cta" onClick={onUpload}>
                Upload resume
              </button>
            )
          )}
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && onHomePage && (
          <motion.nav
            id="mobile-menu"
            className="mobile-menu"
            aria-label="Sections"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
          >
            <ul>
              {SECTIONS.map((s, i) => (
                <li key={s.id} className="mobile-menu-item">
                  <motion.a
                    href={`#${s.id}`}
                    className="mobile-menu-link"
                    initial={{ y: 48, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 24, opacity: 0 }}
                    transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1], delay: 0.08 + i * 0.06 }}
                    onClick={(e) => {
                      e.preventDefault()
                      goTo(s.id)
                    }}
                  >
                    <span className="mono" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                    {s.label}
                  </motion.a>
                </li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
