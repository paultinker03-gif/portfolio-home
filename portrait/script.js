(() => {
  // Lives inside the paultinker timeline (the "Approach" panel), which provides the title and nav;
  // there the homepage nav sits where the "move" hint would be, so the hint is dropped
  const embedded = (() => { try { return window.parent !== window; } catch (e) { return true; } })();
  if (embedded) document.documentElement.classList.add('is-embedded');
  // touch screens (iPads included, which report a fine pointer): show the swipe cue under the picture
  if (navigator.maxTouchPoints > 0) document.documentElement.classList.add('is-touch');

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

  // Two transitions between the desk and the bike:
  //  'wipe' (v1): a bright diagonal line of light sweeps across, its angle swinging as it moves;
  //               each layer crosses at its own moment (the rider leads in before the landscape),
  //               and the far scene drops into night.
  //  'mist' (v3): no hard line; one scene dissolves into a soft field of colour and the other
  //               pulls into focus out of it, layer by layer.
  // ?mode=mist / ?mode=wipe on the portrait's own URL overrides it, for comparing.
  const MODE = new URLSearchParams(location.search).get('mode') || 'wipe';
  document.documentElement.classList.add('is-' + MODE);
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
  for (const L of (MODE === 'mist' ? layers : [])) {
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

  // ---- wipe mode: one full-frame "slot" per layer, each with its own diagonal mask ----
  const WIPE_WINDOWS = {    // [start, end] of the mix over which each layer crosses
    'bike-bg': [0.32, 1], 'rider': [0.1, 0.72], 'flowers-l': [0, 0.55], 'flowers-r': [0, 0.55],
    'screens': [0.5, 1], 'person': [0.38, 1],
  };
  const slots = [];
  let seam = null;
  if (MODE === 'wipe') {
    const deskEl = document.getElementById('desk'), bikeEl = document.getElementById('bike');
    for (const k of ['bike-bg', 'screens', 'person', 'rider', 'flowers-l', 'flowers-r']) {   // back to front
      const el = document.querySelector(`.layer[data-key="${k}"]`);
      if (!el) continue;
      const slot = document.createElement('div');
      slot.className = 'slot' + (el.closest('#desk') ? ' slot--desk' : '');
      slot.appendChild(el);
      bikeEl.appendChild(slot);
      if (k === 'bike-bg') {
        const shade = bikeEl.querySelector(':scope > .shade');
        if (shade) slot.appendChild(shade);                  // night tint only on the landscape
      }
      slots.push({ slot, win: WIPE_WINDOWS[k], c: {} });
    }
    seam = document.createElement('div'); seam.className = 'seam'; seam.setAttribute('aria-hidden', 'true');
    bikeEl.after(seam);
  }
  // seam geometry: the line leans one way with the desk in focus, swings through upright to lean
  // the other way for the bike, and tips further into the direction of travel while moving
  const ANGLE_DESK = 97, ANGLE_BIKE = 83, LEAN = 14, SLIVER = 0.03, SOFT = 0.004;   // SLIVER: how much of the other scene peeks in
  let ANGLE = ANGLE_BIKE, SIN = 1, COS = 0, SLANT = 0;
  const setAngle = a => { ANGLE = a; const r = a * Math.PI / 180; SIN = Math.sin(r); COS = Math.cos(r); SLANT = -COS / SIN; };

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
  // Touch: a drag reveals the other picture (grab the line and pull it across); on release it
  // settles on whichever picture is mostly showing. A tap alone changes nothing.
  // Mouse: the cursor's position across the page picks the picture, as before.
  let drag = null;
  const onPoint = e => {
    if (e.pointerType === 'touch') {
      if (e.type === 'pointerdown') drag = { x: e.clientX, mix: target.mix };
      if (!drag) return;
      const fw = Math.max(1, w || innerWidth);
      target.mix = Math.min(1, Math.max(0, drag.mix - (e.clientX - drag.x) / (fw * 0.8)));   // pull right → desk
      target.px = 0; target.py = 0;
      if (!touched && Math.abs(e.clientX - drag.x) > 12) {
        touched = true;
        hint.classList.add('is-gone');
        document.getElementById('swipecue').classList.add('is-gone');
      }
      lastMove = performance.now();
      return;
    }
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
      document.getElementById('swipecue').classList.add('is-gone');
    }
  };
  addEventListener('pointermove', onPoint, { passive: true });
  addEventListener('pointerdown', onPoint, { passive: true });
  const endDrag = e => {
    if (!drag || e.pointerType !== 'touch') return;
    drag = null;
    target.mix = target.mix < 0.5 ? 0 : 1;           // settle on the nearer picture
  };
  addEventListener('pointerup', endDrag, { passive: true });
  addEventListener('pointercancel', endDrag, { passive: true });
  document.addEventListener('pointerleave', () => { target.px = 0; target.py = 0; });

  // wipe helpers: x of the seam at mid-height (the out-of-focus scene keeps a sliver at the narrow end)
  const seamCentre = mix => { const half = Math.abs(SLANT) * h / 2, cDesk = w * (1 - SLIVER) - half; return cDesk + (w - 2 * cDesk) * mix; };
  const setVar = (el, cache, k, v) => { if (cache[k] !== v) { cache[k] = v; el.style.setProperty(k, v); } };
  let prevC = null, prevMix = 1, lean = 0;
  const seamCache = {};
  const wipeFrame = (dt) => {
    const vel = (cur.mix - prevMix) / Math.max(dt, 1e-3); prevMix = cur.mix;
    lean += (Math.max(-1, Math.min(1, vel * 1.6)) - lean) * (1 - Math.pow(1 - 0.08, dt * 60));
    if (Math.abs(lean) < 0.002) lean = 0;
    setAngle(ANGLE_DESK + (ANGLE_BIKE - ANGLE_DESK) * cur.mix - lean * LEAN);
    const c = seamCentre(cur.mix);
    const L = w * Math.abs(SIN) + h * Math.abs(COS), soft = w * SOFT, ang = ANGLE.toFixed(2) + 'deg';
    for (const sl of slots) {
      const m = Math.min(1, Math.max(0, (cur.mix - sl.win[0]) / (sl.win[1] - sl.win[0])));
      const p = L / 2 + (seamCentre(m) - w / 2) * SIN;
      setVar(sl.slot, sl.c, '--angle', ang);
      setVar(sl.slot, sl.c, '--a', (p - soft).toFixed(1) + 'px');
      setVar(sl.slot, sl.c, '--b', (p + soft).toFixed(1) + 'px');
    }
    // the bright line rides on the landscape's edge
    const bgw = WIPE_WINDOWS['bike-bg'];
    const lineAt = L / 2 + (seamCentre(Math.min(1, Math.max(0, (cur.mix - bgw[0]) / (1 - bgw[0])))) - w / 2) * SIN;
    setVar(seam, seamCache, '--angle', ang);
    setVar(seam, seamCache, '--s', lineAt.toFixed(1) + 'px');
    const speed = prevC === null ? 0 : Math.abs(c - prevC) / Math.max(dt, 1e-3) / w;
    prevC = c;
    setVar(seam, seamCache, 'opacity', Math.min(1, 0.55 + speed * 0.6).toFixed(2));
  };

  let last = performance.now(), t0 = last;
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    // Before anyone moves, give a small peek of the desk side as a hint
    if (!touched && !reduced) {
      const tt = (now - t0) / 1000;
      target.mix = MODE === 'wipe'
        ? 1 - (tt > 1.2 ? 0.06 * (1 - Math.cos((tt - 1.2) * 1.6)) * 0.5 * (1 + Math.sin(tt * 0.4)) : 0)
        : 1 - (tt > 1.2 ? 0.07 * (1 - Math.cos((tt - 1.2) * 1.3)) * 0.5 : 0);
    }

    // mist: slow, soft easing (the reference never snaps); wipe: a little quicker, like v1
    const k = 1 - Math.pow(1 - (reduced ? 0.3 : (MODE === 'wipe' ? 0.1 : 0.06)), dt * 60);
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
    if (MODE === 'wipe') {
      for (const L of layers) {
        const tx = reduced ? 0 : -cur.px * 16 * L.depth * s, ty = reduced ? 0 : -cur.py * 11 * L.depth * s;
        put(L.el, 'transform', `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`, L, '_tf');
      }
      wipeFrame(dt);
      if (onScreen && !document.hidden) requestAnimationFrame(frame); else running = false;
      return;
    }
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
