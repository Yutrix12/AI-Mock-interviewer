import { API_URL } from './config'

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function request(path, { json, form, signal, method = 'POST' } = {}) {
  const init = { method, signal }
  if (json !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(json)
  } else if (form) {
    init.body = form
  }

  let response
  try {
    response = await fetch(`${API_URL}${path}`, init)
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(
      'network',
      'Can’t reach the MockerAI server. Start it with “python -m backend” from the project folder, then try again.',
    )
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(
      body.error?.code ?? 'server',
      body.error?.message ?? `The server returned an error (${response.status}).`,
      response.status,
    )
  }
  return body
}

export const api = {
  parseResume(file, signal) {
    const form = new FormData()
    form.append('resume', file)
    return request('/api/resume', { form, signal })
  },

  tracks(profile, signal) {
    return request('/api/tracks', { json: { profile }, signal })
  },

  questions({ profile, trackId, difficulty, count }, signal) {
    return request('/api/questions', { json: { profile, track_id: trackId, difficulty, count }, signal })
  },

  answer({ context, audio, text }, signal) {
    const form = new FormData()
    form.append('context', JSON.stringify(context))
    if (audio) form.append('audio', audio, 'answer.webm')
    else form.append('text', text)
    return request('/api/answer', { form, signal })
  },

  report({ profile, track, difficulty, items }, signal) {
    return request('/api/report', { json: { profile, track, difficulty, items }, signal })
  },
}
