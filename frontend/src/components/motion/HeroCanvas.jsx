import { useEffect, useRef } from 'react'

// Flowing dune-like gradient drawn with a small WebGL fragment shader.
// Pauses off-screen and in background tabs; renders one still frame under
// reduced motion; the CSS gradient behind it covers browsers without WebGL.

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

const FRAGMENT = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uPaper;
uniform vec3 uBlush;
uniform vec3 uAccent;
uniform vec3 uInk;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = uTime * 0.045;

  // Warp the field so the bands drift and fold like dunes.
  vec2 q = vec2(fbm(p * 1.3 + vec2(t, -t * 0.6)), fbm(p * 1.3 + vec2(-t * 0.8, t) + 4.1));
  float n = fbm(p * 1.1 + q * 1.6 + t * 0.4);

  // Warm field rises toward the bottom right.
  float field = uv.x * 0.85 - uv.y * 0.7 + (n - 0.5) * 0.55;
  vec3 col = mix(uPaper, uBlush, smoothstep(-0.35, 0.3, field));
  col = mix(col, uAccent, smoothstep(0.15, 0.75, field));

  // Soft terraces give the layered, sculpted look.
  float ridge = fract(field * 4.0 + n * 0.5);
  col *= 1.0 - 0.07 * smoothstep(0.0, 0.05, ridge) * (1.0 - smoothstep(0.05, 0.45, ridge));

  // Ink bleeds in from the top right corner.
  float ink = smoothstep(0.75, 1.45, uv.x * 0.75 + uv.y * 0.95 + (n - 0.5) * 0.35);
  // Keep the top band (behind the transparent header) light enough for ink-coloured nav text.
  ink *= 1.0 - 0.88 * smoothstep(0.66, 0.97, uv.y + (n - 0.5) * 0.12);
  col = mix(col, uInk, ink * 0.92);

  // Keep the centre calm so the headline stays readable.
  float centre = 1.0 - smoothstep(0.0, 0.42, distance(uv, vec2(0.5, 0.52)));
  col = mix(col, uPaper, centre * 0.38);

  // Film grain.
  col += (hash(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.03;
  gl_FragColor = vec4(col, 1.0);
}
`

const hex = (value) => {
  const n = parseInt(value.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(shader))
    return null
  }
  return shader
}

export default function HeroCanvas({ dark = false }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext('webgl', { antialias: false, premultipliedAlpha: false })
    if (!gl) return

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    if (!vs || !fs) return
    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const u = (name) => gl.getUniformLocation(program, name)
    gl.uniform3fv(u('uPaper'), hex(dark ? '#15224a' : '#fbf6e3'))
    gl.uniform3fv(u('uBlush'), hex(dark ? '#3a2f4a' : '#fad98c'))
    gl.uniform3fv(u('uAccent'), hex('#d62e2f'))
    gl.uniform3fv(u('uInk'), hex(dark ? '#070d20' : '#1b2852'))

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(canvas.clientWidth * scale)
      canvas.height = Math.round(canvas.clientHeight * scale)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(u('uRes'), canvas.width, canvas.height)
    }
    resize()

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let visible = true
    const start = performance.now()
    const draw = (now) => {
      gl.uniform1f(u('uTime'), reduce ? 12 : (now - start) / 1000 + 12)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      if (!reduce && visible) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    const observer = new IntersectionObserver(([entry]) => {
      const wasVisible = visible
      visible = entry.isIntersecting && document.visibilityState === 'visible'
      if (visible && !wasVisible && !reduce) frame = requestAnimationFrame(draw)
    })
    observer.observe(canvas)
    const onVisibility = () => {
      const wasVisible = visible
      visible = document.visibilityState === 'visible'
      if (visible && !wasVisible && !reduce) frame = requestAnimationFrame(draw)
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', resize)
    canvas.dataset.ready = 'true'

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', resize)
      // Free GPU objects but keep the context: getContext() on this canvas returns the
      // same context on remount (e.g. React StrictMode), so losing it would blank the hero.
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [dark])

  return <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />
}
