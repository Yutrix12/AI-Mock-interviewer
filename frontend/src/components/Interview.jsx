import { useEffect, useRef } from 'react'
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  KeyboardIcon,
  MicrophoneIcon,
  PaperPlaneRightIcon,
  SpeakerHighIcon,
  StopIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import Orb from './Orb'
import Feedback from './Feedback'
import { useInterview } from '../hooks/useInterview'
import { ANSWER_LIMIT_SECONDS, QUESTION_TYPE_LABELS } from '../lib/config'
import { formatClock, formatScore } from '../lib/format'

function Rail({ questions, qIndex, results, busy, onJump }) {
  return (
    <nav className="rail" aria-label="Questions">
      <ol className="rail-list">
        {questions.map((q, i) => {
          const result = results[i]
          const current = i === qIndex
          return (
            <li key={q.id}>
              <button
                type="button"
                className="rail-item"
                aria-current={current ? 'step' : undefined}
                disabled={busy && !current}
                onClick={() => !current && onJump(i)}
              >
                <span className="rail-index mono" aria-hidden="true">
                  {result ? <CheckIcon weight="bold" /> : i + 1}
                </span>
                <span className="rail-title">{q.topic}</span>
                {result && (
                  <span className="rail-score mono">
                    {formatScore(result.evaluation.score)}
                    <span className="visually-hidden"> out of 10</span>
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Skeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      <div className="skeleton-row">
        <span className="sk sk-score" />
        <span className="sk sk-line" style={{ width: '38%' }} />
      </div>
      <span className="sk sk-line" />
      <span className="sk sk-line" />
      <span className="sk sk-line" style={{ width: '72%' }} />
      <span className="sk sk-block" />
    </div>
  )
}

function TypedAnswer({ draft, setDraft, onSubmit, onVoice, textareaRef }) {
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0
  const submit = (event) => {
    event.preventDefault()
    if (words >= 3) onSubmit(draft)
  }
  return (
    <form className="typed-answer" onSubmit={submit}>
      <label className="field-label" htmlFor="typed-answer">
        Your answer
      </label>
      <textarea
        id="typed-answer"
        ref={textareaRef}
        name="answer"
        rows={7}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
        }}
        placeholder="Answer as you would out loud…"
        autoComplete="off"
      />
      <div className="typed-meta">
        <span className="mono">{words} words</span>
        <span>Ctrl&nbsp;+&nbsp;Enter to submit</span>
      </div>
      <div className="stage-controls stage-controls-row">
        <button type="submit" className="btn btn-primary" disabled={words < 3}>
          <PaperPlaneRightIcon aria-hidden="true" weight="fill" />
          <span>Submit answer</span>
        </button>
        <button type="button" className="btn btn-link" onClick={onVoice}>
          <MicrophoneIcon aria-hidden="true" />
          <span>Answer by voice</span>
        </button>
      </div>
    </form>
  )
}

export default function Interview({ questions, context, voiceOn, greeting, onComplete, onExit }) {
  const orbRef = useRef(null)
  const headingRef = useRef(null)
  const actionRef = useRef(null)
  const textareaRef = useRef(null)
  const { phase, qIndex, results, error, elapsed, draft, setDraft, busy, actions } = useInterview({
    questions,
    context,
    voiceOn,
    orbRef,
    greeting,
  })

  const question = questions[qIndex]
  const isLast = qIndex === questions.length - 1

  // Move focus with the flow so keyboard and screen reader users follow along.
  useEffect(() => {
    if (phase === 'asking' || phase === 'listening') actionRef.current?.focus({ preventScroll: true })
    else if (phase === 'typing') textareaRef.current?.focus({ preventScroll: true })
    else if (phase !== 'starting') headingRef.current?.focus({ preventScroll: true })
  }, [phase, qIndex])

  const next = () => {
    if (isLast) onComplete(results)
    else actions.askQuestion(qIndex + 1)
  }

  const orbState =
    phase === 'asking' && voiceOn ? 'speaking' : phase === 'listening' ? 'listening' : phase === 'processing' ? 'thinking' : 'idle'

  const status = {
    asking: voiceOn ? 'Interviewer is asking…' : QUESTION_TYPE_LABELS[question.type],
    starting: 'Starting microphone…',
    listening: 'Recording',
    typing: QUESTION_TYPE_LABELS[question.type],
    processing: 'Scoring your answer…',
    feedback: 'Answer scored',
    error: 'Something went wrong',
  }[phase]

  const showQuestion = phase === 'asking' || phase === 'starting' || phase === 'listening' || phase === 'typing'

  return (
    <div className="session">
      <Rail questions={questions} qIndex={qIndex} results={results} busy={busy} onJump={(i) => actions.askQuestion(i)} />

      <section className="stage bezel" aria-labelledby="stage-heading" data-phase={phase}>
        <div className="stage-top">
          <p className="stage-status" role="status" aria-live="polite">
            {phase === 'listening' && <span className="rec-dot" aria-hidden="true" />}
            <span>{status}</span>
          </p>
          <span className="stage-count mono">
            {qIndex + 1}/{questions.length}
          </span>
        </div>

        {showQuestion && (
          <div className={`stage-live enter${phase === 'typing' ? ' is-typing' : ''}`} key={qIndex}>
            {phase !== 'typing' && <Orb state={orbState} orbRef={orbRef} className="orb-stage" />}
            <h1 id="stage-heading" ref={headingRef} tabIndex={-1} className="stage-question">
              “{question.text}”
            </h1>

            {phase === 'typing' && (
              <TypedAnswer
                draft={draft}
                setDraft={setDraft}
                textareaRef={textareaRef}
                onSubmit={actions.submitText}
                onVoice={() => actions.askQuestion(qIndex, { withVoice: false })}
              />
            )}

            {phase === 'listening' && (
              <div className="stage-controls">
                <div className="timer" role="timer" aria-label={`${ANSWER_LIMIT_SECONDS - elapsed} seconds left`}>
                  <span className="mono">{formatClock(elapsed)}</span>
                  <span className="timer-limit mono">/ {formatClock(ANSWER_LIMIT_SECONDS)}</span>
                </div>
                <div className="time-line" aria-hidden="true">
                  <span style={{ transform: `scaleX(${elapsed / ANSWER_LIMIT_SECONDS})` }} />
                </div>
                <button ref={actionRef} type="button" className="btn btn-primary btn-lg" onClick={actions.finishAnswer}>
                  <StopIcon aria-hidden="true" weight="fill" />
                  <span>Finish answer</span>
                </button>
              </div>
            )}

            {(phase === 'asking' || phase === 'starting') && (
              <div className="stage-controls">
                <button
                  ref={actionRef}
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={actions.startListening}
                  disabled={phase === 'starting'}
                >
                  <MicrophoneIcon aria-hidden="true" weight="fill" />
                  <span>{phase === 'starting' ? 'Starting…' : voiceOn ? 'Skip to answer' : 'Start answer'}</span>
                </button>
                <div className="stage-secondary">
                  <button type="button" className="btn btn-link" onClick={actions.startTyping} disabled={phase === 'starting'}>
                    <KeyboardIcon aria-hidden="true" />
                    <span>Type instead</span>
                  </button>
                  {voiceOn && (
                    <button type="button" className="btn btn-link" onClick={actions.replay} disabled={phase === 'starting'}>
                      <SpeakerHighIcon aria-hidden="true" />
                      <span>Replay question</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'processing' && (
          <div className="stage-processing enter">
            <h1 id="stage-heading" ref={headingRef} tabIndex={-1} className="stage-heading-sm">
              {question.topic}
            </h1>
            <Skeleton />
          </div>
        )}

        {phase === 'feedback' && results[qIndex] && (
          <Feedback
            headingRef={headingRef}
            result={results[qIndex]}
            isLast={isLast}
            onRetry={() => actions.askQuestion(qIndex, { withVoice: false })}
            onNext={next}
          />
        )}

        {phase === 'error' && error && (
          <div className="stage-error enter" role="alert">
            <WarningCircleIcon className="error-icon" aria-hidden="true" />
            <h1 id="stage-heading" ref={headingRef} tabIndex={-1} className="stage-heading-sm">
              {error.title}
            </h1>
            <p className="error-message">{error.message}</p>
            <div className="stage-controls stage-controls-row">
              <button type="button" className="btn btn-primary" onClick={actions.retry}>
                <ArrowCounterClockwiseIcon aria-hidden="true" weight="bold" />
                <span>Try again</span>
              </button>
              <button type="button" className="btn btn-link" onClick={onExit}>
                End interview
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
