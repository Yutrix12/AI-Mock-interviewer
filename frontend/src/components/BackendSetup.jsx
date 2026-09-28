import { ArrowClockwiseIcon } from '@phosphor-icons/react'
import { API_URL } from '../lib/config'

const REPO_URL = 'https://github.com/Yutrix12/AI-Mock-interviewer'

const COMMANDS = `# 1. Install Ollama from ollama.com, then pull the model
ollama pull llama3.1:8b

# 2. Get the code and install the backend
git clone ${REPO_URL}.git
cd AI-Mock-interviewer
pip install -r backend/requirements.txt

# 3. Start it, and keep this terminal open
python -m backend`

// Shown in place of the upload box when the local backend can't be reached.
// `status` is 'offline' (no server) or 'no-model' (server up, Ollama or the model missing).
export function BackendSetup({ status, model, checking, onRetry }) {
  const noModel = status === 'no-model'

  return (
    <section className="backend-setup panel bezel enter" style={{ '--i': 2 }} aria-labelledby="backend-setup-title">
      <span className="eyebrow">{noModel ? '/ Model missing' : '/ Local backend offline'}</span>
      <h2 id="backend-setup-title" className="backend-setup-title">
        {noModel ? 'Start Ollama to continue' : 'Run the backend on your computer'}
      </h2>

      {noModel ? (
        <p className="backend-setup-text">
          The backend is running, but it can’t use <code translate="no">{model}</code>. Start Ollama and run{' '}
          <code translate="no">ollama pull {model}</code>, then check again.
        </p>
      ) : (
        <>
          <p className="backend-setup-text">
            MockerAI runs its models on your machine, so this page talks to a server at <code translate="no">{API_URL}</code>{' '}
            instead of the cloud. Your resume and answers never leave your computer. Setup takes a few minutes and
            needs Python 3.11+.
          </p>
          <pre className="backend-setup-code" tabIndex={0} aria-label="Setup commands" translate="no">
            <code>{COMMANDS}</code>
          </pre>
          <p className="backend-setup-note">
            If your browser asks to let this site access devices on your local network, choose Allow. If it still
            won’t connect, try Chrome, Edge or Firefox. Full instructions are in the{' '}
            <a href={`${REPO_URL}#running-it`} target="_blank" rel="noreferrer">
              README
            </a>
            .
          </p>
        </>
      )}

      <div className="backend-setup-status">
        <p aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          {checking ? 'Checking…' : 'Waiting for the backend. This page connects on its own once it starts.'}
        </p>
        <button type="button" className="btn btn-secondary btn-has-icon" onClick={onRetry} disabled={checking}>
          <ArrowClockwiseIcon aria-hidden="true" />
          <span>Check again</span>
        </button>
      </div>
    </section>
  )
}
