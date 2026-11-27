// Lightweight HTML5 Canvas Financial Candlestick Background
// Designed for smooth mobile & desktop performance with prefers-reduced-motion support

export function initCandlestickBackground() {
  const canvas = document.getElementById('candlestick-bg');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0;
  let height = 0;
  let dpr = 1;
  let candles = [];
  let offset = 0;
  let rafId = null;
  let lastFrame = 0;

  function createCandles(count) {
    const list = [];
    let price = 0.52;
    for (let i = 0; i < count; i++) {
      const delta = (Math.random() - 0.48) * 0.12;
      const open = price;
      const close = Math.max(0.16, Math.min(0.84, open + delta));
      const high = Math.min(0.92, Math.max(open, close) + Math.random() * 0.08);
      const low = Math.max(0.08, Math.min(open, close) - Math.random() * 0.08);
      list.push({ open, close, high, low });
      price = close;
    }
    return list;
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isMobile = width <= 768;
    const step = isMobile ? 42 : 34;
    const needed = Math.ceil(width / step) + 6;
    candles = createCandles(needed);
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const isMobile = width <= 768;
    const step = isMobile ? 42 : 34;
    const bodyWidth = isMobile ? 10 : 12;

    // Subtle horizontal price grid lines
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.045)';
    ctx.lineWidth = 1;
    const gridRows = 5;
    for (let r = 1; r < gridRows; r++) {
      const y = Math.round((height / gridRows) * r) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const x = i * step - offset;
      if (x < -step || x > width + step) continue;

      const yHigh = height * (1 - c.high);
      const yLow = height * (1 - c.low);
      const yOpen = height * (1 - c.open);
      const yClose = height * (1 - c.close);
      const bullish = c.close >= c.open;

      const strokeCol = bullish
        ? 'rgba(212, 175, 55, 0.22)'
        : 'rgba(180, 120, 90, 0.16)';
      const fillCol = bullish
        ? 'rgba(212, 175, 55, 0.14)'
        : 'rgba(140, 82, 62, 0.11)';

      const centerX = x + bodyWidth / 2;
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(centerX, yHigh);
      ctx.lineTo(centerX, yLow);
      ctx.stroke();

      const top = Math.min(yOpen, yClose);
      const bodyH = Math.max(4, Math.abs(yClose - yOpen));
      ctx.fillStyle = fillCol;
      ctx.fillRect(x, top, bodyWidth, bodyH);
      ctx.strokeRect(x, top, bodyWidth, bodyH);
    }
  }

  function tick(ts) {
    if (reducedMotion.matches) return;
    if (ts - lastFrame >= 33) {
      lastFrame = ts;
      const isMobile = width <= 768;
      const step = isMobile ? 42 : 34;
      offset += isMobile ? 0.35 : 0.45;

      if (offset >= step) {
        offset -= step;
        const prev = candles[candles.length - 1];
        const open = prev ? prev.close : 0.5;
        const delta = (Math.random() - 0.48) * 0.12;
        const close = Math.max(0.16, Math.min(0.84, open + delta));
        const high = Math.min(0.92, Math.max(open, close) + Math.random() * 0.08);
        const low = Math.max(0.08, Math.min(open, close) - Math.random() * 0.08);
        candles.shift();
        candles.push({ open, close, high, low });
      }
      draw();
    }
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (rafId) cancelAnimationFrame(rafId);
    if (!reducedMotion.matches) {
      rafId = requestAnimationFrame(tick);
    }
  }

  resize();
  start();

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!document.hidden) {
      start();
    }
  });
}
