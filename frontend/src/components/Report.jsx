import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowCounterClockwiseIcon, PrinterIcon } from '@phosphor-icons/react'
import DimensionScores from './DimensionScores'
import { api } from '../lib/api'
import { DIFFICULTIES, DIMENSIONS, QUESTION_TYPE_LABELS } from '../lib/config'
import { formatScore, verdictFor } from '../lib/format'

function average(values) {
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null
}

function PointList({ id, title, items, tone }) {
  if (!items?.length) return null
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="list-title">
        {title}
      </h2>
      <ul className={`point-list${tone === 'good' ? ' point-list-good' : ''}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

export default function Report({ profile, track, difficulty, results, onPracticeAgain, onChooseAnother }) {
  const answered = results.filter(Boolean)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const headingRef = useRef(null)

  // Shown immediately; the server's narrative fills in when it arrives.
  const localOverall = average(answered.map((r) => r.evaluation.score))
  const localDims = Object.fromEntries(DIMENSIONS.map((d) => [d.id, average(answered.map((r) => r.evaluation.scores[d.id]))]))

  const fetchReport = useCallback(
    (signal) => {
      const items = answered.map(({ question, transcript, evaluation }) => ({ question, transcript, evaluation }))
      api
        .report({ profile, track, difficulty, items }, signal)
        .then((data) => setReport(data.report))
        .catch((err) => {
          if (err.name !== 'AbortError') setError(err.message)
        })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- results are fixed once the report opens
    [],
  )

  const retry = () => {
    setError(null)
    fetchReport()
  }

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
    if (!answered.length) return
    const controller = new AbortController()
    fetchReport(controller.signal)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on open
  }, [])

  const overall = report?.overall_score ?? localOverall
  const verdict = verdictFor(overall, 'interview')
  const level = DIFFICULTIES.find((d) => d.id === difficulty)?.label.toLowerCase()

  return (
    <article className="report" aria-labelledby="report-title">
      <header className="report-head enter">
        <div>
          <span className="eyebrow">/ Report</span>
          <h1 id="report-title" ref={headingRef} tabIndex={-1} className="page-title">
            How it <em>went</em>.
          </h1>
          <p className="page-sub">
            {track.title}, {level} level, {answered.length} of {results.length} questions answered
          </p>
        </div>
        {overall != null && (
          <div className="report-score">
            <div className="score" data-tone={verdict.tone}>
              <span className="score-value">{formatScore(overall)}</span>
              <span className="score-max mono">/10</span>
            </div>
            <p className="verdict" data-tone={verdict.tone}>
              {verdict.label}
            </p>
          </div>
        )}
      </header>

      {answered.length === 0 ? (
        <p className="report-empty panel">You didn’t answer any questions, so there’s nothing to score yet.</p>
      ) : (
        <>
          <DimensionScores scores={report?.dimension_scores ?? localDims} className="dimensions-lg enter" />

          <section className="report-summary panel bezel enter" style={{ '--i': 1 }} aria-busy={!report && !error}>
            {report ? (
              <>
                <p className="report-summary-text">{report.summary}</p>
                <div className="feedback-columns">
                  <PointList id="r-strengths" title="Strengths" items={report.strengths} tone="good" />
                  <PointList id="r-focus" title="Focus areas" items={report.focus_areas} />
                </div>
                {report.next_steps.length > 0 && (
                  <section className="improve" aria-labelledby="r-next">
                    <h2 id="r-next" className="improve-title">
                      Practice plan for this week
                    </h2>
                    <ol className="improve-list">
                      {report.next_steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </section>
                )}
              </>
            ) : error ? (
              <div className="report-error" role="alert">
                <p>{error}</p>
                <button type="button" className="btn btn-secondary" onClick={retry}>
                  <ArrowCounterClockwiseIcon aria-hidden="true" weight="bold" />
                  <span>Retry summary</span>
                </button>
              </div>
            ) : (
              <div className="report-loading">
                <p className="stage-status" role="status">
                  Writing your summary…
                </p>
                <div className="skeleton" aria-hidden="true">
                  <span className="sk sk-line" />
                  <span className="sk sk-line" />
                  <span className="sk sk-line" style={{ width: '64%' }} />
                </div>
              </div>
            )}
          </section>

          <section className="report-questions enter" style={{ '--i': 2 }} aria-labelledby="r-questions">
            <h2 id="r-questions" className="section-title">
              Question by question
            </h2>
            <ol className="report-list">
              {results.map((r, i) => (
                <li key={i} className="report-item">
                  {r ? (
                    <details>
                      <summary>
                        <span className="report-item-index mono">{i + 1}</span>
                        <span className="report-item-title">
                          <strong>{r.question.topic}</strong>
                          <span>{QUESTION_TYPE_LABELS[r.question.type]}</span>
                        </span>
                        <span className="report-item-score mono" data-tone={verdictFor(r.evaluation.score).tone}>
                          {formatScore(r.evaluation.score)}
                        </span>
                      </summary>
                      <div className="report-item-body">
                        <p className="report-q">“{r.question.text}”</p>
                        <p>{r.evaluation.feedback}</p>
                        <blockquote className="report-transcript">“{r.transcript}”</blockquote>
                      </div>
                    </details>
                  ) : (
                    <div className="report-skipped">
                      <span className="report-item-index mono">{i + 1}</span>
                      <span className="report-item-title">
                        <strong>Skipped</strong>
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      <div className="stage-controls stage-controls-row report-actions">
        <button type="button" className="btn btn-primary" onClick={onPracticeAgain}>
          <ArrowCounterClockwiseIcon aria-hidden="true" weight="bold" />
          <span>Practice again</span>
        </button>
        <button type="button" className="btn btn-secondary" onClick={onChooseAnother}>
          Choose another interview
        </button>
        <button type="button" className="link-wipe" onClick={() => window.print()}>
          <span>Print or save as PDF</span>
          <PrinterIcon aria-hidden="true" />
        </button>
      </div>
    </article>
  )
}
