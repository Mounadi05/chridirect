"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  opacityDelta: number;
};

const CONFIG = {
  count: 160,
  speed: 0.5,
  connectDistance: 150,
  connectOpacity: 0.4,
  particleOpacityMin: 0.3,
  particleOpacityMax: 0.8,
  particleSizeMin: 1,
  particleSizeMax: 3,
  repulseDistance: 120,
  repulseStrength: 3,
  background: "#0d0d0d",
  color: "#ffffff",
};

function makeParticle(W: number, H: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = CONFIG.speed * (0.5 + Math.random() * 0.5);
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: CONFIG.particleSizeMin + Math.random() * (CONFIG.particleSizeMax - CONFIG.particleSizeMin),
    opacity: CONFIG.particleOpacityMin + Math.random() * (CONFIG.particleOpacityMax - CONFIG.particleOpacityMin),
    opacityDelta: (Math.random() > 0.5 ? 1 : -1) * 0.002,
  };
}

export default function ParticlesBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0;
    let particles: Particle[] = [];
    let mouse = { x: -9999, y: -9999, active: false };
    let raf = 0;
    let destroyed = false;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      // Rebuild particles on resize to avoid clustering
      particles = Array.from({ length: CONFIG.count }, () => makeParticle(W, H));
    };

    const onMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; };
    const onLeave = () => { mouse.active = false; mouse.x = -9999; mouse.y = -9999; };

    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `${r},${g},${b}`;
    };
    const particleRgb = hexToRgb(CONFIG.color);

    const draw = () => {
      if (destroyed) return;
      raf = requestAnimationFrame(draw);

      ctx.fillStyle = CONFIG.background;
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Repulse from mouse
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONFIG.repulseDistance && dist > 0) {
            const force = (CONFIG.repulseDistance - dist) / CONFIG.repulseDistance;
            p.x += (dx / dist) * force * CONFIG.repulseStrength;
            p.y += (dy / dist) * force * CONFIG.repulseStrength;
          }
        }

        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Bounce edges
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        else if (p.x > W) { p.x = W; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        else if (p.y > H) { p.y = H; p.vy *= -1; }

        // Pulse opacity
        p.opacity += p.opacityDelta;
        if (p.opacity <= CONFIG.particleOpacityMin || p.opacity >= CONFIG.particleOpacityMax) {
          p.opacityDelta *= -1;
        }

        // Draw dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particleRgb},${p.opacity})`;
        ctx.fill();

        // Connect nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONFIG.connectDistance) {
            const lineOpacity = CONFIG.connectOpacity * (1 - dist / CONFIG.connectDistance);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(${particleRgb},${lineOpacity})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    draw();

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block" }}
    />
  );
}
