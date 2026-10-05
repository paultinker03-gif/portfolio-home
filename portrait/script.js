(() => {
  // Lives inside the paultinker timeline (the "Approach" panel), which provides the title and nav;
  // there the homepage nav sits where the "move" hint would be, so the hint is dropped
  const embedded = (() => { try { return window.parent !== window; } catch (e) { return true; } })();
  if (embedded) document.documentElement.classList.add('is-embedded');

  // Narrow windows: the flat pictures sit between the panel's title and its text (style.css), so
  // measure how much room those take in the homepage around this frame
  if (embedded) {
    const band = () => {
      try {
        const entry = parent.document.querySelector('[data-role="cv-entry"][data-approach="true"]');
        const t = entry.querySelector('[data-role="cv-title"]'), d = entry.querySelector('[data-role="cv-desc"]');
        const er = entry.getBoundingClientRect();
        const s = document.documentElement.style;
        if (t) s.setProperty('--bt', Math.round(t.getBoundingClientRect().bottom - er.top + 20) + 'px');
        if (d) s.setProperty('--bb', Math.round(er.bottom - d.getBoundingClientRect().top + 20) + 'px');
      } catch (e) {}
    };
    band();
    // the homepage re-lays its text on resize too, so measure again once it has
    addEventListener('resize', () => { band(); setTimeout(band, 250); });
    [300, 1000, 2500].forEach(ms => setTimeout(band, ms));   // after the homepage's fonts settle
  }

  // Phones get the flat pictures instead (see style.css), so skip the interactive frame
  if (matchMedia('(max-width: 700px)').matches) return;
  // desktop: load every layer straight away (lazy loading is only for phones, which never show them)
  document.querySelectorAll('.frame img').forEach(i => { i.loading = 'eager'; });

  // v3: no hard line. Like the reference animation, one scene dissolves into a soft field of
  // colour and the other pulls into focus out of it, layer by layer.
  const root = document.getElementById('portrait');
  const tilt = document.getElementById('tilt');
  const hint = document.getElementById('hint');
  const fog = document.getElementById('fog');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layers = [...document.querySelectorAll('.layer')].map(el => ({
    el, key: el.dataset.key, depth: +el.dataset.depth || 1, desk: !!el.closest('#desk'),
  }));
  // Out of focus = a pre-blurred copy of the layer (tools/portrait/make_blur.py) crossfaded under
  // the sharp one, instead of a live CSS blur() that re-rasterised these large images every frame.
  // PAD: the blurred image's transparent margin, as a share of the layer's width / height per side.
  const PAD = {"desk-bg": [0.0607, 0.073], "screens": [0.1058, 0.1594], "person": [0.155, 0.1961], "bike-bg": [0.0619, 0.073], "rider": [0.4167, 0.2073], "flowers-l": [0.4016, 0.3643], "flowers-r": [0.3248, 0.4113]};
  for (const L of layers) {
    const pic = L.el.querySelector('picture'), pad = PAD[L.key];
    if (!pic || !pad) continue;
    const b = document.createElement('img');
    b.className = 'blur'; b.alt = ''; b.decoding = 'async'; b.src = `img/${L.key}-blur.webp?v=${L.key === 'person' ? 3 : 1}`;
    b.style.cssText = `left:${(-pad[0] * 100).toFixed(2)}%;top:${(-pad[1] * 100).toFixed(2)}%;width:${((1 + 2 * pad[0]) * 100).toFixed(2)}%;height:${((1 + 2 * pad[1]) * 100).toFixed(2)}%`;
    pic.parentElement.insertBefore(b, pic);
    L.sharp = pic; L.soft = b;
  }
  // only write a style when its value changes, so a still page does no style or paint work
  const put = (el, prop, val, L, k) => { if (L[k] !== val) { L[k] = val; el.style[prop] = val; } };
  // [start, end] of the cursor travel over which each layer dissolves (desk) or resolves (bike).
  // The desk figure goes soft first and its room last; the landscape arrives before the rider.
  const WINDOWS = {
    'person': [0.05, 0.55], 'screens': [0.12, 0.65], 'desk-bg': [0.3, 0.88],
    'bike-bg': [0.18, 0.72], 'rider': [0.38, 0.95], 'flowers-l': [0.3, 0.85], 'flowers-r': [0.3, 0.85],
  };
  const smooth = x => x * x * (3 - 2 * x);
  const stage = (m, [a, b]) => smooth(Math.min(1, Math.max(0, (m - a) / (b - a))));
  if (matchMedia('(hover: none)').matches) hint.innerHTML = '<span>&larr;</span> drag <span>&rarr;</span>';

  let w = 0, h = 0;
  const resize = () => { const r = tilt.getBoundingClientRect(); w = r.width; h = r.height; };
  addEventListener('resize', resize);
  // the frame also changes size without a window resize (once the homepage's title/text are measured)
  if (window.ResizeObserver) new ResizeObserver(resize).observe(tilt);
  resize();

  // Input
  // starts on the bike scene: most visitors arrive with the cursor on the right of the page
  const target = { mix: 1, px: 0, py: 0 };
  const cur = { mix: 1, px: 0, py: 0 };
  let touched = false, travelled = 0, lastX = null, lastMove = 0;
  const onPoint = e => {
    const nx = e.clientX / innerWidth, ny = e.clientY / innerHeight;
    target.mix = smooth(Math.min(1, Math.max(0, (nx - 0.3) / 0.4)));
    target.px = nx - 0.5;
    target.py = ny - 0.5;
    if (lastX !== null) travelled += Math.abs(e.clientX - lastX);
    lastX = e.clientX;
    lastMove = performance.now();
    if (!touched && (travelled > 60 || e.pointerType === 'touch')) {
      touched = true;
      hint.classList.add('is-gone');
    }
  };
  addEventListener('pointermove', onPoint, { passive: true });
  addEventListener('pointerdown', onPoint, { passive: true });
  document.addEventListener('pointerleave', () => { target.px = 0; target.py = 0; });

  let last = performance.now(), t0 = last;
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    // Before anyone moves, the bike scene breathes slightly out of focus and back, as a hint
    if (!touched && !reduced) {
      const tt = (now - t0) / 1000;
      target.mix = 1 - (tt > 1.2 ? 0.07 * (1 - Math.cos((tt - 1.2) * 1.3)) * 0.5 : 0);
    }

    // Slow, soft easing: the reference never snaps
    const k = 1 - Math.pow(1 - (reduced ? 0.3 : 0.06), dt * 60);
    const kp = 1 - Math.pow(1 - 0.035, dt * 60);
    cur.mix += (target.mix - cur.mix) * k;
    if (Math.abs(target.mix - cur.mix) < 0.001) cur.mix = target.mix;
    const idle = Math.min(1, Math.max(0, (now - lastMove - 1500) / 2000));
    const driftX = Math.sin(t * 0.21) * 0.22 * idle, driftY = Math.sin(t * 0.15 + 1) * 0.14 * idle;
    cur.px += (target.px + driftX - cur.px) * kp;
    cur.py += (target.py + driftY - cur.py) * kp;
    root.style.setProperty('--mix', cur.mix.toFixed(4));

    // Focus pull: each layer's visibility crossfades sharp <-> pre-blurred, sets its opacity and a
    // slight bloom in scale
    const s = w / 1000;
    for (const L of layers) {
      const m = stage(cur.mix, WINDOWS[L.key] || [0, 1]);
      const v = L.desk ? 1 - m : m;                         // 1 = sharp and present
      const scale = 1 + (1 - v) * 0.05;
      let op = (L.desk ? 1 : Math.min(1, v * 1.4)).toFixed(2);   // desk stays as the base colour field
      if (L.desk && v < 0.02 && L.key !== 'desk-bg') op = '0';
      put(L.el, 'opacity', op, L, '_op');
      if (L.sharp) {
        // the blurred copy sits underneath at full strength until the sharp one is nearly in, so
        // opaque backgrounds never turn see-through mid-fade
        put(L.sharp, 'opacity', v.toFixed(2), L, '_sh');
        put(L.soft, 'opacity', Math.min(1, (1 - v) * 3).toFixed(2), L, '_so');
      }
      const tx = reduced ? 0 : -cur.px * 16 * L.depth * s, ty = reduced ? 0 : -cur.py * 11 * L.depth * s;
      put(L.el, 'transform', `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`, L, '_tf');
    }

    // Colour fog swells mid-transition (the soft "between" frames of the reference) and drifts
    const between = Math.sin(Math.PI * cur.mix);
    fog.style.opacity = (0.12 + between * 0.75).toFixed(3);
    fog.style.setProperty('--fx', `${(Math.sin(t * 0.07) * 6).toFixed(2)}%`);
    fog.style.setProperty('--fy', `${(Math.cos(t * 0.05) * 4).toFixed(2)}%`);

    if (!reduced) {
      tilt.style.transform = `rotateY(${(cur.px * 3.2).toFixed(3)}deg) rotateX(${(-cur.py * 2.6).toFixed(3)}deg)`;
    }
    if (onScreen && !document.hidden) requestAnimationFrame(frame); else running = false;
  };
  // Pause entirely while the Approach panel is off screen (the homepage keeps this frame loaded
  // from two panels away) or the tab is hidden; resume where it left off.
  let onScreen = true, running = true;
  const resume = () => { if (!running && onScreen && !document.hidden) { running = true; last = performance.now(); requestAnimationFrame(frame); } };
  if (window.IntersectionObserver) new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; resume(); }).observe(root);
  document.addEventListener('visibilitychange', resume);
  requestAnimationFrame(frame);
})();
