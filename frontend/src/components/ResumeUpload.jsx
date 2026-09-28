import { useEffect, useRef, useState } from 'react'
import { FileTextIcon, UploadSimpleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Working } from './Working'
import { api } from '../lib/api'
import { MAX_RESUME_MB, RESUME_EXTENSIONS } from '../lib/config'

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
      const response = await fetch('/sample-resume.txt')
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
    </section>
  )
}
