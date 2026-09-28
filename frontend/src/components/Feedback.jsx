import { ArrowCounterClockwiseIcon, ArrowRightIcon } from '@phosphor-icons/react'
import DimensionScores from './DimensionScores'
import { formatScore, verdictFor } from '../lib/format'

export default function Feedback({ headingRef, result, isLast, onRetry, onNext }) {
  const { question, transcript, evaluation, mode } = result
  const verdict = verdictFor(evaluation.score)

  return (
    <div className="feedback enter">
      <header className="feedback-head feedback-scored">
        <div className="score" data-tone={verdict.tone}>
          <span className="score-value">{formatScore(evaluation.score)}</span>
          <span className="score-max mono">/10</span>
        </div>
        <div>
          <p className="feedback-question">{question.topic}</p>
          <h1 id="stage-heading" ref={headingRef} tabIndex={-1} className="verdict" data-tone={verdict.tone}>
            {verdict.label}
          </h1>
        </div>
      </header>

      <DimensionScores scores={evaluation.scores} />

      <p className="feedback-text">{evaluation.feedback}</p>

      {(evaluation.strengths.length > 0 || evaluation.improvements.length > 0) && (
        <div className="feedback-columns">
          {evaluation.strengths.length > 0 && (
            <section aria-labelledby="fb-strengths">
              <h2 id="fb-strengths" className="list-title">What worked</h2>
              <ul className="point-list point-list-good">
                {evaluation.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
          {evaluation.improvements.length > 0 && (
            <section aria-labelledby="fb-improve">
              <h2 id="fb-improve" className="list-title">What to improve</h2>
              <ul className="point-list">
                {evaluation.improvements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {evaluation.missed_points.length > 0 && (
        <section className="improve" aria-labelledby="fb-missed">
          <h2 id="fb-missed" className="improve-title">Key points a strong answer would cover</h2>
          <ul className="improve-list">
            {evaluation.missed_points.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <details className="transcript">
        <summary>{mode === 'text' ? 'Your answer' : 'Your answer, as transcribed'}</summary>
        <blockquote>“{transcript}”</blockquote>
      </details>

      <div className="stage-controls stage-controls-row feedback-actions">
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          <ArrowCounterClockwiseIcon aria-hidden="true" weight="bold" />
          <span>Try again</span>
        </button>
        <button type="button" className="btn btn-primary btn-has-icon" onClick={onNext}>
          <span>{isLast ? 'See report' : 'Next question'}</span>
          <span className="btn-icon" aria-hidden="true">
            <ArrowRightIcon weight="bold" />
          </span>
        </button>
      </div>
    </div>
  )
}
