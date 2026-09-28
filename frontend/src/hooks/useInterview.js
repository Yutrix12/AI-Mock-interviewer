import { useCallback, useEffect, useRef, useState } from 'react'
import { useRecorder } from './useRecorder'
import { api } from '../lib/api'
import { ANSWER_LIMIT_SECONDS } from '../lib/config'
import { cancelSpeech, speak } from '../lib/speech'

const ERRORS = {
  mic: {
    title: 'Microphone blocked',
    message: 'MockerAI needs your microphone to hear your answer. Allow access from the icon in your browser’s address bar, or type your answer instead.',
  },
  no_speech: {
    title: 'No speech detected',
    message: 'The recording came back empty. Check that your microphone is unmuted and answer again.',
  },
  answer_too_short: {
    title: 'Answer too short to score',
    message: 'Give a full answer of at least a few sentences, then submit again.',
  },
  transcriber_unavailable: {
    title: 'Speech recognition isn’t ready',
    message: 'Whisper is still loading or failed to start. Wait a moment, or type your answer instead.',
  },
  llm_unavailable: {
    title: 'Local model unavailable',
    message: 'Your answer couldn’t be scored because Ollama isn’t responding. Start Ollama, then try again.',
  },
  llm_bad_output: {
    title: 'Scoring failed',
    message: 'The model returned a response that couldn’t be read. Try again; it usually works on the next attempt.',
  },
}

function toError(err) {
  const known = ERRORS[err.code]
  if (known) return known
  return { title: err.code === 'network' ? 'Can’t reach the server' : 'Something went wrong', message: err.message }
}

// Runs one interview: asking, recording or typing, scoring and feedback.
export function useInterview({ questions, context, voiceOn, orbRef, greeting }) {
  const [phase, setPhase] = useState('asking') // asking | starting | listening | typing | processing | feedback | error
  const [qIndex, setQIndex] = useState(0)
  const [results, setResults] = useState(() => questions.map(() => null))
  const [error, setError] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [draft, setDraft] = useState('')
  const [answerMode, setAnswerMode] = useState('voice')

  // Async callbacks (speech, timers, fetch) read these instead of stale state.
  const phaseRef = useRef(phase)
  const qIndexRef = useRef(0)
  const voiceOnRef = useRef(voiceOn)
  const abortRef = useRef(null)
  const recorder = useRecorder(orbRef)

  useEffect(() => {
    voiceOnRef.current = voiceOn
    if (!voiceOn) cancelSpeech()
  }, [voiceOn])

  const setPhaseNow = useCallback((next) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const fail = useCallback((err) => {
    setError(err)
    setPhaseNow('error')
  }, [setPhaseNow])

  const startListening = useCallback(async () => {
    if (phaseRef.current !== 'asking') return
    setPhaseNow('starting')
    setAnswerMode('voice')
    cancelSpeech()
    try {
      await recorder.start()
    } catch (err) {
      console.error('Microphone access failed:', err)
      fail(ERRORS.mic)
      return
    }
    setElapsed(0)
    setPhaseNow('listening')
  }, [fail, recorder, setPhaseNow])

  // Reads the question aloud, then starts recording when the voice finishes.
  const speakQuestion = useCallback((index) => {
    const text = index === 0 && greeting ? `${greeting} ${questions[0].text}` : questions[index].text
    speak(text, {
      onEnd: () => {
        if (qIndexRef.current === index) startListening()
      },
    })
  }, [greeting, questions, startListening])

  const askQuestion = useCallback((index, { withVoice = voiceOnRef.current } = {}) => {
    abortRef.current?.abort()
    recorder.cancel()
    cancelSpeech()
    qIndexRef.current = index
    setQIndex(index)
    setError(null)
    setElapsed(0)
    setDraft('')
    setPhaseNow('asking')
    if (withVoice) speakQuestion(index)
  }, [recorder, setPhaseNow, speakQuestion])

  const submit = useCallback(async (payload, index) => {
    const controller = new AbortController()
    abortRef.current = controller
    const isStale = () => phaseRef.current !== 'processing' || qIndexRef.current !== index

    let data
    try {
      data = await api.answer({ context: { ...context, question: questions[index] }, ...payload }, controller.signal)
    } catch (err) {
      if (err.name === 'AbortError' || isStale()) return
      fail(toError(err))
      return
    }
    if (isStale()) return

    setResults((prev) =>
      prev.map((r, i) =>
        i === index ? { question: questions[index], transcript: data.transcript, evaluation: data.evaluation, mode: payload.audio ? 'voice' : 'text' } : r,
      ),
    )
    setDraft('')
    setPhaseNow('feedback')

    if (voiceOnRef.current) {
      speak(`You scored ${data.evaluation.score} out of 10. ${data.evaluation.feedback}`)
    }
  }, [context, fail, questions, setPhaseNow])

  const finishAnswer = useCallback(async () => {
    if (phaseRef.current !== 'listening') return
    setPhaseNow('processing')
    const audio = await recorder.stop()
    if (audio) submit({ audio }, qIndexRef.current)
  }, [recorder, setPhaseNow, submit])

  const startTyping = useCallback(() => {
    cancelSpeech()
    recorder.cancel()
    setAnswerMode('text')
    setPhaseNow('typing')
  }, [recorder, setPhaseNow])

  const submitText = useCallback((text) => {
    if (phaseRef.current !== 'typing') return
    setPhaseNow('processing')
    submit({ text }, qIndexRef.current)
  }, [setPhaseNow, submit])

  // After an error, go back to where the candidate was, keeping any typed draft.
  const retry = useCallback(() => {
    if (answerMode === 'text') {
      setError(null)
      setPhaseNow('typing')
    } else {
      askQuestion(qIndexRef.current, { withVoice: false })
    }
  }, [answerMode, askQuestion, setPhaseNow])

  // Recording timer. Stops the answer automatically at the limit.
  useEffect(() => {
    if (phase !== 'listening') return
    const startedAt = performance.now()
    const id = setInterval(() => {
      const seconds = Math.floor((performance.now() - startedAt) / 1000)
      setElapsed(Math.min(seconds, ANSWER_LIMIT_SECONDS))
      if (seconds >= ANSWER_LIMIT_SECONDS) finishAnswer()
    }, 200)
    return () => clearInterval(id)
  }, [phase, finishAnswer])

  // Warn before leaving mid-answer.
  const hasWorkInFlight = phase === 'listening' || phase === 'processing' || (phase === 'typing' && draft.trim() !== '')
  useEffect(() => {
    if (!hasWorkInFlight) return
    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasWorkInFlight])

  // State already starts on question 1; on mount only the voice needs starting.
  useEffect(() => {
    if (voiceOnRef.current) speakQuestion(0)
    return () => {
      abortRef.current?.abort()
      cancelSpeech()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per interview
  }, [])

  return {
    phase,
    qIndex,
    results,
    error,
    elapsed,
    draft,
    setDraft,
    busy: phase === 'starting' || phase === 'listening' || phase === 'processing',
    actions: {
      askQuestion,
      startListening,
      finishAnswer,
      startTyping,
      submitText,
      retry,
      replay: () => askQuestion(qIndexRef.current, { withVoice: true }),
    },
  }
}
