import { useRef } from 'react'
import { motion, useInView } from 'motion/react'

const EASE = [0.22, 1, 0.36, 1]
const TAGS = { div: motion.div, section: motion.section, li: motion.li, p: motion.p, span: motion.span, header: motion.header }

// Fades and lifts content in the first time it scrolls into view.
// `play` (optional) takes over from the viewport trigger, e.g. to wait for the intro.
export function Reveal({ as = 'div', delay = 0, y = 24, play, className, children, ...rest }) {
  const Component = TAGS[as] ?? motion.div
  const hidden = { opacity: 0, y, filter: 'blur(8px)' }
  const shown = { opacity: 1, y: 0, filter: 'blur(0px)' }
  const trigger =
    play === undefined
      ? { whileInView: shown, viewport: { once: true, margin: '0px 0px -12% 0px' } }
      : { animate: play ? shown : hidden }
  return (
    <Component
      className={className}
      initial={hidden}
      {...trigger}
      transition={{ duration: 0.9, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Component>
  )
}

// Headline revealed line by line from behind a mask. Visibility is measured on the
// headline itself: the moving lines are clipped by their masks, so observing them
// directly would never report them as in view.
export function LineReveal({ as: Tag = 'h1', lines, className, id, onView = false, delay = 0, play = true }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  const shown = play && (!onView || inView)
  return (
    <Tag ref={ref} className={className} id={id}>
      {lines.map((line, i) => (
        <span key={i} className="line-mask">
          <motion.span
            className="line-mask-inner"
            initial={{ y: '110%' }}
            animate={{ y: shown ? '0%' : '110%' }}
            transition={{ duration: 1.1, ease: EASE, delay: delay + i * 0.12 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  )
}

// Letters resolve out of a blur, one after another. Screen readers get the plain text.
export function BlurText({ text, accent, className }) {
  let index = 0
  const renderWord = (word, wordKey, isAccent) => (
    <span key={wordKey} className={`blur-word${isAccent ? ' accent-em' : ''}`} aria-hidden="true">
      {[...word].map((char) => {
        const i = index++
        return (
          <motion.span
            key={i}
            className="blur-char"
            initial={{ opacity: 0, filter: 'blur(14px)' }}
            whileInView={{ opacity: 1, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '0px 0px -15% 0px' }}
            transition={{ duration: 0.9, ease: EASE, delay: i * 0.035 }}
          >
            {char === ' ' ? ' ' : char}
          </motion.span>
        )
      })}
    </span>
  )

  const words = text.split(' ')
  return (
    <span className={className}>
      <span className="visually-hidden">{accent ? `${text} ${accent}` : text}</span>
      {words.map((w, i) => (
        <span key={i}>
          {renderWord(w, `w${i}`, false)}{' '}
        </span>
      ))}
      {accent && renderWord(accent, 'accent', true)}
    </span>
  )
}
