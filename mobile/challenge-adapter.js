/* Challenge controller and original automatic-next-stage checkbox.
 * source/data.json /project/6/0/1/128/8/14, events 3400-3489;
 * entry 9001 checks save[15,18]; X13 9317 unlocks it and names 修士石浩.
 * Snapshots read tz/save/globals and the audited pure 天谴敌方加成 expression.
 * Victory, save[id,21], stat rewards and story progression remain native events.
 * Settings use original Touch input (3486-3489); no gameplay state is assigned here.
 */
(() => {
  'use strict';
  if (!window.GameAdapter) throw new Error('GameAdapter must load before challenge-adapter.js');
  const proto = window.GameAdapter.prototype;
  const ENEMY_QI_SID = 777670432892077;
  const CATEGORIES = ['圣灵', '神魔', '仙佛', '兽王', '星宿', '精怪', '鬼妖', '修士'];
  const safe = (fn, fallback = null) => { try { return fn() ?? fallback; } catch { return fallback; } };
  const num = value => {
    if (typeof value !== 'number' && !(typeof value === 'string' && value.trim())) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const plain = value => typeof value === 'string' ? value.replace(/\[\/?(?:color|size|b|i|u|s|font)(?:=[^\]]*)?\]/gi, '') : null;
  const shown = instance => Boolean(instance && safe(() => instance.isVisible, false) &&
    safe(() => instance.layer.isSelfAndParentsVisible, true));
  const enabled = instance => [true, 1].includes(safe(() => instance.instVars.开关));
  const variable = (instance, name) => num(safe(() => instance.instVars[name]));
  const button = adapter => adapter._instances('挑战按钮文字').find(shown) ?? null;
  const multiply = (a, b) => a === null || b === null ? null : typeof a === 'number' && typeof b === 'number' ? a * b : a;
  const divide = (a, b) => a === null || b === null ? null : typeof a === 'number' && typeof b === 'number' ? a / b : a;
  const savedBoolean = value => typeof value === 'boolean' ? value : value === 0 ? false : value === 1 ? true : null;
  function autoControl(adapter) {
    const objectClass = safe(() => adapter._engine().GetObjectClassByIndex(332));
    const committed = safe(() => objectClass.GetName()) === '自动挑战勾选' ?
      safe(() => objectClass.GetInstances().map(instance => instance.GetInterfaceClass()), []) :
      safe(() => adapter.runtime.objects.自动挑战勾选.getPickedInstances(), []);
    return committed.find(shown) ?? null;
  }

  function data(adapter) {
    const tz = adapter._array('tz');
    const save = adapter._array('save');
    const ready = Boolean(adapter._layout() === '主界面' && adapter._dataReady() &&
      tz && tz.width > 1 && tz.height >= 8 && save && save.height > 21 && save.width >= tz.width);
    const unlockFlag = num(adapter._at(save, 15, 18));
    return { tz, save, ready, unlockFlag, unlocked: ready && unlockFlag === 1 };
  }

  function guard(adapter, selection = false, ownOperation = false) {
    if (!ownOperation) { const result = adapter._guard(); if (result) return result; }
    if (adapter._layout() !== '主界面') return adapter._fail('请先进入游戏。');
    const current = data(adapter);
    if (!current.ready) return adapter._fail('挑战数据尚未完整载入。');
    if (!current.unlocked) return adapter._fail('请先完成主线教学，解锁挑战。');
    if (adapter._blocked()) return adapter._fail('请先完成或关闭原游戏中的对话框。');
    // Original detail touches 3433 also exclude 操作屏蔽; native Stop does not.
    if (selection && (adapter._flag('挑战开关') === true || adapter._instances('操作屏蔽').some(shown))) {
      return adapter._fail('正在挑战中，请先放弃当前战斗再选择目标。');
    }
    return null;
  }

  function settings(adapter, ownOperation = false) {
    const current = data(adapter), autoChallenge = adapter._flag('自动挑战');
    const savedAutoChallenge = savedBoolean(adapter._at(current.save, 65, 22));
    const reason = !current.ready ? '挑战数据尚未完整载入。' : !current.unlocked ? '请先完成主线教学解锁挑战。' :
      !ownOperation && (adapter.busy || adapter._challengeBusy) || adapter._nativeInputBusy ? '正在处理上一项操作。' :
      adapter._blocked() ? '请先完成原游戏中的对话框。' :
      safe(() => adapter._engine().IsSuspended(), false) ? '请先继续游戏。' :
      adapter._instances('筛选背景').some(shown) || adapter._instances('道具tips背景').some(shown) ? '请先关闭原游戏中的筛选或物品提示。' :
      autoChallenge === null ? '自动挑战设置尚未载入。' :
      typeof adapter._nativeTap !== 'function' ? '原控件输入尚未载入，请使用原界面。' : null;
    return { autoChallenge, savedAutoChallenge, canConfigure: !reason, reason,
      note: '仅设置胜利后自动挑战下一关；开启不会立即开战，放弃或失败不清除此设置。' };
  }

  async function settled(adapter, predicate) {
    // Created/destroyed Construct instances become public after the runtime commit.
    await new Promise(resolve => setTimeout(resolve, 40));
    await adapter._waitUntil(predicate, 3000);
  }

  async function ensureEntry(adapter) {
    const find = () => adapter._instances('二级菜单按钮文字').find(instance => shown(instance) &&
      safe(() => instance.instVars.功能) === '挑战' && plain(safe(() => instance.text)) === '挑战');
    if (!find()) { adapter._call('打开历练二级菜单'); await settled(adapter, () => Boolean(find())); }
    if (!enabled(find())) return adapter._fail('原游戏的挑战入口暂不可用。');
    return null;
  }

  async function ensurePage(adapter, force = false) {
    const entry = await ensureEntry(adapter);
    if (entry) return entry;
    if (force || adapter._global('主页界面') !== '挑战' || !button(adapter)) {
      adapter._call('打开挑战系统', 1);
      await settled(adapter, () => adapter._global('主页界面') === '挑战' && Boolean(button(adapter)) &&
        adapter._instances('挑战分类文字').some(shown));
    }
    return null;
  }

  function targetRows(adapter, current, factor) {
    const targets = [];
    if (!current.ready) return targets;
    for (let id = 1; id < current.tz.width; id++) {
      const name = adapter._at(current.tz, id, 1);
      const category = adapter._at(current.tz, id, 2);
      if (typeof name !== 'string' || !name || !CATEGORIES.includes(category)) continue;
      const clearedFlag = num(adapter._at(current.save, id, 21));
      const raw = [4, 5, 6].map(column => adapter._at(current.tz, id, column));
      const rewardType = adapter._at(current.tz, id, 7);
      const rewardIndex = { 真气: 0, 攻击: 1, 防御: 2 }[rewardType];
      const divided = rewardIndex === undefined ? null : divide(raw[rewardIndex], rewardType === '真气' ? 50 : 5);
      const rewardValue = divided === null ? null : num(Math.round(divided));
      targets.push({ id, name, category, clearedFlag, cleared: clearedFlag === null ? null : clearedFlag === 1,
        stats: { qi: num(multiply(raw[0], factor)), attack: num(multiply(raw[1], factor)), defense: num(multiply(raw[2], factor)) },
        baseStats: { qi: num(raw[0]), attack: num(raw[1]), defense: num(raw[2]) },
        reward: { type: rewardType, label: rewardType === '真气' ? '真气上限' : rewardType,
          value: rewardValue, alreadyReceived: clearedFlag === null ? null : clearedFlag === 1 } });
    }
    return targets;
  }

  async function chooseCategory(adapter, category) {
    if (!CATEGORIES.includes(category)) return adapter._fail('请选择原游戏中存在的挑战分类。');
    const page = await ensurePage(adapter);
    if (page) return page;
    const blocked = guard(adapter, true, true);
    if (blocked) return blocked;
    const categoryButton = adapter._instances('挑战分类文字').find(instance => shown(instance) && plain(safe(() => instance.text)) === category);
    if (!categoryButton || !enabled(categoryButton)) return adapter._fail('原游戏的挑战分类按钮暂不可用。');
    adapter._call('刷新挑战列表', category, 0);
    await settled(adapter, () => adapter._instances('挑战选项文字').some(instance => shown(instance) &&
      adapter._at(adapter._array('tz'), variable(instance, '编号'), 2) === category));
    adapter._challengeCategory = category;
    return null;
  }

  async function chooseTarget(adapter, id) {
    const current = data(adapter);
    if (!Number.isInteger(id) || id < 1 || !current.tz || id >= current.tz.width) return adapter._fail('请选择有效挑战目标。');
    const category = adapter._at(current.tz, id, 2);
    const selectedCategory = await chooseCategory(adapter, category);
    if (selectedCategory) return selectedCategory;
    const blocked = guard(adapter, true, true);
    if (blocked) return blocked;
    const row = adapter._instances('挑战选项文字').find(instance => shown(instance) && variable(instance, '编号') === id);
    if (!row || !enabled(row)) return adapter._fail('原游戏的目标选项暂不可用。');
    adapter._call('刷新挑战详情', id);
    await settled(adapter, () => variable(button(adapter), '修炼等级') === id);
    adapter._challengeSelectedId = id;
    return null;
  }

  async function action(adapter, operation) {
    const result = guard(adapter);
    if (result) return result;
    adapter.busy = true;
    adapter._challengeBusy = true;
    try { return await operation(); }
    catch (error) { return adapter._fail(error.message || '原游戏未确认挑战操作完成，请查看原界面。'); }
    finally { adapter._challengeBusy = false; adapter.busy = false; }
  }

  proto.getChallengeSnapshot = function () {
    const current = data(this);
    // Pure leaf chain: 天谴敌方加成 2153 -> 天谴值 2148 (only frame-local counting).
    const factor = current.ready ? this._formula('天谴敌方加成', '') : null;
    const all = targetRows(this, current, factor);
    const active = this._flag('挑战开关');
    const activeId = this._number('挑战编号');
    const nativeButton = button(this);
    const prepared = this._global('主页界面') === '挑战' && Boolean(nativeButton);
    const selectedId = prepared ? variable(nativeButton, '修炼等级') :
      active === true ? activeId : this._challengeSelectedId ?? all.find(item => item.cleared === false)?.id ?? all.at(-1)?.id ?? null;
    const selected = all.find(item => item.id === selectedId) ?? null;
    const category = this._challengeCategory ?? selected?.category ?? '修士';
    const blocked = this._blocked();
    const busy = Boolean(this.busy || this._challengeBusy);
    const selectionBlocked = active === true || this._instances('操作屏蔽').some(shown);
    const autoChallenge = this._flag('自动挑战');
    const commonReason = !current.ready ? '挑战数据尚未完整载入。' : !current.unlocked ? '请先完成主线教学解锁挑战。' :
      blocked ? '请先完成原游戏中的对话框。' : busy ? '正在处理上一项操作。' : null;
    const categories = CATEGORIES.map(name => ({ category: name, label: name,
      count: all.filter(item => item.category === name).length,
      clearedCount: all.filter(item => item.category === name && item.cleared).length,
      selectable: !commonReason && !selectionBlocked }));
    const targets = all.filter(item => item.category === category).map(item => ({ ...item, selected: item.id === selectedId,
      selectable: !commonReason && !selectionBlocked,
      reason: commonReason || (selectionBlocked ? '请先放弃当前挑战。' : null) }));
    const startReason = commonReason || (active === true ? '正在进行挑战。' : null) ||
      (autoChallenge === null ? '自动挑战设置尚未载入。' : null) ||
      (!selected ? '请选择挑战目标。' : selected.cleared === true ? '此目标已通关，不能重复领取属性奖励。' :
        selected.cleared === null ? '通关状态尚未载入。' : null);
    const stopReason = commonReason || (active !== true ? '当前没有进行中的挑战。' : null);
    const rawEnemyQi = num(this._local(ENEMY_QI_SID));
    const activeTarget = all.find(item => item.id === activeId) ?? null;
    const messages = this._instances('记录文字').map(instance => ({ id: safe(() => instance.uid), rawText: safe(() => instance.text), y: num(safe(() => instance.y)) }))
      .filter(item => typeof item.rawText === 'string' && /挑战.*胜利|挑战战斗失败/.test(item.rawText))
      .sort((a, b) => (b.y ?? 0) - (a.y ?? 0)).slice(0, 12)
      .map(({ id, rawText }) => ({ id, rawText, text: plain(rawText) }));
    return { ready: current.ready, unlocked: current.unlocked, unlockFlag: current.unlockFlag,
      unlockHint: '完成原游戏主线“挑战修士”教学后开放。', categories, category, targets, selectedId, selected,
      prepared, buttonLabel: plain(safe(() => nativeButton.text)), buttonEnabled: enabled(nativeButton),
      battle: { active, targetId: activeId, name: active === true ? activeTarget?.name ?? null : null,
        category: active === true ? activeTarget?.category ?? null : null,
        enemyQi: active === true && rawEnemyQi !== null ? Math.max(0, rawEnemyQi) : null, rawEnemyQi,
        maxEnemyQi: active === true ? activeTarget?.stats.qi ?? null : null,
        enemyAttack: active === true ? activeTarget?.stats.attack ?? null : null,
        enemyDefense: active === true ? activeTarget?.stats.defense ?? null : null,
        playerQi: this._number('真气'), maxPlayerQi: this._number('真气上限'),
        attack: this._number('攻击'), defense: this._number('防御'), autoChallenge,
        countdown: null, note: '原事件每0.02游戏月结算，无独立挑战倒计时。' },
      canStart: !startReason, startReason, canStop: !stopReason, stopReason,
      blocked, busy, paused: this._flag('游戏暂停'), messages, logs: messages.map(item => item.text),
      completedCount: all.filter(item => item.cleared).length, totalCount: all.length,
      settings: settings(this), originalControls: [], rewardClaimAction: null };
  };

  proto.getChallengeSettings = function () { return settings(this); };
  proto.configureChallenge = function (options = {}) {
    if (typeof options.autoChallenge !== 'boolean') return Promise.resolve(this._fail('自动挑战设置须为开启或关闭。'));
    return action(this, async () => {
      let current = settings(this, true);
      if (!current.canConfigure) return this._fail(current.reason, { requiresOriginal: typeof this._nativeTap !== 'function' });
      if (current.autoChallenge === options.autoChallenge) return this._result(true, '自动挑战设置未改变。',
        { settings: current, requiresSave: current.savedAutoChallenge !== current.autoChallenge });
      const page = await ensurePage(this);
      if (page) return page;
      await this._waitUntil(() => Boolean(autoControl(this)), 1800);
      current = settings(this, true);
      if (!current.canConfigure) return this._fail(current.reason);
      if (current.autoChallenge === options.autoChallenge) return this._result(true, '自动挑战设置已一致。',
        { settings: current, requiresSave: current.savedAutoChallenge !== current.autoChallenge });
      const control = autoControl(this);
      if (!control || !enabled(control)) return this._fail('原自动挑战开关暂不可用。');
      // 3486 rejects upper/lower masks, black screen and item tips, even in battle.
      const tapped = await this._nativeTap(control, { allowModal: false,
        blockers: ['黑幕', '遮挡底板上', '遮挡底板下', '道具tips背景'], timeout: 1800 });
      if (tapped?.ok !== true) return tapped ?? this._fail('原自动挑战开关未接收输入。');
      await this._waitUntil(() => this._flag('自动挑战') === options.autoChallenge &&
        autoControl(this) === control && enabled(control), 3000);
      const result = settings(this, true);
      return this._result(true, options.autoChallenge ? '已开启胜利后自动挑战下一关。' : '已关闭自动挑战下一关。',
        { settings: result, requiresSave: result.savedAutoChallenge !== result.autoChallenge });
    });
  };

  proto.openChallenge = function () {
    return action(this, async () => { const opened = await ensurePage(this, true);
      return opened ?? this._result(true, '已打开原游戏挑战界面。'); });
  };
  proto.selectChallengeCategory = function (category) {
    return action(this, async () => { const selected = await chooseCategory(this, category);
      return selected ?? this._result(true, `已选择${category}挑战。`, { category }); });
  };
  proto.selectChallenge = function (id) {
    return action(this, async () => { const selected = await chooseTarget(this, id);
      return selected ?? this._result(true, '已选中原挑战目标。', { id }); });
  };
  proto.startChallenge = function (id) {
    return action(this, async () => {
      const auto = this._flag('自动挑战');
      if (auto === null) return this._fail('自动挑战设置尚未载入。');
      if (this._flag('挑战开关') === true) return this._fail('正在挑战中，请先放弃当前战斗。');
      const target = id ?? this.getChallengeSnapshot().selectedId;
      const selected = await chooseTarget(this, target);
      if (selected) return selected;
      const blocked = guard(this, false, true);
      if (blocked) return blocked;
      const cleared = num(this._at(this._array('save'), target, 21));
      if (cleared !== 0) return this._fail(cleared === 1 ? '此目标已通关，不能重复领取属性奖励。' : '通关状态尚未确认。');
      const control = button(this);
      if (!control || !enabled(control) || plain(safe(() => control.text)) !== '挑战' || variable(control, '修炼等级') !== target ||
          !this._instances('挑战按钮背景').some(shown) || this._instances('操作屏蔽').some(shown)) return this._fail('原游戏的挑战按钮暂不可用。');
      if (this._flag('自动挑战') !== auto || this._flag('挑战开关') !== false) return this._fail('挑战状态已变化，请重新确认。');
      // 3440 calls 停止所有行为 and performs the original combat initialization.
      this._call('开始挑战', target);
      await this._waitUntil(() => this._flag('挑战开关') === true && this._number('挑战编号') === target ||
        num(this._at(this._array('save'), target, 21)) === 1, 3000);
      return this._result(true, auto ? '已开始原游戏挑战，胜利后按原设置继续下一关。' :
        '已开始原游戏挑战，胜负与属性奖励由原事件结算。', { id: target, autoChallenge: auto });
    });
  };
  proto.stopChallenge = function () {
    return action(this, async () => {
      if (this._flag('挑战开关') !== true) return this._result(true, '当前没有进行中的挑战。');
      const page = await ensurePage(this);
      if (page) return page;
      const blocked = guard(this, false, true);
      if (blocked) return blocked;
      const id = this._number('挑战编号');
      const control = button(this);
      if (!control || !enabled(control) || plain(safe(() => control.text)) !== '放弃' || variable(control, '修炼等级') !== id) {
        return this._fail('请等待原游戏的放弃按钮就绪。');
      }
      this._call('停止挑战');
      // Native touch 3448 restores text/preview; refreshing gives that same native
      // state without assigning instance fields and keeps cleared targets disabled.
      this._call('刷新挑战详情', id);
      await this._waitUntil(() => this._flag('挑战开关') === false, 3000);
      return this._result(true, '已放弃当前挑战。');
    });
  };
})();
