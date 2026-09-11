import { useRef, useEffect, useState } from 'react';

// Decorative dot field + a few travelling "route" lines for the Login
// page's branding panel — ported from a 21st.dev world-map component, but
// with the literal continent shapes dropped (a world map reads as "global
// travel app", not a local Albay car rental) down to a plain animated dot
// pattern. Runs its own requestAnimationFrame loop (not motion/react) since
// it repaints every frame — Framer Motion drives discrete property
// transitions, not a persistent canvas redraw.
const LoginRouteCanvas = ({ dotColor, lineColor }) => {
  const canvasRef = useRef(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
      canvas.width = width;
      canvas.height = height;
    });
    observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const { width, height } = dims;
    if (!width || !height) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const gap = 16;
    const dots = [];
    for (let x = gap / 2; x < width; x += gap) {
      for (let y = gap / 2; y < height; y += gap) {
        if (Math.random() > 0.55) {
          dots.push({ x, y, opacity: Math.random() * 0.35 + 0.12 });
        }
      }
    }

    const routes = [
      { start: { x: width * 0.15, y: height * 0.22 }, end: { x: width * 0.55, y: height * 0.45 }, delay: 0 },
      { start: { x: width * 0.62, y: height * 0.7 }, end: { x: width * 0.85, y: height * 0.32 }, delay: 1.6 },
      { start: { x: width * 0.22, y: height * 0.78 }, end: { x: width * 0.6, y: height * 0.18 }, delay: 3.2 },
    ];

    const DURATION = 2.6;
    const CYCLE = 6;
    const start = Date.now();
    let frameId;

    const alphaHex = (o) => Math.round(o * 255).toString(16).padStart(2, '0');

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      dots.forEach((d) => {
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `${dotColor}${alphaHex(d.opacity)}`;
        ctx.fill();
      });

      const elapsed = ((Date.now() - start) / 1000) % CYCLE;
      routes.forEach((route) => {
        const t = elapsed - route.delay;
        if (t <= 0) return;
        const progress = Math.min(t / DURATION, 1);
        const x = route.start.x + (route.end.x - route.start.x) * progress;
        const y = route.start.y + (route.end.y - route.start.y) * progress;

        ctx.beginPath();
        ctx.moveTo(route.start.x, route.start.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(route.start.x, route.start.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();
      });

      frameId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frameId);
  }, [dims, dotColor, lineColor]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
};

export default LoginRouteCanvas;
