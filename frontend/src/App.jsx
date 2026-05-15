import React, { useState, useRef, useEffect } from 'react'
import './App.css'

const INTERVIEW_QUESTIONS = [
  "Hello! Welcome to your mock interview. To start off, could you please introduce yourself and tell me a bit about your recent projects?",
  "Tell me about a time you solved a complex technical problem.",
  "Describe a situation where you had to work with a difficult team member.",
  "What is your approach to learning a new programming language or framework?"
]

const HERO_WORDS = ["Job Interviews", "Practice", "Made Easy"]

function App() {
  const [appState, setAppState] = useState('idle')
  const [currentQIndex, setCurrentQIndex] = useState(0)

  const [transcript, setTranscript] = useState("")
  const [evaluation, setEvaluation] = useState(null)
  const [heroWordIndex, setHeroWordIndex] = useState(0)

  const [recordingTime, setRecordingTime] = useState(0)
  const timerIntervalRef = useRef(null)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const silenceTimerRef = useRef(null)
  const utteranceRef = useRef(null)

  useEffect(() => {
    window.speechSynthesis.getVoices()
    const interval = setInterval(() => {
      setHeroWordIndex((prev) => (prev + 1) % HERO_WORDS.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [])

  const getProfessionalVoice = () => {
    const voices = window.speechSynthesis.getVoices()
    const preferredVoices = ["Google UK English Male", "Microsoft Mark", "Google US English", "Apple Samantha"]
    for (let name of preferredVoices) {
      const voice = voices.find(v => v.name.includes(name))
      if (voice) return voice
    }
    return voices.find(v => v.lang.startsWith('en')) || null
  }

  const readFeedback = (score, feedbackText, missingContext) => {
    window.speechSynthesis.cancel()
    let textToRead = `Your score is ${score} out of 10. ${feedbackText}`
    const utterance = new SpeechSynthesisUtterance(textToRead)
    const voice = getProfessionalVoice()
    if (voice) utterance.voice = voice
    utteranceRef.current = utterance
    setTimeout(() => { window.speechSynthesis.speak(utterance) }, 50)
  }

  const askQuestion = (index) => {
    window.speechSynthesis.cancel()
    setAppState('speaking')
    setTranscript("")
    setEvaluation(null)
    setRecordingTime(0)

    const questionText = INTERVIEW_QUESTIONS[index]
    const utterance = new SpeechSynthesisUtterance(questionText)
    const voice = getProfessionalVoice()
    if (voice) utterance.voice = voice

    utteranceRef.current = utterance
    utterance.onend = () => startListening()
    utterance.onerror = (e) => {
      console.error("Browser TTS Error:", e)
      startListening()
    }

    setTimeout(() => { window.speechSynthesis.speak(utterance) }, 50)
  }

  const startListening = async () => {
    try {
      window.speechSynthesis.cancel()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      mediaRecorderRef.current.onstop = handleAudioStop
      audioChunksRef.current = []
      mediaRecorderRef.current.start()
      setAppState('listening')

      setRecordingTime(0)
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      silenceTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          stopListening()
        }
      }, 20000)
    } catch (err) {
      console.error("Microphone access denied:", err)
      alert("Please allow microphone access.")
      setAppState('idle')
    }
  }

  const stopListening = () => {
    if (mediaRecorderRef.current && appState === 'listening') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      clearTimeout(silenceTimerRef.current)
      clearInterval(timerIntervalRef.current)
    }
  }

  const handleAudioStop = async () => {
    setAppState('processing')
    clearInterval(timerIntervalRef.current)

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')
    formData.append('question', INTERVIEW_QUESTIONS[currentQIndex])

    try {
      const response = await fetch('http://127.0.0.1:5000/api/evaluate', {
        method: 'POST', body: formData,
      })
      const data = await response.json()

      if (response.ok) {
        if (!data.transcript || data.transcript.trim() === "") {
          alert("I didn't hear anything. Let's try that question again.")
          askQuestion(currentQIndex)
          return;
        }
        setTranscript(data.transcript)
        setEvaluation(data.evaluation)
        setAppState('feedback')

        if (data.evaluation && !data.evaluation.error) {
          readFeedback(data.evaluation.score, data.evaluation.feedback, data.evaluation.missing_context)
        }
      } else {
        alert("Backend Error: " + data.error)
        setAppState('idle')
      }
    } catch (err) {
      console.error("Network error:", err)
      alert("Could not connect to backend. Make sure your Python Flask server is running!")
      setAppState('idle')
    }
  }

  const nextQuestion = () => {
    window.speechSynthesis.cancel()
    const nextIndex = (currentQIndex + 1) % INTERVIEW_QUESTIONS.length
    setCurrentQIndex(nextIndex)
    askQuestion(nextIndex)
  }

  const renderLLMItem = (item) => {
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item !== null) {
      if (item.question) return `Clarification: ${item.question} (Expected: ${item.expected_answer || 'N/A'})`;
      return Object.values(item).join(": ");
    }
    return "Specific area for improvement provided.";
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="app-container">
      {/* The big pink/purple glowing background from the video */}
      <div className="bg-blob"></div>

      <nav className="navbar">
        <div className="nav-logo">
          <div className="logo-icon"></div>
          <span style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.5px' }}>MockerAI.</span>
        </div>
      </nav>

      <main className="main-content">

        {appState === 'idle' && (
          <div className="hero-section fade-in">
            <h1 className="hero-title">
              AI Practice Studio for <br />
              <span className="hero-dynamic-text">{HERO_WORDS[heroWordIndex]}</span>
            </h1>
            <p className="hero-subtitle">
              Practice real scenarios, improve communication, get instant feedback
            </p>

            {/* NEW: The central floating mockup window seen in the video */}

            <div className="hero-actions">
              <button className="btn-primary" onClick={() => askQuestion(currentQIndex)}>
                Start Practice →
              </button>
            </div>
          </div>
        )}

        {/* ... (The rest of the Active App states remain exactly the same functionally) ... */}
        {appState !== 'idle' && (
          <div className="studio-card slide-up">

            <div className="studio-header">
              <div className="status-badge">
                {appState === 'speaking' ? '🔊 AI Speaking' :
                  appState === 'listening' ? '🎙️ Recording Audio' :
                    appState === 'processing' ? '⚙️ Analyzing' : '📊 Results'}
              </div>
              <div className="question-counter">Question {currentQIndex + 1} of {INTERVIEW_QUESTIONS.length}</div>
            </div>

            <div className="studio-body">
              {appState === 'speaking' && (
                <div className="state-container fade-in">
                  <div className="avatar-circle pulse-avatar">AI</div>
                  <h3 className="question-text">"{INTERVIEW_QUESTIONS[currentQIndex]}"</h3>
                  <button className="btn-ghost mt-4" onClick={startListening}>Skip Audio & Answer</button>
                </div>
              )}

              {appState === 'listening' && (
                <div className="state-container fade-in">
                  <div className="audio-visualizer">
                    <div className="bar"></div><div className="bar"></div><div className="bar"></div>
                    <div className="bar"></div><div className="bar"></div>
                  </div>

                  <div className="timer-display">{formatTime(recordingTime)} / 00:20</div>

                  <h3 className="question-text text-muted">"{INTERVIEW_QUESTIONS[currentQIndex]}"</h3>
                  <button className="btn-danger mt-4" onClick={stopListening}>Finish Answer</button>
                </div>
              )}

              {appState === 'processing' && (
                <div className="state-container fade-in">
                  <div className="spinner-modern"></div>
                  <h3 className="processing-text">Processing local GPU inference...</h3>
                  <p className="helper-text">Evaluating with Llama 3 via Ollama</p>
                </div>
              )}

              {appState === 'feedback' && evaluation && (
                <div className="feedback-container fade-in">
                  <div className="transcript-box">
                    <span className="label-small">YOUR TRANSCRIPT</span>
                    <p>"{transcript}"</p>
                  </div>

                  {evaluation.error ? (
                    <div className="error-box">Error: {evaluation.error}</div>
                  ) : (
                    <div className="results-grid">
                      <div className="score-section">
                        <div className={`score-circle ${evaluation.score >= 7 ? 'good' : evaluation.score >= 4 ? 'okay' : 'bad'}`}>
                          {evaluation.score || "?"}
                        </div>
                        <span className="score-label">out of 10</span>
                      </div>

                      <div className="feedback-section">
                        <h4>Interviewer Feedback</h4>
                        <p>{evaluation.feedback || "No feedback provided."}</p>
                      </div>
                    </div>
                  )}

                  {!evaluation.error && evaluation.missing_context && evaluation.missing_context.length > 0 && (
                    <div className="improvement-box">
                      <h4>Areas for Improvement (STAR Method)</h4>
                      <ul>
                        {evaluation.missing_context.map((item, index) => (
                          <li key={index}>{renderLLMItem(item)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="action-footer">
                    <button className="btn-primary w-full" onClick={nextQuestion}>
                      Next Question →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

export default App