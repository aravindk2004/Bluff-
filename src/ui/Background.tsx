import { useEffect, useRef } from 'react';

export type Mood = 'menu' | 'calm' | 'tense' | 'win' | 'lose' | 'vip';

/** Three swirl colours per mood (dark, mid, light), as 0..1 RGB. */
const MOODS: Record<Mood, number[][]> = {
  menu: [hex('#173b4a'), hex('#245a6b'), hex('#3c8a8f')],
  calm: [hex('#1a4a3b'), hex('#2c7558'), hex('#4fa47f')],
  tense: [hex('#3d1418'), hex('#6e2228'), hex('#a8443a')],
  win: [hex('#4a3510'), hex('#7a5a18'), hex('#c9952e')],
  lose: [hex('#1c1a2e'), hex('#2c2a48'), hex('#45436a')],
  // High Stakes penthouse: black velvet, aubergine and gold leaf.
  vip: [hex('#120b18'), hex('#2e1638'), hex('#8a6a1e')],
};

function hex(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

// Original domain-warped "paint swirl": polar twist + iterated sine warps, posterized into bands.
const FRAG = `
precision mediump float;
uniform vec2 res;
uniform float t;
uniform vec3 c0, c1, c2;
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y);
  float len = length(uv);
  float ang = atan(uv.y, uv.x) + 0.9 * len - t * 0.035;
  vec2 p = vec2(cos(ang), sin(ang)) * len * 2.6;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    p += 0.55 * vec2(sin(p.y * 1.25 + t * 0.10 + fi * 1.3), cos(p.x * 1.15 - t * 0.08 + fi * 1.7));
  }
  float v = sin(p.x * 0.9 + p.y * 1.1) * 0.5 + 0.5;
  float w = sin(length(p) * 1.3 - t * 0.15) * 0.5 + 0.5;
  // Hard-ish bands for a painted look
  float b1 = smoothstep(0.42, 0.50, v);
  float b2 = smoothstep(0.70, 0.76, v * w + 0.25);
  vec3 col = mix(c0, c1, b1);
  col = mix(col, c2, b2 * 0.85);
  col *= 1.0 - 0.45 * smoothstep(0.35, 1.1, len);
  gl_FragColor = vec4(col, 1.0);
}`;

const PIXEL = 4; // render at 1/4 resolution, upscaled with crisp pixels

export function SwirlBackground({ mood }: { mood: Mood }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const target = useRef(MOODS[mood]);
  target.current = MOODS[mood];

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const gl = cv.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
    if (!gl) return; // CSS gradient fallback stays visible
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'res');
    const uT = gl.getUniformLocation(prog, 't');
    const uC = ['c0', 'c1', 'c2'].map((n) => gl.getUniformLocation(prog, n));

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const colors = target.current.map((c) => c.slice());
    let raf = 0;
    let last = 0;
    const start = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; // ~30fps is plenty for a lazy swirl
      last = now;
      const w = Math.ceil(cv.clientWidth / PIXEL);
      const h = Math.ceil(cv.clientHeight / PIXEL);
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
        gl.viewport(0, 0, w, h);
      }
      // Ease colours toward the current mood.
      for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) colors[i][k] += (target.current[i][k] - colors[i][k]) * 0.06;
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uT, reduced ? 12 : (now - start) / 1000);
      uC.forEach((u, i) => gl.uniform3fv(u, colors[i]));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,#23604b,#173f33)]">
      <canvas ref={canvas} className="h-full w-full" style={{ imageRendering: 'pixelated' }} />
    </div>
  );
}
