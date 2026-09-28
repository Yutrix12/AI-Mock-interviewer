import { useCallback, useEffect, useMemo, useRef } from 'react'

// Records microphone audio and streams the input level (0-1) into the
// `--level` CSS variable of `levelTargetRef`, outside of React renders.
export function useRecorder(levelTargetRef) {
  const session = useRef(null)

  const teardown = useCallback(() => {
    const s = session.current
    if (!s) return
    session.current = null
    cancelAnimationFrame(s.raf)
    s.stream.getTracks().forEach((track) => track.stop())
    s.audioContext.close().catch(() => {})
    levelTargetRef.current?.style.setProperty('--level', '0')
  }, [levelTargetRef])

  const start = useCallback(async () => {
    teardown()
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    const chunks = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }

    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    audioContext.createMediaStreamSource(stream).connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)

    const s = { stream, recorder, chunks, audioContext, raf: 0, level: 0 }
    const tick = () => {
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const sample of samples) {
        const centered = (sample - 128) / 128
        sum += centered * centered
      }
      const rms = Math.sqrt(sum / samples.length)
      // Speech RMS rarely passes 0.3, so stretch it and ease toward the target.
      s.level += (Math.min(1, rms * 3.5) - s.level) * 0.25
      levelTargetRef.current?.style.setProperty('--level', s.level.toFixed(3))
      s.raf = requestAnimationFrame(tick)
    }

    session.current = s
    recorder.start()
    s.raf = requestAnimationFrame(tick)
  }, [levelTargetRef, teardown])

  // Stops recording and resolves with the captured audio.
  const stop = useCallback(() => {
    const s = session.current
    if (!s) return Promise.resolve(null)
    return new Promise((resolve) => {
      s.recorder.onstop = () => {
        teardown()
        resolve(new Blob(s.chunks, { type: s.recorder.mimeType || 'audio/webm' }))
      }
      s.recorder.stop()
    })
  }, [teardown])

  // Stops recording and throws the audio away.
  const cancel = useCallback(() => {
    const s = session.current
    if (!s) return
    s.recorder.onstop = null
    if (s.recorder.state !== 'inactive') s.recorder.stop()
    teardown()
  }, [teardown])

  useEffect(() => cancel, [cancel])

  return useMemo(() => ({ start, stop, cancel }), [start, stop, cancel])
}
