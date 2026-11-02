/* Animate confirmed snapshot changes only; never grants attributes or advances time. */
(() => {
  'use strict';
  const format = value => window.MobileCultivationBalance.format(value);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let previous = null, power = null, frame = 0, overlay = null;
  const effects = new Set();
  function valueAt(now) {
    if (!power) return null;
    const t = Math.min(1, Math.max(0, (now - power.start) / 700));
    return power.from + (power.target - power.from) * (1 - Math.pow(1 - t, 3));
  }
  function paint(now) {
    frame = 0;
    if (!power) return;
    const value = Math.round(valueAt(now));
    document.querySelectorAll('[data-combat-power]').forEach(node => {
      node.textContent = format(value);
      node.classList.toggle('is-power-growing', value < power.target);
      node.setAttribute('aria-label', `实力 ${format(power.target)}`);
    });
    if (now - power.start < 700 && power.from !== power.target) frame = requestAnimationFrame(paint);
  }
  function clearEffects() {
    effects.forEach(item => clearTimeout(item.timer));
    effects.clear(); overlay?.remove(); overlay = null;
  }
  function place(root) {
    if (!overlay) return;
    const box = root.getBoundingClientRect();
    Object.assign(overlay.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
  }
  function floatGains(root, gains, insight = false) {
    if ((!gains.length && !insight) || document.hidden) return;
    window.MobileAudio?.effect(insight ? 'insight' : 'layer', insight ? .45 : .18);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'cultivation-gain-overlay';
      overlay.setAttribute('aria-live', 'polite');
      overlay.setAttribute('aria-atomic', 'false');
      document.body.append(overlay);
    }
    place(root);
    // Keep rapid layers legible and bounded without queuing old gains for later.
    if (effects.size >= 3) {
      const oldest = effects.values().next().value;
      clearTimeout(oldest.timer); oldest.node.remove(); effects.delete(oldest);
    }
    const node = document.createElement('div');
    node.className = 'cultivation-gain' + (insight ? ' is-insight' : '');
    node.style.setProperty('--gain-offset', `${effects.size * 40}px`);
    if (insight) {
      const title = document.createElement('strong');
      title.className = 'cultivation-insight-title';
      title.textContent = '顿悟';
      node.append(title);
    }
    gains.forEach(([label, delta, unit='']) => {
      const row = document.createElement('span');
      row.textContent = `${label} +${format(delta)}${unit}`;
      node.append(row);
    });
    overlay.append(node);
    const effect = { node, timer: 0 };
    effect.timer = setTimeout(() => { node.remove(); effects.delete(effect); }, insight ? 2600 : 1900);
    effects.add(effect);
  }
  function update(snapshot) {
    const root = document.querySelector('.moon-cultivation');
    if (!snapshot?.isInGame) {
      previous = null; power = null; clearEffects();
      if (frame) cancelAnimationFrame(frame); frame = 0;
      return;
    }
    const now = performance.now(), slot = snapshot.currentSlot;
    const stats = snapshot.stats || {};
    const target = window.MobilePresentation?.combatPower(stats);
    const sameSlot = previous?.slot === slot;
    if (previous && !sameSlot) clearEffects();
    if (Number.isFinite(target)) {
      if (!power || !sameSlot) power = { from: target, target, start: now - 700 };
      else if (target !== power.target) {
        const from = valueAt(now);
        power = { from: reduced() || target < power.target ? target : from, target, start: now };
      }
      if (frame) cancelAnimationFrame(frame);
      paint(now);
    }
    const methods = new Map((snapshot.methods || []).map(method => [method.id, method.level]));
    const arts=new Map((snapshot.methodArts||snapshot.arts||[]).map(art=>[art.id,art.level]));
    const advanced = sameSlot && [...methods].some(([id, level]) => previous.methods.has(id) && level > previous.methods.get(id));
    const artAdvanced=sameSlot&&[...arts].some(([id,level])=>previous.arts?.has(id)&&level>previous.arts.get(id));
    if (root) {
      place(root);
      if ((advanced && (previous.cultivating || snapshot.cultivating)) || artAdvanced) {
        const gains = window.MobileCultivationBalance.gainRows(previous,snapshot);
        const insight = [...methods].some(([id, level]) => previous.methods.has(id) &&
          level > previous.methods.get(id) && Math.floor(level / 50) > Math.floor(previous.methods.get(id) / 50));
        floatGains(root, gains, insight);
      }
    } else clearEffects();
    previous = { slot, methods, arts, methodArts:snapshot.methodArts,stats: { ...stats }, cultivating: snapshot.cultivating };
  }
  window.MobileCultivationFeedback = { update };
  addEventListener('resize', () => {
    const root = document.querySelector('.moon-cultivation');
    if (root) place(root); else clearEffects();
  });
})();
