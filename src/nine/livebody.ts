/* Nine's living suit: the body photo redrawn every frame by a small WebGL shader.

   - Breathing: the chest rises and widens a little, anchored at the waist.
   - Follow-through: when the head turns, the torso and jacket follow on a spring,
     lag behind and settle, the way cloth does.
   - Fabric: soft travelling folds in the jacket, stronger right after a movement
     (a nod, a greeting, a hop), then calming down.
   - Definition: gentle sharpening, a fine twill on the navy jacket, and a sheen
     that moves with the light as she turns toward the pointer.

   If WebGL isn't available, or the visitor prefers reduced motion, the photo stays as it is. */
import type { NineFigure } from "./photo";

const VERT = `attribute vec2 a; varying vec2 uv;
void main(){ uv = vec2(a.x * .5 + .5, .5 - a.y * .5); gl_Position = vec4(a, 0., 1.); }`;

const FRAG = `precision mediump float;
varying vec2 uv;
uniform sampler2D T;
uniform vec2 tex;           // texture size in pixels
uniform float t, breath, sway, lean, energy, sheenX, sharp;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
void main(){
  vec2 p = uv;
  vec4 c0 = texture2D(T, p);
  float lum0 = dot(c0.rgb, vec3(.299, .587, .114));
  float body = smoothstep(.43, .56, p.y);                 // below the neck line
  float h = clamp((p.y - .45) / .55, 0., 1.);             // 0 at the shoulders, 1 at the bottom of the frame
  float chest = body * (1. - h) * (1. - h);

  // breathing: the chest widens and rises a touch
  vec2 off = vec2((p.x - .5) * -.008 * breath * chest, .0045 * breath * chest);
  // follow-through: a shear that lags the head's turn, anchored at the bottom
  off.x += sway * .010 * (1. - h) * body;
  // shoulders lift a little on the side she turns toward
  off.y += body * smoothstep(.64, .52, p.y) * lean * .0035 * sign(p.x - .5);

  // fabric folds, only on the jacket (dark navy), stronger just after a movement
  float jacket = smoothstep(.30, .14, lum0) * c0.a * body;
  vec2 fp = vec2(p.x * 6. + t * .33 + sway * 1.5, p.y * 4.5 - t * .21);
  off += jacket * (.45 + energy * 1.6) * .0019 * vec2(noise(fp) - .5, noise(fp + 7.3) - .5);

  vec2 q = p + off;
  vec4 c = texture2D(T, q);
  // definition: unsharp mask
  vec2 d = 1. / tex;
  vec4 blur = (texture2D(T, q + vec2(d.x, 0.)) + texture2D(T, q - vec2(d.x, 0.)) + texture2D(T, q + vec2(0., d.y)) + texture2D(T, q - vec2(0., d.y))) * .25;
  c.rgb += (c.rgb - blur.rgb) * sharp * c.a;
  // texture: a fine diagonal twill on the jacket, a softer weave on the shirt
  float lum = dot(c.rgb, vec3(.299, .587, .114));
  float jk = smoothstep(.30, .14, lum) * c.a;
  float shirt = smoothstep(.70, .88, lum) * c.a * body;
  float tw = sin((q.x * tex.x + q.y * tex.y) * 1.35) * .5 + .5;
  float wv = sin(q.x * tex.x * 1.6) * sin(q.y * tex.y * 1.6);
  c.rgb *= 1. + jk * (tw - .5) * .07 + shirt * wv * .012;
  // sheen: a soft band of light across the cloth that follows her turn
  float band = exp(-pow((q.x - sheenX) * 5. + (q.y - .72) * 1.8, 2.));
  c.rgb += jk * body * band * (.045 + energy * .02) * vec3(.72, .84, 1.);
  // soft fold shading: the folds catch and lose a little light
  c.rgb *= 1. + jacket * (noise(fp * 1.7) - .5) * (.05 + energy * .05);
  gl_FragColor = vec4(clamp(c.rgb, 0., 1.) * c.a, c.a);
}`;

export function attachLiveBody(fig: NineFigure) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const img = fig.el.querySelector(".np-body") as HTMLImageElement | null;
  const stage = fig.el.querySelector(".np-stage") as HTMLElement | null;
  if (!img || !stage) return;
  const cv = document.createElement("canvas");
  cv.className = "np-live"; cv.setAttribute("aria-hidden", "true");
  const gl = cv.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false }) as WebGLRenderingContext | null;
  if (!gl) return;

  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram()!; gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const u = { tex: U("tex"), t: U("t"), breath: U("breath"), sway: U("sway"), lean: U("lean"), energy: U("energy"), sheenX: U("sheenX"), sharp: U("sharp") };

  const start = () => {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform2f(u.tex, img.naturalWidth, img.naturalHeight);
    img.insertAdjacentElement("afterend", cv);

    // motion state: a spring that follows the head (follow-through), and an energy that spikes on moves
    let s = 0, v = 0, energy = 0, lastLx = 0, lastMove = "", visible = true, raf = 0;
    const t0 = performance.now();
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }, { rootMargin: "100px" }).observe(fig.el);

    function resize() {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl!.viewport(0, 0, w, h); }
    }
    function frame(now: number) {
      raf = 0;
      if (!visible || document.hidden) return;
      resize();
      const t = (now - t0) / 1000;
      const lx = fig.face._lx || 0;
      // a damped spring chasing the head's turn: the body lags, overshoots a little and settles
      v += (lx - s) * 0.035; v *= 0.86; s += v;
      const move = fig.el.dataset.move || "";
      if (move && move !== lastMove) energy = Math.min(1.4, energy + (move === "hop" || move === "greet" || move === "sway" ? 1 : 0.6));
      lastMove = move;
      energy = Math.min(1.5, energy * 0.965 + Math.abs(lx - lastLx) * 4);
      lastLx = lx;
      const pose = fig.el.dataset.pose;
      const rate = move === "talk" ? 1.6 : pose === "sleep" ? 0.55 : 1;      // breaths per 4.8 s
      const breath = Math.sin((t / 4.8) * Math.PI * 2 * rate) * (move === "talk" ? 0.8 : 1);
      gl!.uniform1f(u.t, t); gl!.uniform1f(u.breath, breath); gl!.uniform1f(u.sway, (s - lx) * 2.2 + lx * 0.25);
      gl!.uniform1f(u.lean, lx); gl!.uniform1f(u.energy, energy); gl!.uniform1f(u.sheenX, 0.52 + lx * 0.22 + Math.sin(t * 0.21) * 0.04);
      gl!.uniform1f(u.sharp, 0.55);
      gl!.clearColor(0, 0, 0, 0); gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      if (!fig.el.classList.contains("is-live")) fig.el.classList.add("is-live");
      raf = requestAnimationFrame(frame);
    }
    document.addEventListener("visibilitychange", () => { if (!document.hidden && visible && !raf) raf = requestAnimationFrame(frame); });
    cv.addEventListener("webglcontextlost", e => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; fig.el.classList.remove("is-live"); });
    raf = requestAnimationFrame(frame);
  };
  if (img.complete && img.naturalWidth) start(); else img.addEventListener("load", start, { once: true });
}
