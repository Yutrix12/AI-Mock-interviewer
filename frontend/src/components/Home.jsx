import { useEffect, useRef } from 'react'
import { animate, useInView, useReducedMotion } from 'motion/react'
import { ArrowRightIcon, ArrowUpRightIcon, AsteriskIcon } from '@phosphor-icons/react'
import HeroCanvas from './motion/HeroCanvas'
import PinnedSteps from './motion/Pinned'
import { BlurText, LineReveal, Reveal } from './motion/Reveal'
import DimensionScores from './DimensionScores'
import { Wordmark } from './Header'
import { firstName, possessive } from '../lib/format'
import { scrollToId } from '../lib/scroll'

const STATS = [
  { value: 8, label: 'Skill areas' },
  { value: 3, label: 'Difficulty levels' },
  { value: 4, label: 'Scoring dimensions' },
  { value: 0, label: 'Bytes sent to the cloud' },
]

const MARQUEE = [
  'System design',
  'React',
  'Behavioral',
  'PostgreSQL',
  'Machine learning',
  'Kubernetes',
  'STAR stories',
  'FastAPI',
  'Project deep dives',
  'TypeScript',
  'Data pipelines',
  'AWS',
]

const TRACK_ROWS = [
  { title: 'Frontend engineering', tags: ['React', 'State', 'Performance'] },
  { title: 'Backend engineering', tags: ['APIs', 'Databases', 'Reliability'] },
  { title: 'Machine learning & AI', tags: ['Models', 'Evaluation', 'MLOps'] },
  { title: 'Behavioral', tags: ['Teamwork', 'Ownership', 'STAR'] },
]

const STEPS = [
  {
    title: 'Upload & parse',
    body: 'Drop in a PDF, DOCX or TXT. A local model pulls out your skills, roles and projects, and you can edit anything it got wrong.',
    meta: 'Typical: 30 seconds',
  },
  {
    title: 'Pick your interview',
    body: 'Choose from tracks built from your own skills, then set the difficulty and how many questions you want.',
    meta: 'Entry, mid or senior',
  },
  {
    title: 'Answer out loud',
    body: 'Each question references your real work. Speak for up to two minutes, or type if you are somewhere quiet.',
    meta: 'Voice or text',
  },
  {
    title: 'Review & repeat',
    body: 'See a score for every answer, the key points you missed, and a practice plan for the week ahead.',
    meta: 'Scored on four dimensions',
  },
]

const SAMPLE_SCORES = { content: 8, clarity: 9, structure: 9, relevance: 10 }

function CountUp({ value }) {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const inView = useInView(ref, { once: true, margin: '0px 0px -20% 0px' })
  useEffect(() => {
    if (!inView || !ref.current || reduce || value === 0) return
    const controls = animate(0, value, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = String(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [inView, reduce, value])
  return (
    <span ref={ref} className="num">
      {value}
    </span>
  )
}

function NetworkArt() {
  const nodes = [
    [30, 40],
    [120, 22],
    [150, 105],
    [48, 128],
    [230, 60],
    [214, 142],
  ]
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [1, 3],
    [1, 4],
    [4, 5],
    [2, 5],
  ]
  return (
    <svg className="card-art" viewBox="0 0 260 170" aria-hidden="true">
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} className="art-line" style={{ '--i': i }} />
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 4 ? 8 : 5} className={i === 4 ? 'art-node art-node-accent' : 'art-node'} />
      ))}
      <circle cx="190" cy="50" r="3" className="art-pulse" />
    </svg>
  )
}

function ResumeArt() {
  const rows = [
    [0, 150, false],
    [1, 210, false],
    [2, 180, true],
    [3, 120, false],
    [4, 196, true],
    [5, 160, false],
  ]
  return (
    <svg className="card-art" viewBox="0 0 260 170" aria-hidden="true">
      <rect x="20" y="10" width="220" height="150" rx="10" className="art-frame" />
      <rect x="36" y="26" width="60" height="8" rx="4" className="art-block" />
      {rows.map(([i, w, hot]) => (
        <rect key={i} x="36" y={48 + i * 17} width={w - 30} height="6" rx="3" className={hot ? 'art-hot' : 'art-row'} />
      ))}
    </svg>
  )
}

