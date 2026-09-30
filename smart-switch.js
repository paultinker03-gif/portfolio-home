/* Smart panel, tablets and up: which half of the screen the cursor is on picks the brand.
   Left half  → Smart (light, LTR), the panel's normal background.
   Right half → Zurich (dark, RTL), background #051240.
   Sets html[data-smart-side="smart"|"zurich"] while Smart is on screen (the CSS in
   index.html keys off it) and tells the Smart 3D iframe (smart.html) which side to flip to.
   Smart opens on Zurich. Phones (≤700px, or a phone on its side) are left alone: they keep the original scene. */
(function () {
  var MOBILE = '(max-width: 700px), (max-height: 500px) and (orientation: landscape)';
  var mq = window.matchMedia(MOBILE);
  var html = document.documentElement;
  var side = 'zurich';
  var on = null;

  function smartOn() {
    var el = document.querySelector('[data-active-entry]');
    return !!el && el.getAttribute('data-active-entry') === 'smart' && !mq.matches;
  }
  function frame() { return document.querySelector('[data-role="cv-smart3d"] iframe'); }
  function tellFrame(msg) {
    var f = frame();
    if (f && f.contentWindow) { try { f.contentWindow.postMessage(msg, '*'); } catch (e) {} }
  }
  function apply() {
    if (on) html.setAttribute('data-smart-side', side);
    else html.removeAttribute('data-smart-side');
    tellFrame({ type: 'smart-side', side: side });
  }
  function check() {
    var now = smartOn();
    if (now === on) return;
    on = now;
    if (on) side = 'zurich'; // every visit opens on Zurich until the cursor says otherwise
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
    var r = f.getBoundingClientRect();
    if (r.width && r.height) {
      tellFrame({ type: 'smart-pointer', nx: (e.clientX - r.left) / r.width, ny: (e.clientY - r.top) / r.height });
    }
  }, { passive: true });

  // …and over the 3D iframe, which reports its cursor in its own coordinates
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'smart-ptr' || !on) return;
    var f = frame();
    if (!f || e.source !== f.contentWindow) return;
    var r = f.getBoundingClientRect();
    fromX(r.left + d.nx * r.width);
  });

  // touch tablets have no cursor: a tap on either half switches
  window.addEventListener('click', function (e) {
    if (!on || (e.target && e.target.closest && e.target.closest('a, button'))) return;
    fromX(e.clientX);
  });

  function start() {
    check();
    new MutationObserver(check).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-active-entry'] });
    try { mq.addEventListener('change', check); } catch (e) { try { mq.addListener(check); } catch (e2) {} }
    // the iframe mounts lazily; when it (re)loads, give it the current side
    document.addEventListener('load', function (e) {
      if (e.target && e.target.tagName === 'IFRAME' && e.target === frame()) setTimeout(apply, 50);
    }, true);
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
