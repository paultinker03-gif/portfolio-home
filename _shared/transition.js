/* paultinker 2026: home → case study transition, and the home hero scenes inside each case study.
 *
 * One file for every site. It works out where it is from the hostname:
 *   paultinker.uk (home)      a click on a case study link slides a panel up in that case study's
 *                             page colour (white or black), then opens the case study.
 *   smart.paultinker.uk etc.  the content slides in (transition.css), the home page's 3D hero for
 *                             this project is put in the hero slot under the titles and follows the
 *                             cursor anywhere on the page, and "Back to portfolio" slides a panel up
 *                             in the home section's colour.
 * Each case study keeps its own subdomain, so this is a hand-off between two page loads: the panel
 * ends the home page on a flat colour, and the case study starts on that same colour.
 *
 * Locally (http://localhost:5200 and http://smart.localhost:5200 …) links to paultinker.uk are
 * pointed at the local server instead, so the whole thing can be tried before publishing.
 *
 * To tune a case study, edit its entry in CASES below.
 */
(() => {
  const CASES = {
    smart: {
      surface: '#ffffff',              // the case study's page colour: the panel that slides up on home
      homeColor: '#262e4a',            // the home section's colour: the panel that slides up going back (Smart opens on Zurich)
      homeHash: 'smart',
      scene: 'smart.html?embed=1&bg=transparent&duo=1&v=22',
      // the scene's own files, fetched while the title slides in so the scene opens from the cache
      assets: ['smart-scene.js?v=20', 'uploads/smart-dashboard-light.webp?v=8', 'uploads/smart-balance-light.webp?v=8', 'uploads/zurich-dashboard-dark.webp?v=8', 'uploads/zurich-balance-dark.webp?v=8'],
      pointer: 'smart',                // how the scene is told where the cursor is (see tellScene)
      stage: '#B9CEE9',                // background behind the scene, as on home
      stageAlt: '#262e4a',             // Smart only: right half of the screen = Zurich, dark
      // the colour palettes from the Smart panel on home: Smart (light) left, Zurich (dark) right
      extra: '<div class="pt-pal" data-pal="smart"><span style="background:#E3E8F1"></span><span style="background:#003357"></span><span style="background:#0C2943"></span><span style="background:#DE6A7F"></span></div>'
           + '<div class="pt-pal" data-pal="zurich"><span style="background:#1A2030"></span><span style="background:#05123F"></span><span style="background:#081C63"></span><span style="background:#4EC8FF"></span></div>',
    },
    nespresso: {
      surface: '#ffffff', homeColor: '#4A2060', homeHash: 'nespresso',
      lockedSurface: '#4A2060',        // live site: the page opens on the purple password screen, so the panel is purple too (Paul 2026-10-29)
      scene: 'nespresso.html?v=5', pointer: 'bt',
      assets: ['support.js', 'boot.js', 'vendor/react.production.min.js', 'vendor/react-dom.production.min.js', 'assets/bt-2.webp', 'assets/bt-1.webp', 'assets/bt-3.webp'],
      stage: '#4A2060',
    },
    vodafone: {
      surface: '#ffffff', homeColor: '#930001', homeHash: 'vodafone',
      scene: 'vodafone.html?embed=1&v=5', pointer: 'bridge',
      // the scene starts loading as the title slides in, not after (Paul: the hero came in too late)
      early: true,
      assets: ['uploads/get-started.webp?v=3', 'uploads/Welcome-Option-02.webp', 'uploads/mobile-screen-02.webp', 'uploads/0301-dashboard.webp'],
      stage: 'radial-gradient(140% 140% at 90% 8%, oklch(0.58 0.23 29) 0%, oklch(0.4 0.2 25) 45%, oklch(0.14 0.08 20) 100%)',
    },
    guardian: {
      surface: '#0a0a0b', homeColor: '#077a60', homeHash: 'the-guardian',
      scene: 'guardian.html?embed=1&v=16', pointer: 'bridge',
      assets: ['guardian-scene.js?v=13', 'uploads/spotify-1.webp?v=11', 'uploads/spotify-2.webp?v=11', 'uploads/spotify-3.webp?v=11', 'uploads/blob-left.svg', 'uploads/blob-right.svg'],
      stage: '#077a60',
    },
    earlier: {
      surface: '#ffffff', homeColor: '#c4beee', homeHash: 'agencies',
      video: 'assets/capco-video.webm', // no 3D scene on home for Agencies: its video tilts with the cursor
      stage: 'radial-gradient(70% 55% at 8% 12%, #8FBEFF 0%, rgba(143,190,255,0) 62%), radial-gradient(70% 70% at 92% 16%, #A98BD9 0%, rgba(169,139,217,0) 60%), radial-gradient(60% 55% at 84% 96%, #D46BD0 0%, rgba(212,107,208,0) 58%), radial-gradient(90% 80% at 62% 78%, #D9C6EC 0%, rgba(217,198,236,0) 70%), linear-gradient(150deg, #E6CDEA 0%, #D8C8EE 55%, #C9B4E4 100%)',
    },
    ai: {
      // the AI log (ai.paultinker.uk): the same panel and entrance, no hero scene
      surface: '#ffffff', homeColor: '#184a76', homeHash: 'intro',
    },
  };

  const WIPE_MS = 720;
  const html = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Phones keep the plain pages: the colour panels, but no entrance and the case studies' own static hero images.
  // (Same breakpoint the home page uses for its phone stills.)
  const PHONE = matchMedia('(max-width: 700px), (max-height: 500px) and (orientation: landscape)').matches;
  const LOCAL = /(^|\.)localhost$/.test(location.hostname);
  const port = location.port ? ':' + location.port : '';
  const homeOrigin = LOCAL ? `${location.protocol}//localhost${port}` : 'https://paultinker.uk';
  const caseOrigin = (slug) => LOCAL ? `${location.protocol}//${slug}.localhost${port}` : `https://${slug}.paultinker.uk`;
  // the colour of the panel that slides up before a case study opens; locally the Nespresso page is not locked
  const panelColour = (slug) => (!LOCAL && CASES[slug].lockedSurface) || CASES[slug].surface;
  const caseOf = (host) => {
    const m = /^([a-z]+)\.(paultinker\.uk|localhost)$/.exec(host);
    return m && CASES[m[1]] ? m[1] : null;
  };
  const isHome = (host) => host === 'paultinker.uk' || host === 'www.paultinker.uk' || host === 'localhost';
  const here = caseOf(location.hostname);

  // Locally, send paultinker.uk links to the local server.
  const localise = (url) => {
    if (!LOCAL) return url;
    const slug = caseOf(url.hostname);
    if (slug) return new URL(url.pathname + url.search + url.hash, caseOrigin(slug));
    if (isHome(url.hostname)) return new URL(url.pathname + url.search + url.hash, homeOrigin);
    return url;
  };
  const linkOf = (e) => {
    const a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return null;
    let url;
    try { url = new URL(a.href, location.href); } catch (err) { return null; }
    return { a, url };
  };
  const plainClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;

  const prefetched = new Set();
  const prefetch = (href) => {
    if (prefetched.has(href)) return;
    prefetched.add(href);
    const l = document.createElement('link');
    l.rel = 'prefetch'; l.href = href; l.as = 'document';
    document.head.appendChild(l);
  };

  // A full-screen panel slides up in `color`, then `href` opens.
  const wipeTo = (href, color) => {
    if (reduced) { location.href = href; return; }
    const wipe = document.createElement('div');
    wipe.className = 'pt-wipe';
    wipe.style.setProperty('--pt-wipe', color);
    wipe.innerHTML = '<div class="pt-wipe-panel"></div>';
    document.body.appendChild(wipe);
    html.classList.add('pt-leaving');
    document.querySelectorAll('iframe').forEach((f) => {
      try {
        f.contentWindow.postMessage({ type: 'vf3d-visibility', state: 'inactive' }, '*');
        f.contentWindow.postMessage({ type: 'gu3d-visibility', state: 'inactive' }, '*');
      } catch (e) {}
    });
    wipe.getBoundingClientRect();
    requestAnimationFrame(() => wipe.classList.add('go'));
    let gone = false;
    const go = () => { if (!gone) { gone = true; location.href = href; } };
    wipe.firstChild.addEventListener('transitionend', go, { once: true });
    setTimeout(go, WIPE_MS + 200);
  };
  // Coming back with the browser's Back button: take the panel away again.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    document.querySelectorAll('.pt-wipe').forEach((w) => w.remove());
    html.classList.remove('pt-leaving');
  });

  // ---------------------------------------------------------------- home
  if (!here) {
    const caseLink = (e) => {
      const l = linkOf(e);
      if (!l) return null;
      const slug = caseOf(l.url.hostname);
      return slug ? { ...l, slug } : null;
    };
    const ready = (e) => {
      const l = caseLink(e);
      if (!l) return;
      const url = localise(l.url);
      if (LOCAL && l.a.href !== url.href) l.a.href = url.href;
      prefetch(url.origin + url.pathname);
    };
    // Back from a case study (?from=smart …): the page starts on that section's colour (set before the
    // first paint by the snippet in index.html's <head>), and the content fades in once it has rendered.
    if (html.classList.contains('pt-return')) {
      const u = new URL(location.href);
      u.searchParams.delete('from');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
      const t0 = performance.now();
      // the big pictures, videos and 3D scenes each fade in on their own as soon as they are ready
      // (hidden by html.pt-assets until then), so nothing pops in after the page has faded in
      const ready = (el) => {
        if (el.tagName === 'IFRAME') { try { return el.contentDocument && el.contentDocument.readyState === 'complete' && el.contentWindow.location.href !== 'about:blank'; } catch (e) { return true; } }
        if (el.tagName === 'VIDEO') return el.readyState >= 2;
        return el.complete && el.naturalWidth > 0;
      };
      const pending = new Map();
      const sweep = () => {
        document.querySelectorAll('iframe, video, [data-role^="cv-"] img').forEach((el) => {
          if (el.classList.contains('pt-shown') || pending.has(el) || !ready(el)) return;
          // a scene needs a frame or two to draw after its page has loaded
          pending.set(el, setTimeout(() => el.classList.add('pt-shown'), el.tagName === 'IFRAME' ? 180 : 0));
        });
        if (performance.now() - t0 < 4000) setTimeout(sweep, 60);
        else html.classList.remove('pt-assets');
      };
      sweep();
      const show = () => requestAnimationFrame(() => requestAnimationFrame(() => {
        html.classList.add('pt-in');
        // once faded in, hand the page colour back to the home page
        setTimeout(() => html.classList.remove('pt-return', 'pt-in'), 500);
      }));
      // wait until home has rendered its sections and coloured the page for the open one
      // and, for Nespresso, until its composition has been scaled to fit (it starts full size, then shrinks)
      const nespFitted = () => {
        if (html.getAttribute('data-pt-from') !== 'nespresso') return true;
        try {
          const st = document.querySelector('iframe[data-role="cv-bt3d"]').contentDocument.querySelector('[style*="1592px"]');
          return !!st && /scale/.test(st.style.transform);
        } catch (e) { return true; }
      };
      // and, for Smart, until its 3D phones are drawn (they are centred on the page as the scene starts)
      const smartDrawn = () => {
        if (html.getAttribute('data-pt-from') !== 'smart') return true;
        try { return !!document.querySelector('[data-role="cv-smart3d"] iframe').contentDocument.querySelector('canvas'); }
        catch (e) { return true; }
      };
      const rendered = () => document.querySelector('[data-active-entry]') && document.body.style.background && nespFitted() && smartDrawn();
      const wait = () => (rendered() || performance.now() - t0 > 2000) ? setTimeout(show, 60) : setTimeout(wait, 30);
      wait();
    }
    // phones get the colour panel too (Paul 2026-10-28), just no 3D hand-off
    document.addEventListener('pointerover', ready, true);
    document.addEventListener('focusin', ready, true);
    document.addEventListener('click', (e) => {
      const l = caseLink(e);
      if (!l || !plainClick(e)) return;
      e.preventDefault();
      const url = localise(l.url);
      url.searchParams.set('via', 'home');
      wipeTo(url.href, panelColour(l.slug));
    }, true);
    return;
  }

  // ---------------------------------------------------------- case study
  const C = CASES[here];
  html.style.setProperty('--pt-stage', C.stage);
  if (C.stageAlt) html.style.setProperty('--pt-stage-alt', C.stageAlt);

  // came from home: tidy the address bar
  if (new URLSearchParams(location.search).has('via')) {
    const u = new URL(location.href);
    u.searchParams.delete('via');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  }

  // links back to paultinker.uk: local server when local, and the panel in the home section's colour
  document.querySelectorAll('a[href]').forEach((a) => {
    try {
      const url = localise(new URL(a.href, location.href));
      if (url.href !== a.href) a.href = url.href;
    } catch (e) {}
  });

  // ---- "Next case study": a small card in the footer's bottom-right corner, with the next study's
  // name and a still of its hero. Same order as the home page.
  const NEXT = {
    vodafone: ['smart', 'Smart Pension'],
    smart: ['nespresso', 'Nespresso'],
    nespresso: ['guardian', 'The Guardian'],
    guardian: ['earlier', 'Earlier work'],
    earlier: ['vodafone', 'Vodafone'],
  };
  const foot = document.querySelector('footer.foot');
  if (NEXT[here] && foot) {
    const [slug, name] = NEXT[here];
    const o = caseOrigin(slug);
    const a = document.createElement('a');
    a.className = 'pt-next';
    a.href = o + '/';
    a.dataset.next = slug;
    a.style.setProperty('--pt-next-stage', CASES[slug].stage);
    a.innerHTML = `<span class="pt-next-row"><span class="pt-next-label">Next case study</span><span class="pt-next-name">${name}</span><span class="pt-next-arrow" aria-hidden="true">→</span></span>`
      + `<span class="pt-next-media"><img src="${o}/images/next-preview-1440.webp?v=2" srcset="${o}/images/next-preview-1440.webp?v=2 1440w, ${o}/images/next-preview.webp?v=2 2880w" sizes="(max-width: 700px) 100vw, 360px" width="2880" height="1080" alt="" loading="lazy" decoding="async"></span>`;
    a.addEventListener('pointerenter', () => prefetch(o + '/'), { once: true });
    // without IntersectionObserver: a still card above the footer links
    if (!('IntersectionObserver' in window)) {
      foot.classList.add('pt-foot');
      foot.prepend(a);
    } else {
      // tablet and up: pinned in the browser's bottom-right corner. Near the end of the page it slides in
      // while scrolling down, and slides away again on any scroll back up.
      a.classList.add('pt-next-corner');
      // the opposite of the page (Paul): black with white text on white pages, white with black text on black ones
      const rgb = (el) => (getComputedStyle(el).backgroundColor.match(/[\d.]+/g) || []).map(Number);
      let bg = rgb(document.body);
      if (bg.length < 3 || bg[3] === 0) bg = rgb(document.documentElement);
      if (bg.length < 3 || bg[3] === 0) bg = [255, 255, 255];
      const dark = bg[0] * .299 + bg[1] * .587 + bg[2] * .114 < 128;
      a.style.setProperty('--pt-next-surface', dark ? '#fff' : '#111');
      a.style.color = dark ? '#111' : '#fff';
      document.body.appendChild(a);
      // phones and narrow windows (Paul): same corner card and animation, but the page ends with room
      // below the footer links, so at the very bottom the card opens underneath them instead of over them
      const narrow = matchMedia('(max-width: 1000px)');
      const room = () => { foot.style.paddingBottom = narrow.matches ? (a.offsetHeight + 40) + 'px' : ''; };
      room(); addEventListener('resize', room);
      let near = false, lastY = scrollY, shown = false;
      const set = (on) => { if (on !== shown) { shown = on; a.classList.toggle('pt-next-in', on); a.inert = !on; } };
      set(false);
      new IntersectionObserver((es) => {
        near = es.some((x) => x.isIntersecting);
        if (!near) set(false);
        else if (scrollY >= lastY) set(true);
      }, { rootMargin: '0px 0px 25% 0px' }).observe(foot);
      let ticking = false;
      addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          // tablets and phones bounce past the ends of the page; read the scroll as if they didn't, and keep
          // the card at the very bottom, so the bounce doesn't flick it away (Paul saw it on a tablet, 2026-10-29)
          const max = document.documentElement.scrollHeight - innerHeight;
          const y = Math.max(0, Math.min(scrollY, max)), dy = y - lastY;
          if (near && y >= max - 4) { lastY = y; set(true); return; }
          if (Math.abs(dy) < 4) return;
          lastY = y;
          set(near && dy > 0);
        });
      }, { passive: true });
    }
  }

  document.addEventListener('click', (e) => {
    const l = linkOf(e);
    if (!l || !plainClick(e)) return;
    const next = l.a.classList.contains('pt-next') && l.a.dataset.next;
    if (next) {   // on to the next case study: the same hand-off as from home
      e.preventDefault();
      l.url.searchParams.set('via', 'home');
      wipeTo(l.url.href, panelColour(next));
      return;
    }
    if (l.url.origin !== homeOrigin) return;
    e.preventDefault();
    l.url.searchParams.set('from', here);
    wipeTo(l.url.href, C.homeColor);
  }, true);
  // phones: the colour panels above, but no entrance and no 3D hero (they keep the static images)
  if (PHONE) return;

  // Start the entrance once the fonts are in (no text reflowing mid-slide), on a fresh frame.
  // The snippet in <head> starts it anyway after 2.5s if anything here goes wrong.
  const fontsIn = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))]) : Promise.resolve();
  const entered = fontsIn.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
    html.classList.add('pt-go');
    // the 3D scene is only built once everything has slid in, so building it can't make the slide stutter
    setTimeout(r, html.classList.contains('pt-intro') ? 900 : 0);
  }))));

  // ---- AI blog: everything below the opening slides up as it scrolls into view, like the opening did
  if (html.dataset.site === 'ai' && 'IntersectionObserver' in window) {
    const later = [...document.querySelectorAll('.entry > :nth-child(n+5), .entry > section > *')]
      .filter((el) => el.getBoundingClientRect().top > innerHeight);
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('pt-shown'); io.unobserve(e.target);
    }), { rootMargin: '0px 0px -8% 0px' });
    later.forEach((el) => { el.classList.add('pt-later'); io.observe(el); });
  }

  // ---- the hero: the home page's scene in the old hero image's slot
  // Fetch the scene's page now, while the title slides in, so the frame opens from the cache.
  if (C.scene) {
    prefetch(`${homeOrigin}/${C.scene}`);
    (C.assets || []).forEach((a) => {
      const l = document.createElement('link');
      l.rel = 'preload';
      l.href = `${homeOrigin}/${a}`;
      if (/\.js(\?|$)/.test(a)) l.as = 'script';
      else { l.as = 'image'; l.crossOrigin = 'anonymous'; }   // three.js loads textures with CORS
      document.head.appendChild(l);
    });
  }
  const fig = document.querySelector('[data-pt-scene]');
  if (!fig) return;
  const img = fig.querySelector('img');
  const stage = document.createElement('div');
  stage.className = 'pt-stage';
  stage.setAttribute('aria-hidden', 'true');
  // cropped to the old hero's shape, 8:3 (the <img> itself is the phones' portrait still)
  stage.style.aspectRatio = fig.dataset.ptRatio || '13 / 4';   // 18% shorter than the old 8:3 (Paul 2026-10-28)
  const old = img && (img.closest('picture') || img);   // the old hero (a <picture> on desktop: a 1px placeholder)
  if (old) { old.before(stage); stage.appendChild(old); } else fig.prepend(stage);
  // Smart's scene opens on Zurich, so its stage starts dark rather than flashing the light blue first
  if (C.pointer === 'smart') stage.dataset.side = 'zurich';

  let frame = null, target = null;

  if (C.video) {
    const card = document.createElement('div');
    card.className = 'pt-card';
    card.innerHTML = `<video src="${homeOrigin}/${C.video}" autoplay muted loop playsinline preload="auto"></video>`;
    stage.appendChild(card);
    target = card;
    stage.classList.add('pt-ready');
  } else if (C.scene) {
    frame = document.createElement('iframe');
    frame.className = 'pt-scene';
    frame.tabIndex = -1;
    frame.title = '';
    frame.setAttribute('allowtransparency', 'true');
    frame.setAttribute('scrolling', 'no');
    (C.early ? fontsIn : entered).then(() => { frame.src = `${homeOrigin}/${C.scene}`; });
    // the scenes reveal themselves once their textures are in; fade the frame in a moment after load
    frame.addEventListener('load', () => { if (frame.src) setTimeout(() => stage.classList.add('pt-ready'), C.early ? 300 : 700); });
    stage.appendChild(frame);
  }
  if (C.extra) stage.insertAdjacentHTML('beforeend', C.extra);

  // ---- the cursor, anywhere on the page, moves the scene
  const send = (msg) => { try { frame.contentWindow.postMessage(msg, '*'); } catch (e) {} };
  let side = null;
  const tellScene = (cx, cy) => {
    if (frame) {
      const r = frame.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const nx = (cx - r.left) / r.width;
      const ny = Math.min(1, Math.max(0, (cy - r.top) / r.height));
      if (C.pointer === 'smart') {
        const s = cx >= innerWidth / 2 ? 'zurich' : 'smart';
        if (s !== side) { side = s; stage.dataset.side = s; }
        send({ type: 'smart-side', side: s });   // every time: the scene may not have been listening yet
        send({ type: 'smart-pointer', nx, ny });
      } else if (C.pointer === 'bt') send({ type: 'btPointer', nx, ny, dx: 0 });
      else send({ type: 'pt-pointer', nx, ny });   // read by home/scene-bridge.js
    } else if (target) {
      const nx = cx / innerWidth * 2 - 1, ny = cy / innerHeight * 2 - 1;
      target.style.setProperty('--rx', (-ny * 6).toFixed(2) + 'deg');
      target.style.setProperty('--ry', (nx * 9).toFixed(2) + 'deg');
    }
  };
  let raf = 0, px = innerWidth / 2, py = innerHeight / 2, moved = false;
  addEventListener('mousemove', (e) => {
    px = e.clientX; py = e.clientY; moved = true;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; tellScene(px, py); });
  }, { passive: true });
  // the scene sits under the iframe's own cursor while you're over it, so keep the Smart side in step
  addEventListener('message', (e) => {
    if (!frame || e.source !== frame.contentWindow || !e.data || e.data.type !== 'smart-ptr') return;
    const r = frame.getBoundingClientRect();
    tellScene(r.left + e.data.nx * r.width, r.top + e.data.ny * r.height);
  });
  // until the cursor has moved, only tell the scene which side to show: a made-up cursor at the middle
  // of the screen sits below the phones' centre and tilted them just as they faded in (Paul 2026-10-29)
  if (frame && C.pointer === 'smart') frame.addEventListener('load', () => {
    side = null;
    if (moved) return tellScene(px, py);
    const s = px >= innerWidth / 2 ? 'zurich' : 'smart';
    side = s; stage.dataset.side = s; send({ type: 'smart-side', side: s });
  });

  // ---- stop drawing the scene when it's scrolled away (same messages the home page sends)
  if (frame && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      const state = e.isIntersecting ? 'active' : 'inactive';
      send({ type: 'vf3d-visibility', state });
      send({ type: 'gu3d-visibility', state });
    }).observe(stage);
  }
})();
