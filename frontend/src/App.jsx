import { useEffect, useMemo, useRef, useState } from 'react'
import { MotionConfig } from 'motion/react'
import Header from './components/Header'
import Home from './components/Home'
import Interview from './components/Interview'
import Report from './components/Report'
import ResumeUpload from './components/ResumeUpload'
import Setup from './components/Setup'
import { Failed, Working } from './components/Working'
import { BackToTop, CursorDot, ScrollProgress } from './components/motion/Chrome'
import Splash from './components/motion/Splash'
import { shouldShowSplash } from './lib/intro'
import { api } from './lib/api'
import { firstName } from './lib/format'
import { load, save } from './lib/storage'
import { cancelSpeech, warmUpVoices } from './lib/speech'
import { scrollToTop, startSmoothScroll } from './lib/scroll'
import './App.css'
import './views.css'
import './home.css'

const PROFILE_KEY = 'mockerai:profile'
const VOICE_KEY = 'mockerai:voice'

function defaultSelection(saved) {
  const tracks = saved?.tracks ?? []
  return {
    trackId: (tracks.find((t) => t.recommended) ?? tracks[0])?.id ?? null,
    difficulty: saved?.profile?.seniority ?? 'mid',
    count: 5,
  }
}

export default function App() {
  const [view, setView] = useState('home') // home | upload | setup | preparing | interview | report
  const [saved, setSaved] = useState(() => load(PROFILE_KEY)) // { profile, tracks, aiParsed }
  const [selection, setSelection] = useState(() => defaultSelection(load(PROFILE_KEY)))
  const [interview, setInterview] = useState(null) // { id, track, questions, difficulty }
  const [results, setResults] = useState(null)
  const [prepError, setPrepError] = useState(null)
  const [voiceOn, setVoiceOn] = useState(() => load(VOICE_KEY, true) !== false)
  const prepAbort = useRef(null)
  const [introDone, setIntroDone] = useState(() => !shouldShowSplash())

  useEffect(() => {
    warmUpVoices()
    const stopSmoothScroll = startSmoothScroll()
    return () => {
      cancelSpeech()
      stopSmoothScroll()
    }
  }, [])

  // Every view change starts at the top of the page.
  useEffect(() => {
    scrollToTop({ immediate: true })
  }, [view])

  const storeProfile = (next) => {
    setSaved(next)
    save(PROFILE_KEY, next)
  }

  const onParsed = (data) => {
    const next = { profile: data.profile, tracks: data.tracks, aiParsed: data.ai_parsed }
    storeProfile(next)
    setSelection(defaultSelection(next))
    setView('setup')
  }

  const onProfileChange = (profile, tracks) => {
    storeProfile({ ...saved, profile, tracks })
    if (!tracks.some((t) => t.id === selection.trackId)) {
      setSelection((s) => ({ ...s, trackId: (tracks.find((t) => t.recommended) ?? tracks[0]).id }))
    }
  }

  const startInterview = async (sel = selection) => {
    setSelection(sel)
    setPrepError(null)
    setView('preparing')
    const controller = new AbortController()
    prepAbort.current = controller
    try {
      const data = await api.questions(
        { profile: saved.profile, trackId: sel.trackId, difficulty: sel.difficulty, count: sel.count },
        controller.signal,
      )
      setInterview({ id: Date.now(), track: data.track, questions: data.questions, difficulty: sel.difficulty })
      setResults(null)
      setView('interview')
    } catch (err) {
      if (err.name !== 'AbortError') setPrepError(err.message)
    }
  }

  const cancelPreparing = () => {
    prepAbort.current?.abort()
    setView('setup')
  }

  const toggleVoice = () => {
    const next = !voiceOn
    setVoiceOn(next)
    save(VOICE_KEY, next)
    if (!next) cancelSpeech()
  }

  const context = useMemo(
    () => (interview ? { profile: saved?.profile, track: interview.track, difficulty: interview.difficulty } : null),
    [interview, saved?.profile],
  )

  const name = firstName(saved?.profile?.name)
  const selectedTrack = saved?.tracks?.find((t) => t.id === selection.trackId)

  return (
    <MotionConfig reducedMotion="user">
    <div className="app" data-view={view}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {!introDone && <Splash onDone={() => setIntroDone(true)} />}
      <ScrollProgress />
      <Header
        view={view}
        voiceOn={voiceOn}
        onToggleVoice={toggleVoice}
        onEndInterview={() => setView('setup')}
        onHome={() => setView('home')}
        onUpload={() => setView('upload')}
      />
      <main id="main" className={view === 'home' ? 'main main-home' : 'main'}>
        {view === 'home' && (
          <Home
            savedName={saved?.profile?.name}
            introDone={introDone}
            onUpload={() => setView('upload')}
            onContinue={saved?.profile ? () => setView('setup') : null}
          />
        )}

        {view === 'upload' && <ResumeUpload onParsed={onParsed} />}

        {view === 'setup' && saved?.profile && (
          <Setup
            profile={saved.profile}
            tracks={saved.tracks}
            aiParsed={saved.aiParsed}
            selection={selection}
            onSelectionChange={setSelection}
            onProfileChange={onProfileChange}
            onStart={startInterview}
            onReplaceResume={() => setView('upload')}
          />
        )}

        {view === 'preparing' && (
          <div className="page-narrow">
            {prepError ? (
              <Failed
                title="Couldn’t write your questions"
                message={prepError}
                onRetry={() => startInterview()}
                onBack={() => setView('setup')}
                backLabel="Back to options"
              />
            ) : (
              <Working
                title="Writing your questions…"
                detail={`Tailoring ${selection.count} ${selectedTrack?.title.toLowerCase() ?? ''} questions to your resume. This usually takes 15 to 30 seconds.`}
                onCancel={cancelPreparing}
              />
            )}
          </div>
        )}

        {view === 'interview' && interview && (
          <Interview
            key={interview.id}
            questions={interview.questions}
            context={context}
            voiceOn={voiceOn}
            greeting={name ? `Hi ${name}, thanks for joining. Let’s begin.` : 'Thanks for joining. Let’s begin.'}
            onComplete={(r) => {
              setResults(r)
              setView('report')
            }}
            onExit={() => setView('setup')}
          />
        )}

        {view === 'report' && interview && results && (
          <Report
            key={interview.id}
            profile={saved.profile}
            track={interview.track}
            difficulty={interview.difficulty}
            results={results}
            onPracticeAgain={() => startInterview()}
            onChooseAnother={() => setView('setup')}
          />
        )}
      </main>
      <BackToTop />
      <CursorDot />
    </div>
    </MotionConfig>
  )
}
