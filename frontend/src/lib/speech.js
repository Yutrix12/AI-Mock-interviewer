const PREFERRED_VOICES = ['Google UK English Male', 'Microsoft Mark', 'Google US English', 'Apple Samantha']

// Holding the active utterance also stops Chrome from garbage-collecting it mid-sentence.
let current = null

const synth = () => (typeof window !== 'undefined' ? window.speechSynthesis : undefined)

export function warmUpVoices() {
  synth()?.getVoices()
}

function pickVoice() {
  const voices = synth()?.getVoices() ?? []
  for (const name of PREFERRED_VOICES) {
    const voice = voices.find((v) => v.name.includes(name))
    if (voice) return voice
  }
  return voices.find((v) => v.lang.startsWith('en')) ?? null
}

export function cancelSpeech() {
  current = null
  synth()?.cancel()
}

// Speaks `text` and calls `onEnd` once it finishes or fails. A newer speak()
// or cancelSpeech() silences the callback of the one it replaced.
export function speak(text, { onEnd } = {}) {
  const s = synth()
  if (!s) {
    onEnd?.()
    return
  }
  cancelSpeech()

  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) utterance.voice = voice
  const finish = () => {
    if (current !== utterance) return
    current = null
    onEnd?.()
  }
  utterance.onend = finish
  utterance.onerror = finish
  current = utterance

  // Chrome drops speak() calls issued in the same tick as cancel().
  setTimeout(() => {
    if (current === utterance) s.speak(utterance)
  }, 50)
}
