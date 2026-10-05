/* Smart panel, tablets and up: which half of the screen the cursor is on picks the brand.
   Left half  → Smart (light, LTR), the panel's normal background.
   Right half → Zurich (dark, RTL), background #262e4a.
   html[data-smart-bg] always holds Smart's side (background + Smart's own text), and is reset
   to Zurich once Smart has left the screen, so the panel slides in already dark.
   html[data-smart-side] is set only while Smart is on screen (shared nav colours).
   The Smart 3D iframe (smart.html) is told which side to spin to.
   Smart opens on Zurich. Phones (≤700px, or a phone on its side) are left alone: they keep the original scene. */
(function () {
  var MOBILE = '(max-width: 700px), (max-height: 500px) and (orientation: landscape)';
  var mq = window.matchMedia(MOBILE);
  var html = document.documentElement;
  var side = 'zurich';
  var on = null;
  // The 3D devices only follow the cursor after it has really moved, like the Guardian scene:
  // arriving from the bottom nav would otherwise drag them down. Until then they rest centred.
  var armed = false, armFrom = null;
  var ARM_PX = 40;

  function smartOn() {
    var el = document.querySelector('[data-active-entry]');
    return !!el && el.getAttribute('data-active-entry') === 'smart' && !mq.matches;
  }
  function frame() { return document.querySelector('[data-role="cv-smart3d"] iframe'); }
  function tellFrame(msg) {
    var f = frame();
    if (f && f.contentWindow) { try { f.contentWindow.postMessage(msg, '*'); } catch (e) {} }
  }
  var resetTimer = null;
  function apply() {
    if (mq.matches) html.removeAttribute('data-smart-bg');
    else html.setAttribute('data-smart-bg', side);
    if (on) html.setAttribute('data-smart-side', side);
    else html.removeAttribute('data-smart-side');
    tellFrame({ type: 'smart-side', side: side });
  }
  function check() {
    var now = smartOn();
    if (now === on) return;
    on = now;
    clearTimeout(resetTimer);
    armed = false; armFrom = null;
    if (on) tellFrame({ type: 'smart-pointer', nx: 0.5, ny: 0.5 });
    if (!on) {
      // every visit opens on Zurich: reset once Smart has faded/slid out, so it's ready off screen
      resetTimer = setTimeout(function () { if (!on) { side = 'zurich'; apply(); } }, 900);
    }
    apply();
  }
  function fromX(x) {
    if (!on) return;
    var s = x >= window.innerWidth / 2 ? 'zurich' : 'smart';
    if (s !== side) { side = s; apply(); }
  }

  // cursor over the page itself (title, description, palettes, edges)…
  window.addEventListener('mousemove', function (e) {
    if (!on) return;
    fromX(e.clientX);
    var f = frame();
    if (!f) return;
    // over the panel nav (bottom bar) the devices stay where they are
    if (e.target && e.target.closest && e.target.closest('[data-role="cv-yearnav"]')) return;
    if (!armed) {
      if (!armFrom) { armFrom = { x: e.clientX, y: e.clientY }; return; }
      if (Math.hypot(e.clientX - armFrom.x, e.clientY - armFrom.y) < ARM_PX) return;
      armed = true;
    }
    var r = f.getBoundingClientRect();
    if (r.width && r.height) {
      tellFrame({ type: 'smart-pointer', nx: (e.clientX - r.left) / r.width, ny: (e.clientY - r.top) / r.height });
    }
  }, { passive: true });

  // …and over the 3D iframe, which reports its cursor in its own coordinates
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || (d.type !== 'smart-ptr' && d.type !== 'smart-tap') || !on) return;   // smart-tap: a touch tap inside the 3D scene
    var f = frame();
    if (!f || e.source !== f.contentWindow) return;
    var r = f.getBoundingClientRect();
    fromX(r.left + d.nx * r.width);
  });

  // cursor leaves the window: ease the devices back to their resting position
  document.addEventListener('mouseleave', function () {
    if (on) tellFrame({ type: 'smart-pointer', nx: 0.5, ny: 0.5 });
  });

  // touch tablets have no cursor: a tap on either half switches
  window.addEventListener('click', function (e) {
    if (!on || (e.target && e.target.closest && e.target.closest('a, button'))) return;
    fromX(e.clientX);
  });

  // touch tablets: a sideways swipe flips the theme first, like two cards (swipe left → Zurich on
  // the right, swipe right → Smart on the left); once on that side, the same swipe changes section.
  // Called by index.html's swipe handlers; returns true when it used the swipe.
  window.__ptSmartSwipe = function (dir) {
    if (!on) return false;
    var want = dir > 0 ? 'zurich' : 'smart';
    if (want === side) return false;
    side = want; apply();
    return true;
  };

  function start() {
    check();
    new MutationObserver(check).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-active-entry'] });
    var onMq = function () { check(); apply(); };
    try { mq.addEventListener('change', onMq); } catch (e) { try { mq.addListener(onMq); } catch (e2) {} }
    // the iframe mounts lazily; when it (re)loads, give it the current side
    document.addEventListener('load', function (e) {
      if (e.target && e.target.tagName === 'IFRAME' && e.target === frame()) setTimeout(apply, 50);
    }, true);
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
