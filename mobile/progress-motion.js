/* Presentation only: interpolate confirmed progress, never advance game state. */
(() => {
  'use strict';
  const states = new WeakMap(), moving = new Set();
  const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
  let frame = 0;
  function paint(node, state, now) {
    const elapsed = Math.min(1, Math.max(0, (now - state.started) / (state.duration || 400)));
    state.value = state.from + (state.target - state.from) * elapsed;
    node.style.width = state.value + '%';
    return elapsed < 1;
  }
  function tick(now) {
    frame = 0;
    for (const node of moving) {
      if (!node.isConnected || !paint(node, states.get(node), now)) moving.delete(node);
    }
    if (moving.size) frame = requestAnimationFrame(tick);
  }
  window.MobileProgress = {
    set(node, amount, options = {}) {
      const target = clamp(amount), now = performance.now();
      let state = states.get(node);
      if (!state) {
        state = {value: target, from: target, target, started: now};
        states.set(node, state);
        node.style.width = target + '%';
        return;
      }
      if (options.snap || (!options.decrease && target < state.target)) {
        Object.assign(state, {value: target, from: target, target, started: now});
        node.style.width = target + '%';
        moving.delete(node);
        return;
      }
      if (target === state.target) return;
      paint(node, state, now);
      Object.assign(state, {from: state.value, target, started: now, duration: options.duration || 400});
      moving.add(node);
      if (!frame) frame = requestAnimationFrame(tick);
    }
  };
})();
