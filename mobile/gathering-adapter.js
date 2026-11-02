/* Original herb/mineral gathering, exposed to the portrait UI.
 * data.json: events 2628-2673 (草木), 2678-2723 (金石), 374-383 (XP).
 * Entry unlocks: save[7,18] / save[8,18]. Target unlocks: (id - 1) * 5.
 * Only the native opening/start/stop functions change game state here.
 */
(() => {
  'use strict';
  if (!window.GameAdapter) throw new Error('Gathering adapter requires GameAdapter.');
  const proto = window.GameAdapter.prototype;
  const safe = (fn, fallback = null) => { try { return fn() ?? fallback; } catch { return fallback; } };
  const num = value => {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const configs = {
    herbs: { name: '草木', verb: '采集', column: 1, unlock: 7, counter: 11, progressSid: 415225931629639 },
    mining: { name: '金石', verb: '挖掘', column: 2, unlock: 8, counter: 12, progressSid: 698019642245961 }
  };
  // Unlike _visible(), this does not reject a legitimate row below the scroll viewport.
  const visible = instance => instance && safe(() => instance.isVisible, false) === true &&
    safe(() => instance.layer.isSelfAndParentsVisible, true) !== false;
  const enabled = instance => Boolean(safe(() => instance.instVars.开关, false));
  const plain = text => typeof text === 'string' ? text.replace(/\[\/?(?:color|size|b|i|u)(?:=[^\]]*)?\]/gi, '') : null;

  proto._gatheringData = function (kind) {
    const config = configs[kind];
    const zy = this._array('zy');
    const jy = this._array('jy');
    const save = this._array('save');
    const ready = Boolean(config && this._layout() === '主界面' && this._dataReady() &&
      zy && zy.width > 1 && zy.height >= 6 && jy && jy.height >= 3 && save && save.height >= 19);
    return { config, zy, jy, save, ready };
  };

  proto._gatheringGuard = function (kind) {
    if (!configs[kind]) return this._fail('未知的采集技艺。');
    const guard = this._guard();
    if (guard) return guard;
    const { config, ready, save } = this._gatheringData(kind);
    if (!ready) return this._fail('采集数据尚未载入。');
    if (num(this._at(save, config.unlock, 18)) !== 1) return this._fail(`完成原游戏主线任务可解锁${config.name}系统。`);
    return null;
  };

  proto._gatheringButton = function (kind, id) {
    const config = configs[kind];
    return config ? this._instances(`${config.name}按钮文字`).find(instance => visible(instance) &&
      num(safe(() => instance.instVars.修炼等级)) === id) ?? null : null;
  };

  proto._gatheringEnsureEntry = function (kind) {
    const config = configs[kind];
    const find = () => this._instances('二级菜单按钮文字').find(instance => visible(instance) &&
      safe(() => instance.instVars.功能) === config.name);
    let button = find();
    if (!button) {
      this._call('打开技艺二级菜单');
      button = find();
    }
    if (!button || !enabled(button)) return this._fail(`原游戏中的${config.name}入口暂不可用。`);
    return null;
  };

  proto._gatheringEnsureSystem = function (kind) {
    const config = configs[kind];
    const entry = this._gatheringEnsureEntry(kind);
    if (entry) return entry;
    if (this._global('主页界面') !== config.name || !this._instances(`${config.name}按钮文字`).some(visible)) {
      this._call(`打开${config.name}系统`, 1);
    }
    return null;
  };

  proto.getGatheringSnapshot = function (kind = 'herbs') {
    const { config, zy, jy, save, ready } = this._gatheringData(kind);
    if (!config) return null;
    const unlocked = ready ? num(this._at(save, config.unlock, 18)) === 1 : null;
    const level = this._number(`${config.name}等级`);
    const proficiency = this._number(`${config.name}经验`);
    const proficiencyCap = level === null ? null : num(this._at(jy, level, 1));
    const speed = level === null ? null : num(this._at(jy, level, 2));
    const active = this._flag(`${config.name}开关`);
    const activeTarget = active === true ? this._number(`${config.name}编号`) : null;
    const blocked = this._blocked();
    const paused = this._flag('游戏暂停');
    const busy = Boolean(this.busy || this._gatheringBusy);
    const luck = this._number('总机缘');
    const dropMultiplier = this._number('掉落加成系数');
    // 符纸加倍量 recursively calls DLC画符系统, which can load/write arrays and
    // local files. A snapshot must not invoke that chain. Native completion still
    // computes XP and consumes talismans through its unchanged original events.
    const outputQuantity = luck === null || dropMultiplier === null ? null : Math.round(dropMultiplier * luck);
    const inventory = ready ? safe(() => this._inventorySnapshot(), []) : [];
    const wp = this._array('wp');
    const itemByName = new Map();
    if (ready && wp && wp.height >= 3) {
      for (let id = 1; id < wp.width; id++) {
        if (this._at(wp, id, 2) === config.name) itemByName.set(this._at(wp, id, 1), id);
      }
    }
    const ownedById = new Map();
    for (const item of inventory || []) {
      if (typeof item.count === 'number') ownedById.set(item.id, (ownedById.get(item.id) || 0) + item.count);
    }
    const targets = [];
    if (ready) {
      for (let id = 1; id < zy.width; id++) {
        const requiredLevel = (id - 1) * 5;
        const targetUnlocked = unlocked === true && level !== null && (id === 1 || level >= requiredLevel);
        const nativeName = this._at(zy, id, config.column);
        const difficulty = targetUnlocked ? num(this._at(zy, id, 4)) : null;
        const baseExperience = targetUnlocked ? num(this._at(zy, id, 5)) : null;
        const experiencePerCycle = null;
        const itemId = itemByName.get(nativeName) ?? null;
        const reason = !unlocked ? `完成主线任务解锁${config.name}系统。` : !targetUnlocked ?
          `${config.name}技艺${requiredLevel}级解锁。` : blocked ? '请先完成原游戏中的对话框。' : busy ? '正在处理上一项操作。' : null;
        targets.push({
          id, name: targetUnlocked && typeof nativeName === 'string' ? nativeName : null,
          displayName: targetUnlocked && typeof nativeName === 'string' ? nativeName : '尚未解锁',
          unlocked: targetUnlocked, requiredLevel, reason,
          selectable: targetUnlocked && !blocked && !busy,
          difficulty, baseExperience, experiencePerCycle, experiencePreviewNote: '含符纸影响，未预估经验；由原游戏实际结算。',
          // Native progress is stepped every 0.02 game-month, with a 0.4-month minimum cycle.
          cycleMonths: difficulty !== null && speed !== null && speed > 0 ? Math.max(0.4, difficulty / speed) : null,
          outputs: targetUnlocked ? [{ id: itemId, name: nativeName, quantity: outputQuantity,
            owned: itemId === null || !Array.isArray(inventory) ? null : ownedById.get(itemId) || 0 }] : [],
          completedCycles: targetUnlocked ? num(this._at(save, id, config.counter)) : null
        });
      }
    }
    const hinted = this._gatheringSelections?.[kind];
    const selectedTarget = targets.some(target => target.id === hinted && target.unlocked) ? hinted :
      targets.some(target => target.id === activeTarget && target.unlocked) ? activeTarget : targets.find(target => target.unlocked)?.id ?? null;
    const selected = targets.find(target => target.id === selectedTarget) ?? null;
    const current = targets.find(target => target.id === activeTarget) ?? null;
    const rawProgress = num(this._local(config.progressSid));
    const progress = active === false ? 0 : active === true && rawProgress !== null && current?.difficulty > 0 ?
      Math.max(0, Math.min(100, rawProgress / current.difficulty * 100)) : null;
    const messages = this._instances('记录文字').map(instance => ({ id: safe(() => instance.uid),
      rawText: safe(() => instance.text), y: num(safe(() => instance.y)) }))
      .filter(entry => typeof entry.rawText === 'string' && entry.rawText.includes(config.name) && /获得|造诣|等级已满/.test(entry.rawText))
      .sort((a, b) => (b.y ?? 0) - (a.y ?? 0)).slice(0, 8)
      .map(({ id, rawText }) => ({ id, text: plain(rawText), rawText }));
    return {
      kind, name: config.name, verb: config.verb, ready, unlocked,
      unlockHint: `完成原游戏主线任务解锁${config.name}系统。`,
      level, maxLevel: 100, proficiency, proficiencyCap, speed,
      proficiencyProgress: level !== null && level >= 100 ? 100 : proficiency === null || !proficiencyCap ? null :
        Math.max(0, Math.min(100, proficiency / proficiencyCap * 100)),
      selectedTarget, targets, active, activeTarget, activeName: current?.name ?? null,
      progress, rawProgress, progressMaximum: current?.difficulty ?? null,
      repeating: active, paused, blocked, busy,
      canStart: Boolean(ready && selected?.selectable && !(active === true && activeTarget === selectedTarget)),
      canStop: Boolean(ready && active === true && !blocked && !busy),
      messages, logs: messages.map(entry => entry.text),
      note: '自动连续采集；开始会由原游戏停止当前行为。经验含符纸影响，未作预估；材料、技艺经验及符纸消耗均由原游戏实际结算。'
    };
  };

  proto.openGathering = function (kind = 'herbs') {
    const guard = this._gatheringGuard(kind);
    if (guard) return guard;
    try {
      const entry = this._gatheringEnsureEntry(kind);
      if (entry) return entry;
      this._call(`打开${configs[kind].name}系统`, 1);
      return this._result(true, `已打开原游戏${configs[kind].name}系统。`);
    } catch (error) { return this._fail(error.message); }
  };

  proto.selectTarget = function (kind = 'herbs', id) {
    const guard = this._gatheringGuard(kind);
    if (guard) return guard;
    const target = this.getGatheringSnapshot(kind)?.targets.find(item => item.id === id);
    if (!target?.selectable) return this._fail(target?.reason || '请选择已解锁的采集目标。');
    this._gatheringSelections = { ...this._gatheringSelections, [kind]: id };
    return this._result(true, `已选择${target.name}。`);
  };

  proto.startGathering = function (kind = 'herbs', id) {
    const guard = this._gatheringGuard(kind);
    if (guard) return guard;
    const snapshot = this.getGatheringSnapshot(kind);
    const targetId = id ?? snapshot.selectedTarget;
    const target = snapshot.targets.find(item => item.id === targetId);
    if (!target?.selectable) return this._fail(target?.reason || '请选择已解锁的采集目标。');
    if (snapshot.active && snapshot.activeTarget === targetId) return this._result(true, '已经在持续采集该材料。');
    try {
      const system = this._gatheringEnsureSystem(kind);
      if (system) return system;
      const button = this._gatheringButton(kind, targetId);
      if (!button || !enabled(button)) return this._fail('原游戏中的采集按钮暂不可用。');
      this._call(`开始${configs[kind].name}`, targetId);
      this._gatheringSelections = { ...this._gatheringSelections, [kind]: targetId };
      return this._flag(`${configs[kind].name}开关`) === true && this._number(`${configs[kind].name}编号`) === targetId ?
        this._result(true, `开始${configs[kind].verb}${target.name}。`) : this._fail('原游戏尚未开始采集，请稍后再试。');
    } catch (error) { return this._fail(error.message); }
  };

  proto.stopGathering = function (kind = 'herbs') {
    const guard = this._gatheringGuard(kind);
    if (guard) return guard;
    // Native stop resets the shared talisman mode; never invoke it for an inactive skill.
    if (this._flag(`${configs[kind].name}开关`) !== true) return this._result(true, '当前未在进行这项采集。');
    try {
      this._call(`停止${configs[kind].name}`);
      return this._flag(`${configs[kind].name}开关`) === false ? this._result(true, '已停止采集。') : this._fail('原游戏尚未停止采集。');
    } catch (error) { return this._fail(error.message); }
  };
})();
