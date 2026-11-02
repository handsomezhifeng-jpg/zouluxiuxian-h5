/* Player presentation metadata lives beside the original slot in its storage. */
(() => {
  'use strict';
  const profiles = new Map();
  let active = null;
  const key = slot => `mobile-player-profile-v1:${slot}`;
  const normalize = value => String(value ?? '').trim().normalize('NFC');
  function validate(value) {
    const name = normalize(value);
    if ([...name].length < 2 || [...name].length > 8) return '请输入 2—8 个字的名字。';
    if (!/^[\p{L}\p{N}·]+$/u.test(name)) return '名字可使用汉字、字母、数字或间隔号。';
    return '';
  }
  function show(adapter, slot, entry, onChange) {
    if (active) return;
    const previous = document.activeElement;
    const overlay = document.createElement('section');
    overlay.className = 'player-name-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'playerNameTitle');
    overlay.innerHTML = `<form class="player-name-card"><div class="player-name-avatar" aria-hidden="true"></div><h2 id="playerNameTitle">初入仙途</h2><p>请为自己取一个名字</p><label for="playerNameInput">道号</label><input id="playerNameInput" name="playerName" autocomplete="off" placeholder="请输入名字" aria-describedby="playerNameHint playerNameError"><small id="playerNameHint">2—8 个字，确认后随本机进度保存</small><p id="playerNameError" class="player-name-error" role="alert"></p><button type="submit">踏入仙途</button></form>`;
    document.body.append(overlay);
    active = { overlay, slot };
    const siblings = [...document.body.children].filter(node => node !== overlay && node instanceof HTMLElement);
    const previousInert = siblings.map(node => [node, node.inert]);
    siblings.forEach(node => { node.inert = true; });
    const input = overlay.querySelector('input');
    const button = overlay.querySelector('button');
    const error = overlay.querySelector('[role=alert]');
    input.focus({ preventScroll: true });
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
      if (event.key === 'Tab') {
        if (event.shiftKey && document.activeElement === input) { event.preventDefault(); button.focus(); }
        else if (!event.shiftKey && document.activeElement === button) { event.preventDefault(); input.focus(); }
      }
    });
    overlay.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      if (button.disabled) return;
      const name = normalize(input.value), reason = validate(name);
      error.textContent = reason;
      input.setAttribute('aria-invalid', String(Boolean(reason)));
      if (reason) { input.focus(); return; }
      button.disabled = true;
      try {
        const storage = adapter.runtime.storage;
        await storage.setItem(key(slot), { name });
        const saved = await storage.getItem(key(slot));
        if (saved?.name !== name) throw new Error('名字保存未完成，请重试。');
        entry.name = name;
        overlay.remove(); active = null;
        previousInert.forEach(([node, value]) => { node.inert = value; });
        onChange?.();
        if (previous?.isConnected) previous.focus?.({ preventScroll: true });
      } catch (reason) {
        error.textContent = reason.message || '名字保存失败，请重试。';
        button.disabled = false;
      }
    });
  }
  function ensure(adapter, snapshot, onChange) {
    if (!snapshot?.isInGame || !adapter?.runtime?.storage) return;
    const slot = snapshot.currentSlot;
    if (!Number.isInteger(slot) || slot < 0 || slot > 4) return;
    let entry = profiles.get(slot);
    if (!entry) {
      entry = { name: '', loaded: false };
      profiles.set(slot, entry);
      adapter.runtime.storage.getItem(key(slot)).then(data => {
        entry.name = data?.name && !validate(data.name) ? normalize(data.name) : '';
        entry.loaded = true;
        onChange?.();
      }).catch(() => { profiles.delete(slot); });
    }
    snapshot.playerName = entry.name;
    if (entry.loaded && !entry.name) show(adapter, slot, entry, onChange);
  }
  window.MobilePlayerProfile = {
    ensure, validate,
    getName(slot) { return profiles.get(slot)?.name || ''; },
    get isNaming() { return Boolean(active); },
    async reset(adapter, slot) {
      await adapter.runtime.storage.removeItem(key(slot));
      profiles.delete(slot);
    }
  };
})();
