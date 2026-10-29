// paultinker 2026: lets a case study page drive this 3D scene with its own cursor.
// The case study (shared/transition.js) posts { type: 'pt-pointer', nx, ny } with the cursor's
// position over this frame (0–1); it is replayed here as a mouse move, so the scene follows the
// cursor exactly as it does when the cursor is over the scene itself.
(() => {
  addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.type !== 'pt-pointer') return;
    const x = d.nx * innerWidth, y = d.ny * innerHeight;
    const el = document.elementFromPoint(
      Math.min(innerWidth - 1, Math.max(0, x)), Math.min(innerHeight - 1, Math.max(0, y))
    ) || document.body;
    const init = { clientX: x, clientY: y, bubbles: true };
    el.dispatchEvent(new PointerEvent('pointermove', { ...init, pointerType: 'mouse' }));
    el.dispatchEvent(new MouseEvent('mousemove', init));
  });
})();
