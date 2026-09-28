import { useEffect, useRef, useState } from 'react'
import { FileTextIcon, UploadSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { BackendSetup } from './BackendSetup'
import { Working } from './Working'
import { api } from '../lib/api'
import { MAX_RESUME_MB, RESUME_EXTENSIONS } from '../lib/config'

// How often to re-check while the backend is down, so the page connects once it starts.
const RETRY_MS = 4000

// Polls /api/health until the backend and its model are usable.
// state: 'checking' | 'ready' | 'offline' | 'no-model'
function useBackendStatus() {
  const [status, setStatus] = useState({ state: 'checking', model: null, checking: true })
  const [attempt, setAttempt] = useState(0) // bumped by "Check again" to restart polling

  useEffect(() => {
    const controller = new AbortController()
    let timer
    const check = async () => {
      try {
        const { llm } = await api.health(controller.signal)
        const usable = llm.reachable && llm.model_available !== false
        setStatus((s) => ({
          state: usable ? 'ready' : 'no-model',
          model: llm.model,
          checking: false,
          // Set when the backend comes up after being unreachable, so the change can be announced.
          reconnected: usable && (s.state === 'offline' || s.state === 'no-model'),
        }))
        if (!usable) timer = setTimeout(check, RETRY_MS)
      } catch (err) {
        if (err.name === 'AbortError') return
        setStatus({ state: 'offline', model: null, checking: false })
        timer = setTimeout(check, RETRY_MS)
      }
    }
    timer = setTimeout(check, 0)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [attempt])

  const retry = () => {
    setStatus((s) => ({ ...s, checking: true }))
    setAttempt((n) => n + 1)
  }

  return { ...status, retry }
}

function validate(file) {
  const name = file.name.toLowerCase()
  if (!RESUME_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return 'That file type isn’t supported. Upload a PDF, DOCX or TXT file.'
  }
  if (file.size > MAX_RESUME_MB * 1024 * 1024) {
    return `That file is larger than ${MAX_RESUME_MB} MB. Export a smaller copy and try again.`
  }
  return null
}

export default function ResumeUpload({ onParsed }) {
  const [parsing, setParsing] = useState(null) // file name while parsing
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const abortRef = useRef(null)
  const backend = useBackendStatus()

  useEffect(() => () => abortRef.current?.abort(), [])

  const parse = async (file) => {
    const problem = validate(file)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setParsing(file.name)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const data = await api.parseResume(file, controller.signal)
      onParsed(data)
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message)
      setParsing(null)
    }
  }

  const useSample = async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}sample-resume.txt`)
      const blob = await response.blob()
      parse(new File([blob], 'sample-resume.txt', { type: 'text/plain' }))
    } catch {
      setError('The sample resume couldn’t be loaded.')
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
    setParsing(null)
  }

  if (parsing) {
    return (
      <div className="page-narrow">
        <Working
          title="Reading your resume…"
          detail={`The local model is pulling skills, roles and projects out of ${parsing}. This usually takes 30 to 60 seconds.`}
          onCancel={cancel}
        />
      </div>
    )
  }

  return (
    <section className="page-narrow upload" aria-labelledby="upload-title">
      <span className="eyebrow enter">/ Upload</span>
      <h1 id="upload-title" className="page-title enter">
        Start with your <em>resume</em>.
      </h1>
      <p className="page-sub enter" style={{ '--i': 1 }}>
        MockerAI reads your skills and projects, then suggests interviews that match them.
      </p>

      <p className="visually-hidden" role="status">
        {backend.reconnected ? 'Backend connected. You can upload your resume now.' : ''}
      </p>

      {backend.state === 'offline' || backend.state === 'no-model' ? (
        <BackendSetup status={backend.state} model={backend.model} checking={backend.checking} onRetry={backend.retry} />
      ) : (
        <UploadForm
          dragging={dragging}
          setDragging={setDragging}
          parse={parse}
          error={error}
          useSample={useSample}
        />
      )}
    </section>
  )
}

function UploadForm({ dragging, setDragging, parse, error, useSample }) {
  return (
    <>
      <label
        className="dropzone enter"
        style={{ '--i': 2 }}
        data-dragging={dragging || undefined}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files?.[0]
          if (file) parse(file)
        }}
      >
        <input
          type="file"
          name="resume"
          accept={RESUME_EXTENSIONS.join(',')}
          className="visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) parse(file)
          }}
        />
        <UploadSimpleIcon className="dropzone-icon" aria-hidden="true" />
        <span className="dropzone-title">
          Drop it here, or <span className="dropzone-link">browse files</span>
        </span>
        <span className="dropzone-hint">
          PDF, DOCX or TXT, up to {MAX_RESUME_MB}&nbsp;MB
        </span>
      </label>

      {error && (
        <p className="inline-error" role="alert">
          <WarningCircleIcon aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      <div className="upload-footer enter" style={{ '--i': 3 }}>
        <button type="button" className="link-wipe" onClick={useSample}>
          <span>No resume handy? Try a sample</span>
          <FileTextIcon aria-hidden="true" />
        </button>
        <p className="privacy-note-inline">Your resume is processed on this computer and never uploaded to a cloud service.</p>
      </div>
    </>
  )
}
