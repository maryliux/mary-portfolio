(() => {
  const footer = document.getElementById('siteFooter');
  const host = document.getElementById('siteFooterStars');
  if (!footer || !host) return;

  const GLYPHS = ['‧', '₊', '⊹', '‧₊', '⊹‧', '‧₊⊹', '₊⊹', '‧₊⊹‧'];
  const path = [];
  const MIN_SAMPLE_PX = 6;
  const MAX_PATH = 600;
  const PATH_FADE_MS = 2000;
  const PATH_MAX_AGE_MS = PATH_FADE_MS;
  const TRAIL_RADIUS_PX = 80;
  const TIP_RADIUS_PX = 66;
  /** Higher = faster brighten along path; lower = softer dim when trail leaves */
  const MEMORY_LERP_UP_PER_SEC = 16;
  const MEMORY_LERP_DOWN_PER_SEC = 9;
  const MAX_PLANTED = 220;
  const DEAD_ZONE_PAD = 32;

  function getDeadZoneBounds() {
    const inner = footer.querySelector('.site-footer__inner');
    if (!inner) return null;
    const fr = footer.getBoundingClientRect();
    const ir = inner.getBoundingClientRect();
    return {
      left: ir.left - fr.left - DEAD_ZONE_PAD,
      top: ir.top - fr.top - DEAD_ZONE_PAD,
      right: ir.right - fr.left + DEAD_ZONE_PAD,
      bottom: ir.bottom - fr.top + DEAD_ZONE_PAD,
    };
  }

  function inDeadZone(px, py) {
    const b = getDeadZoneBounds();
    if (!b) return false;
    return px >= b.left && px <= b.right && py >= b.top && py <= b.bottom;
  }

  let stars = [];
  let planted = [];
  let mx = -1;
  let my = -1;
  let raf = 0;
  let loopRunning = false;
  let lastFrameTime = 0;

  function prunePath(now) {
    while (path.length && now - path[0].t > PATH_MAX_AGE_MS) path.shift();
  }

  function prunePlanted(now) {
    while (planted.length && now - planted[0].t > PATH_FADE_MS) {
      const old = planted.shift();
      if (old?.el?.parentNode) old.el.remove();
    }
  }

  function plantStarAt(px, py) {
    if (inDeadZone(px, py)) return;
    const fw = footer.offsetWidth;
    const fh = footer.offsetHeight;
    if (fw < 40 || fh < 40) return;
    if (planted.length >= MAX_PLANTED) {
      const old = planted.shift();
      if (old?.el?.parentNode) old.el.remove();
    }
    const span = document.createElement('span');
    span.className = 'site-footer__star site-footer__star--planted';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    span.style.left = `${(px / fw) * 100}%`;
    span.style.top = `${(py / fh) * 100}%`;
    span.style.fontSize = `${18 + Math.random() * 18}px`;
    span.style.color = 'rgba(252, 248, 255, 0.98)';
    host.appendChild(span);
    planted.push({ el: span, t: performance.now() });
  }

  function smoothstep01(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
  }

  function distPointToSegment(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-10) return Math.hypot(px - x0, py - y0);
    let t = ((px - x0) * dx + (py - y0) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = x0 + t * dx;
    const qy = y0 + t * dy;
    return Math.hypot(px - qx, py - qy);
  }

  function distToTrail(px, py) {
    let minD = Infinity;
    if (path.length >= 2) {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        minD = Math.min(minD, distPointToSegment(px, py, a.x, a.y, b.x, b.y));
      }
    }
    if (path.length === 1 && mx >= 0) {
      const p0 = path[0];
      minD = Math.min(minD, distPointToSegment(px, py, p0.x, p0.y, mx, my));
    }
    if (path.length >= 2 && mx >= 0) {
      const last = path[path.length - 1];
      minD = Math.min(minD, distPointToSegment(px, py, last.x, last.y, mx, my));
    }
    if (path.length === 0 && mx >= 0) {
      minD = Math.hypot(px - mx, py - my);
    }
    return minD;
  }

  function appendPathSample(x, y) {
    if (inDeadZone(x, y)) return;
    const now = performance.now();
    if (path.length === 0) {
      path.push({ x, y, t: now });
      plantStarAt(x, y);
      return;
    }
    const last = path[path.length - 1];
    if (Math.hypot(x - last.x, y - last.y) >= MIN_SAMPLE_PX) {
      path.push({ x, y, t: now });
      while (path.length > MAX_PATH) path.shift();
      plantStarAt(x, y);
    }
  }

  function buildStars() {
    path.length = 0;
    lastFrameTime = 0;
    host.innerHTML = '';
    stars = [];
    planted = [];
    const fw = footer.offsetWidth;
    const fh = footer.offsetHeight;
    if (fw < 40 || fh < 40) return;
    const count = Math.min(120, Math.max(40, Math.floor((fw * fh) / 15000)));
    for (let i = 0; i < count; i++) {
      const span = document.createElement('span');
      span.className = 'site-footer__star';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      let x;
      let y;
      let guard = 0;
      do {
        x = Math.random() * 100;
        y = Math.random() * 100;
        guard++;
      } while (guard < 100 && inDeadZone((x / 100) * fw, (y / 100) * fh));
      if (inDeadZone((x / 100) * fw, (y / 100) * fh)) {
        x = 4;
        y = 4;
      }
      span.style.left = `${x}%`;
      span.style.top = `${y}%`;
      span.style.fontSize = `${14 + Math.random() * 18}px`;
      host.appendChild(span);
      stars.push({ el: span, nx: x / 100, ny: y / 100, memory: 0 });
    }
    updateStars(1 / 60);
  }

  function updateStars(dtSec) {
    const rect = footer.getBoundingClientRect();
    const fw = rect.width;
    const fh = rect.height;
    stars.forEach((s) => {
      const sx = s.nx * fw;
      const sy = s.ny * fh;
      const dPath = distToTrail(sx, sy);
      let along = 0;
      if (Number.isFinite(dPath)) {
        const u = Math.max(0, Math.min(1, 1 - dPath / TRAIL_RADIUS_PX));
        along = smoothstep01(u);
      }
      let tip = 0;
      if (mx >= 0 && my >= 0) {
        const dt = Math.hypot(mx - sx, my - sy);
        const u = Math.max(0, Math.min(1, 1 - dt / TIP_RADIUS_PX));
        tip = smoothstep01(u);
      }
      const target = Math.min(1, Math.max(along, tip * 0.85));
      const ratePerSec = target > s.memory ? MEMORY_LERP_UP_PER_SEC : MEMORY_LERP_DOWN_PER_SEC;
      const k = 1 - Math.exp(-ratePerSec * dtSec);
      s.memory += (target - s.memory) * k;
      if (s.memory < 1e-4) s.memory = 0;
      const glow = 0.05 + s.memory * 0.88;
      s.el.style.opacity = String(Math.min(0.96, glow));
      const a = 0.22 + s.memory * 0.72;
      s.el.style.color = `rgba(248, 244, 255, ${Math.min(0.98, a)})`;
    });
  }

  function shouldKeepAnimating() {
    if (path.length > 0) return true;
    if (planted.length > 0) return true;
    return stars.some((s) => s.memory > 0.004);
  }

  function loop() {
    raf = 0;
    const now = performance.now();
    if (!lastFrameTime) lastFrameTime = now;
    let dtSec = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    dtSec = Math.min(0.05, Math.max(1 / 200, dtSec));
    prunePath(now);
    prunePlanted(now);
    updateStars(dtSec);
    if (shouldKeepAnimating()) {
      raf = requestAnimationFrame(loop);
    } else {
      loopRunning = false;
    }
  }

  function ensureLoop() {
    if (loopRunning) return;
    loopRunning = true;
    raf = requestAnimationFrame(loop);
  }

  function onMove(e) {
    const rect = footer.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (inDeadZone(px, py)) {
      mx = -1;
      my = -1;
      path.length = 0;
      ensureLoop();
      return;
    }
    mx = px;
    my = py;
    appendPathSample(mx, my);
    ensureLoop();
  }

  function onLeave() {
    mx = -1;
    my = -1;
    ensureLoop();
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    buildStars();
    stars.forEach((s) => {
      s.el.style.opacity = '0.32';
      s.el.style.transition = 'none';
      s.el.style.color = 'rgba(248, 244, 255, 0.55)';
    });
  } else {
    footer.addEventListener('pointermove', onMove, { passive: true });
    footer.addEventListener('pointerleave', onLeave);
    requestAnimationFrame(() => {
      buildStars();
      const ro = new ResizeObserver(() => {
        window.requestAnimationFrame(buildStars);
      });
      ro.observe(footer);
    });
  }
})();