function Stars() {
  // Fixed pseudo-random layout so the field is identical on every render.
  const stars = Array.from({ length: 70 }, (_, i) => {
    const r = (n) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1
    return { left: r(1) * 100, top: r(2) * 100, size: r(3) > 0.85 ? 2 : 1, dur: 2.4 + r(4) * 3.2, delay: r(5) * 4 }
  })
  return (
    <div className="stars" aria-hidden="true">
      {stars.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function Home({ savedName, onUpload, onContinue, introDone = true }) {
  const name = firstName(savedName)

  return (
    <div className="home">
      {/* Hero */}
      <section className="hero surface-light" aria-labelledby="hero-title">
        <div className="hero-bg" aria-hidden="true">
          <HeroCanvas />
        </div>
        <div className="hero-inner">
          <LineReveal
            id="hero-title"
            play={introDone}
            className="hero-title display"
            lines={[
              <>Practice the interview</>,
              <>
                you’ll <em>actually</em> get.
              </>,
            ]}
          />
          <Reveal as="p" className="hero-sub" delay={0.35} y={16} play={introDone}>
            Upload your resume. MockerAI builds interviews from your real projects, listens to your answers, and scores them
            locally.
          </Reveal>
          <Reveal className="hero-actions" delay={0.5} y={16} play={introDone}>
            <button type="button" className="btn btn-primary btn-lg btn-has-icon" onClick={onUpload}>
              Upload resume
              <span className="btn-icon" aria-hidden="true"><ArrowRightIcon weight="bold" /></span>
            </button>
            {onContinue ? (
              <button type="button" className="link-wipe" onClick={onContinue}>
                <span>{name ? `Continue with ${possessive(name)} resume` : 'Continue with saved resume'}</span>
                <ArrowRightIcon aria-hidden="true" />
              </button>
            ) : (
              <a
                href="#how"
                className="link-wipe"
                onClick={(e) => {
                  e.preventDefault()
                  scrollToId('how')
                }}
              >
                <span>See how it works</span>
                <ArrowRightIcon aria-hidden="true" />
              </a>
            )}
          </Reveal>
        </div>
      </section>

      {/* Stats + marquee */}
      <section className="section-dark stats-band" aria-label="MockerAI in numbers">
        <dl className="stats container">
          {STATS.map((s, i) => (
            <Reveal key={s.label} className="stat" delay={i * 0.08}>
              <dt className="eyebrow">{s.label}</dt>
              <dd className="stat-value display">
                <CountUp value={s.value} />
              </dd>
            </Reveal>
          ))}
        </dl>
        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <div className="marquee-group" key={copy}>
                {MARQUEE.map((item) => (
                  <span key={item} className="marquee-item">
                    <span className="display">{item}</span>
                    <AsteriskIcon className="marquee-star" weight="bold" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tracks */}
      <section id="tracks" className="section container" aria-labelledby="tracks-title">
        <div className="section-head">
          <Reveal as="span" className="eyebrow">
            / Interview tracks
          </Reveal>
          <LineReveal
            as="h2"
            id="tracks-title"
            onView
            className="section-title display"
            lines={[<>Built from your resume,</>, <>not a question bank.</>]}
          />
        </div>

        <div className="flagships">
          <Reveal className="flagship bezel">
            <NetworkArt />
            <span className="eyebrow">Recommended / 01</span>
            <h3 className="flagship-title display">Full interview loop</h3>
            <p>
              Technical questions in your strongest skill area, a deep dive into a project you listed, and a behavioral round.
              The closest thing to the real day.
            </p>
            <div className="tags">
              {['Technical', 'Project', 'Behavioral', 'Adaptive'].map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal className="flagship bezel" delay={0.12}>
            <ResumeArt />
            <span className="eyebrow">Tailored / 02</span>
            <h3 className="flagship-title display">Resume deep dive</h3>
            <p>
              Every question is about something on your resume: the decisions you made, what went wrong, and what you would
              change. Exactly what interviewers probe.
            </p>
            <div className="tags">
              {['Your projects', 'Your roles', 'Trade-offs', 'Impact'].map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        <ol className="track-rows">
          {TRACK_ROWS.map((row, i) => (
            <Reveal as="li" key={row.title} className="track-row" delay={i * 0.06}>
              <button type="button" className="track-row-button" onClick={onUpload}>
                <span className="track-row-num mono" aria-hidden="true">{String(i + 3).padStart(2, '0')}</span>
                <span className="track-row-title display">{row.title}</span>
                <span className="track-row-tags mono" aria-hidden="true">{row.tags.join(' · ')}</span>
                <ArrowUpRightIcon className="track-row-arrow" aria-hidden="true" />
              </button>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* How it works (pinned) */}
      <section id="how" className="section-dark how" aria-labelledby="how-title">
        <div className="container how-head">
          <span className="eyebrow">/ How it works</span>
          <LineReveal
            as="h2"
            id="how-title"
            onView
            className="section-title display"
            lines={[<>Four steps. No sign-up.</>, <>Nothing leaves your machine.</>]}
          />
        </div>
        <div className="container">
          <PinnedSteps steps={STEPS} />
        </div>
      </section>

      {/* Scoring */}
      <section id="scoring" className="section container scoring" aria-labelledby="scoring-title">
        <div className="scoring-copy">
          <span className="eyebrow">/ Scoring</span>
          <LineReveal
            as="h2"
            id="scoring-title"
            onView
            className="section-title display"
            lines={[<>Scored like a</>, <>real interviewer.</>]}
          />
          <Reveal as="p" className="section-lede">
            The model rates content, clarity, structure and relevance. The final score is computed in code, with guards that stop
            a short, polished answer from passing as a strong one.
          </Reveal>
          <ul className="scoring-points">
            {[
              'Weights change with the question type',
              'Short answers can’t claim structure',
              'Polish can’t outscore substance',
              'Whisper hallucinations are filtered out',
            ].map((point, i) => (
              <Reveal as="li" key={point} delay={i * 0.06}>
                {point}
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal className="sample-card bezel" delay={0.1}>
          <div className="sample-head">
            <span className="eyebrow">Example feedback</span>
            <span className="tag">Technical</span>
          </div>
          <p className="sample-q display">“How did you decide what to cache, and for how long?”</p>
          <div className="sample-score">
            <span className="sample-score-value display num">8.8</span>
            <span className="sample-score-label">
              <strong>Strong answer</strong>
              <span>out of 10</span>
            </span>
          </div>
          <DimensionScores scores={SAMPLE_SCORES} />
          <p className="sample-feedback">
            You explained the trade-off clearly and backed it with real numbers. Say how you monitored lag, and when you would
            scale the workers.
          </p>
        </Reveal>
      </section>

      {/* CTA with star field */}
      <section className="section-dark cta" aria-labelledby="cta-title">
        <Stars />
        <div className="cta-glow" aria-hidden="true" />
        <div className="cta-frame" aria-hidden="true" />
        <div className="cta-inner">
          <h2 id="cta-title" className="cta-title display">
            <BlurText text="Your next interview" accent="starts here." />
          </h2>
          <Reveal delay={0.5} y={12}>
            <button type="button" className="btn btn-primary btn-lg btn-has-icon" onClick={onUpload}>
              Upload resume
              <span className="btn-icon" aria-hidden="true"><ArrowRightIcon weight="bold" /></span>
            </button>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="section-dark site-footer">
        <div className="container footer-grid">
          <div>
            <span className="eyebrow">MockerAI</span>
            <p className="footer-about">
              Resume-driven mock interviews with local speech recognition and a local language model. Private by default.
            </p>
          </div>
          <div>
            <span className="eyebrow">Explore</span>
            <ul className="footer-links">
              {[
                ['tracks', 'Interview tracks'],
                ['how', 'How it works'],
                ['scoring', 'Scoring'],
              ].map(([id, label]) => (
                <li key={id}>
                  <a
                    className="link-wipe"
                    href={`#${id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      scrollToId(id)
                    }}
                  >
                    <span>{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="eyebrow">Runs on</span>
            <ul className="footer-links footer-plain">
              <li>Whisper small.en</li>
              <li>Llama 3.1 8B via Ollama</li>
              <li>Flask + React</li>
            </ul>
          </div>
        </div>
        <div className="footer-mark" aria-hidden="true">
          <Wordmark />
        </div>
        <div className="container footer-bottom mono">
          <span>© 2026 MockerAI</span>
          <span>Local-first. Your data stays on this computer.</span>
        </div>
      </footer>
    </div>
  )
}
