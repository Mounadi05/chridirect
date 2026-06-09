"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeContext";

export type PlasmaDunesProps = {
  className?: string;
  style?: React.CSSProperties;
  speed?: number;
  interactive?: boolean;
  onReady?: (ok: boolean) => void;
};

const VS = `#version 300 es
in vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
uniform float u_time;
uniform vec2  u_res;
uniform vec2  u_mouse;
uniform vec4  u_click;
uniform float u_hover;
uniform float u_light;
out vec4 outColor;

float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash21(i), b = hash21(i+vec2(1,0)), c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ v += a*vnoise(p); p *= 2.02; a *= 0.5; }
  return v;
}

void main(){
  vec2 p = (gl_FragCoord.xy - 0.5*u_res.xy) / min(u_res.x, u_res.y);
  vec2 m = u_mouse - 0.5;
  float t = u_time*0.12;

  // Accumulate dune color and coverage separately from background
  vec3 duneCol = vec3(0.0);
  float duneMask = 0.0;
  float total = 0.0;

  for(int i=0;i<4;i++){
    float fi = float(i);
    float par = 0.05 + fi*0.06;
    vec2 q = p + m*par*u_hover;
    q.y += t*(0.3 + fi*0.15);
    q *= 1.5 + fi*0.4;
    float n = fbm(q + vec2(t*0.5, 0));
    float age = u_click.z;
    if(age < 2.0){
      vec2 cp = u_click.xy - 0.5;
      float r = length(p - cp);
      n += sin(r*30.0 - age*12.0) * exp(-age*1.5) * exp(-r*3.0) * 0.25;
    }
    float dune = smoothstep(0.4, 0.7, n);

    // Dark mode palette
    vec3 darkBase1 = vec3(0.05, 0.08, 0.14);
    vec3 darkBase2 = vec3(0.15, 0.45, 0.65);
    vec3 darkHighlight = vec3(0.80, 0.55, 0.85);

    // Light mode palette — deeper blues/purples visible on light bg
    vec3 lightBase1 = vec3(0.30, 0.54, 0.88);
    vec3 lightBase2 = vec3(0.20, 0.42, 0.80);
    vec3 lightHighlight = vec3(0.52, 0.32, 0.80);

    vec3 base1 = mix(darkBase1, lightBase1, u_light);
    vec3 base2 = mix(darkBase2, lightBase2, u_light);
    vec3 highlight = mix(darkHighlight, lightHighlight, u_light);

    vec3 layerCol = mix(base1, base2, fi/3.0);
    layerCol = mix(layerCol, highlight, pow(n, 4.0));

    float w = (1.0 - fi*0.2);
    duneCol += layerCol * w;
    duneMask += dune * w;
    total += w;
  }
  duneCol /= total;
  duneMask = clamp(duneMask / total * 2.8, 0.0, 1.0);

  // Background: dark navy vs light sky-white
  vec3 bgDark  = vec3(0.04, 0.06, 0.12);
  vec3 bgLight = vec3(0.90, 0.94, 1.00);
  vec3 bg = mix(bgDark, bgLight, u_light);

  // Composite: background where no dunes, dune color where dunes are
  vec3 col = mix(bg, duneCol, duneMask);

  // Hover glow
  vec3 darkGlow = vec3(0.5, 0.8, 1.0);
  vec3 lightGlow = vec3(0.15, 0.35, 0.80);
  col += exp(-length(p - m)*3.5) * u_hover * mix(0.45, 0.25, u_light) * mix(darkGlow, lightGlow, u_light);

  // Dark-mode bottom vignette only
  col += mix(smoothstep(0.4, -0.4, p.y) * vec3(0.04, 0.06, 0.10), vec3(0.0), u_light);

  // Film grain — subtler in light mode
  col += (hash21(gl_FragCoord.xy + u_time) - 0.5) * mix(0.025, 0.008, u_light);

  outColor = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error("Shader compile failed: " + log);
  }
  return s;
}

export default function PlasmaDunes({ className, style, speed = 1, interactive = true, onReady }: PlasmaDunesProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useTheme();
  const lightMode = theme === "light";

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const gl = canvas.getContext("webgl2", { antialias: false, premultipliedAlpha: false });
    if (!gl) {
      wrap.style.background = lightMode
        ? "radial-gradient(120% 80% at 30% 20%, oklch(0.88 0.06 220) 0%, oklch(0.94 0.02 220) 60%, oklch(0.98 0.01 220) 100%)"
        : "radial-gradient(120% 80% at 30% 20%, oklch(0.32 0.06 220) 0%, oklch(0.16 0.02 250) 60%, oklch(0.10 0.01 250) 100%)";
      onReady?.(false);
      return;
    }

    let prog: WebGLProgram | null = null;
    try {
      prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link failed");
    } catch (err) {
      console.error("PlasmaDunes:", err);
      onReady?.(false);
      return;
    }

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {
      time: gl.getUniformLocation(prog, "u_time"),
      res: gl.getUniformLocation(prog, "u_res"),
      mouse: gl.getUniformLocation(prog, "u_mouse"),
      click: gl.getUniformLocation(prog, "u_click"),
      hover: gl.getUniformLocation(prog, "u_hover"),
      light: gl.getUniformLocation(prog, "u_light"),
    };

    const state = {
      mouse: [0.5, 0.5] as [number, number],
      mouseTarget: [0.5, 0.5] as [number, number],
      click: [0.5, 0.5, 0, 0] as [number, number, number, number],
      hover: 0,
      hoverTarget: 0,
      lightVal: lightMode ? 1.0 : 0.0,
      start: performance.now(),
      raf: 0,
      visible: true,
      destroyed: false,
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(1, (wrap.clientWidth * dpr) | 0);
      const H = Math.max(1, (wrap.clientHeight * dpr) | 0);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize); ro.observe(wrap); resize();
    const io = new IntersectionObserver((entries) => { for (const e of entries) state.visible = e.isIntersecting; });
    io.observe(wrap);

    const pt = (e: PointerEvent): [number, number] => {
      const r = wrap.getBoundingClientRect();
      return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height))];
    };
    const onMove = (e: PointerEvent) => { if (!interactive) return; state.mouseTarget = pt(e); state.hoverTarget = 1; };
    const onLeave = () => { state.hoverTarget = 0; };
    const onEnter = () => { if (interactive) state.hoverTarget = 1; };
    const onDown = (e: PointerEvent) => { if (!interactive) return; const [x, y] = pt(e); state.click = [x, y, performance.now(), 0]; };

    if (interactive) {
      wrap.addEventListener("pointermove", onMove);
      wrap.addEventListener("pointerleave", onLeave);
      wrap.addEventListener("pointerenter", onEnter);
      wrap.addEventListener("pointerdown", onDown);
    }

    let idleT = 0;
    const frame = () => {
      if (state.destroyed) return;
      state.raf = requestAnimationFrame(frame);
      if (!state.visible) return;
      const t = ((performance.now() - state.start) / 1000) * speed;

      if (!interactive || reduced) {
        idleT += 0.005;
        state.mouseTarget = [0.5 + Math.cos(idleT) * 0.25, 0.5 + Math.sin(idleT * 0.8) * 0.25];
        state.hoverTarget = 0.6;
      }

      state.mouse[0] += (state.mouseTarget[0] - state.mouse[0]) * 0.12;
      state.mouse[1] += (state.mouseTarget[1] - state.mouse[1]) * 0.12;
      state.hover += (state.hoverTarget - state.hover) * 0.08;
      const lightTarget = lightMode ? 1.0 : 0.0;
      state.lightVal += (lightTarget - state.lightVal) * 0.05;

      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniform1f(u.time, t);
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform2f(u.mouse, state.mouse[0], state.mouse[1]);
      const clickAge = state.click[2] ? (performance.now() - state.click[2]) / 1000 : 999;
      gl.uniform4f(u.click, state.click[0], state.click[1], clickAge, 0);
      gl.uniform1f(u.hover, state.hover);
      gl.uniform1f(u.light, state.lightVal);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    frame();
    onReady?.(true);

    return () => {
      state.destroyed = true;
      cancelAnimationFrame(state.raf);
      ro.disconnect(); io.disconnect();
      if (interactive) {
        wrap.removeEventListener("pointermove", onMove);
        wrap.removeEventListener("pointerleave", onLeave);
        wrap.removeEventListener("pointerenter", onEnter);
        wrap.removeEventListener("pointerdown", onDown);
      }
      try { gl.deleteProgram(prog); gl.deleteBuffer(buf); gl.deleteVertexArray(vao); } catch {}
    };
  }, [speed, interactive, onReady, lightMode]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: lightMode ? "oklch(0.97 0.02 230)" : "oklch(0.16 0.02 250)",
        ...style,
      }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
