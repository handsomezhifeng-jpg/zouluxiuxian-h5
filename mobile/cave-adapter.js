/* Original cave buildings and their four-slot construction queue.
 * source/data.json /project/6/0/1/128/8/10 (2922-3195), X14 9319.
 * Costs/time/effects come from df; levels are original global variables.
 * Opening/starting/cancelling use native events. No direct state/array writes.
 * Native stop 3080 has no refund: cancellation is sent through the original
 * Touch control (2970-2981), including refund rules and starting the next entry.
 * Queue removal also uses original Touch 3194-3195, never a fabricated setter.
 * 3188 only compacts empty slots. The source offers no arbitrary reordering.
 * 画室 entitlement checks remain in the original UI.
 */
(() => {
  'use strict';
  if (!window.GameAdapter) throw new Error('GameAdapter must load before cave-adapter.js');
  const proto = window.GameAdapter.prototype;
  const BUILDINGS = [
    ['修室', 3, '修炼速度', '%', 150], ['书阁', 4, '功法效率', '%', 150],
    ['丹炉', 5, '炼丹能力', '%', 150], ['器鼎', 6, '炼器能力', '%', 150],
    ['画室', 7, '画符能力', '%', 150], ['兽栏', 8, '驭兽能力', '%', 150],
    ['灵田', 9, '灵田规模', '亩', 150], ['灵阵', 11, '灵物台数量', '个', 90]
  ];
  const safe = (fn, fallback = null) => { try { return fn() ?? fallback; } catch { return fallback; } };
  const num = value => {
    if (typeof value !== 'number' && !(typeof value === 'string' && value.trim())) return null;
    const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null;
  };
  const plain = value => typeof value === 'string' ? value.replace(/\[\/?(?:color|size|b|i|u|s|font)(?:=[^\]]*)?\]/gi, '') : null;
  const shown = instance => Boolean(instance && safe(() => instance.isVisible, false) && safe(() => instance.layer.isSelfAndParentsVisible, true));
  const enabled = instance => [true, 1].includes(safe(() => instance.instVars.开关));
  const multiply = (a, b) => a === null || b === null ? null : typeof a === 'number' && typeof b === 'number' ? a * b : a;
  const divide = (a, b) => a === null || b === null ? null : typeof a === 'number' && typeof b === 'number' ? a / b : a;
  const rounded = value => value === null ? null : num(Math.round(value));
  const control = (adapter, name, active = false) => adapter._instances(active ? '洞府队列按钮文字' : '洞府升级按钮文字')
    .find(instance => shown(instance) && safe(() => instance.instVars.功能) === name) ?? null;
  const queueRaw = current => current.queue.map(item => item.raw);
  const sameQueue = (current, expected) => queueRaw(current).every((value, index) => value === expected[index]);
  const nativeInputAvailable = adapter => typeof adapter._nativeTap === 'function' && typeof adapter._nativeControlCommitted === 'function';
  const gameTime = adapter => num(safe(() => adapter.runtime.gameTime)) ?? num(safe(() => adapter._engine().GetGameTime()));
  const committed = (adapter, instance) => Boolean(instance && nativeInputAvailable(adapter) && adapter._nativeControlCommitted(instance));
  const queueFingerprint = (adapter, current) => JSON.stringify({ active: current.active, name: current.activeName,
    levels: BUILDINGS.map(([name]) => adapter._number(`${name}等级`)), slots: queueRaw(current) });

  function data(adapter) {
    const df = adapter._array('df');
    const save = adapter._array('save');
    const ready = Boolean(adapter._layout() === '主界面' && adapter._dataReady() && df && df.width >= 151 && df.height >= 12 &&
      save && save.width > 4 && save.height > 23);
    const unlockFlag = num(adapter._at(save, 3, 18));
    const queue = [1, 2, 3, 4].map(slot => {
      const raw = adapter._at(save, slot, 23);
      return { slot, name: typeof raw === 'string' ? raw : null, raw, empty: raw === null ? null : raw === 0 };
    });
    return { df, save, ready, unlockFlag, unlocked: ready && unlockFlag === 1, queue,
      queueClear: queue.every(item => item.empty === true),
      spiritStones: adapter._number('灵石'), caveEnergy: adapter._number('洞府灵气'), speedBonus: adapter._number('命石建筑速度'),
      active: adapter._flag('洞府开关'), activeName: adapter._global('洞府升级建筑'),
      refundable: adapter._flag('洞府返还开关') };
  }

  function guard(adapter, ownOperation = false) {
    if (!ownOperation) { const result = adapter._guard(); if (result) return result; }
    if (!ownOperation && adapter._caveQueuePending) return adapter._fail('上次原队列输入尚未确认，请在原界面核对，勿重复提交。',
      { requiresOriginal: true, transactionMayHaveRun: true });
    if (adapter._layout() !== '主界面') return adapter._fail('请先进入游戏。');
    const current = data(adapter);
    if (!current.ready) return adapter._fail('洞府数据尚未完整载入。');
    if (!current.unlocked) return adapter._fail('请先完成主线教学，解锁洞府。');
    if (adapter._blocked()) return adapter._fail('请先完成或关闭原游戏中的对话框。');
    return null;
  }

  function queueForecast(adapter, current) {
    const levels = Object.fromEntries(BUILDINGS.map(([name]) => [name, adapter._number(`${name}等级`)]));
    const next = { ...levels };
    if (current.active === true && Number.isInteger(next[current.activeName])) next[current.activeName]++;
    const fingerprint = queueFingerprint(adapter, current);
    const speed = current.speedBonus === null ? null : 1 + current.speedBonus / 100;
    const entries = current.queue.map(entry => {
      const config = BUILDINGS.find(item => item[0] === entry.name);
      const fromLevel = config && Number.isInteger(next[entry.name]) ? next[entry.name] : null;
      const targetLevel = fromLevel === null ? null : fromLevel + 1;
      const cap = config?.[4] ?? null;
      const withinTable = fromLevel !== null && fromLevel >= 0 && fromLevel < current.df?.width;
      const cost = withinTable ? rounded(adapter._at(current.df, fromLevel, 1)) : null;
      const effectiveMonths = withinTable && speed !== null && speed > 0 ? num(divide(adapter._at(current.df, fromLevel, 2), speed)) : null;
      const willExceedCap = targetLevel === null || cap === null ? null : targetLevel > cap;
      if (fromLevel !== null) next[entry.name] = targetLevel;
      const token = JSON.stringify([fingerprint, entry.slot, entry.raw, fromLevel, targetLevel]);
      const removeReason = !current.ready ? '洞府队列数据尚未载入。' : !current.unlocked ? '请先解锁洞府。' :
        adapter._blocked() ? '请先关闭原游戏中的对话框。' : adapter.busy ? '正在处理上一项操作。' :
        adapter._caveCancelPending || adapter._caveQueuePending ? '上次洞府操作仍待确认，请先核对当前建造及队列。' :
        entry.empty !== false ? '此队列槽为空或尚未载入。' : !nativeInputAvailable(adapter) ? '当前环境尚未提供原控件输入，请使用原界面。' : null;
      return { ...entry, currentLevel: config ? levels[entry.name] : null, fromLevel, targetLevel, cost,
        months: rounded(effectiveMonths), effectiveMonths, cap, willExceedCap,
        affordableAtCurrentBalance: cost === null || current.spiritStones === null ? null : current.spiritStones >= cost,
        forecastAssumesPriorSuccess: true, canRemove: !removeReason, removeReason, token };
    });
    return { entries, next, fingerprint, full: current.queue.every(item => item.empty === false),
      known: current.queue.every(item => item.empty === true || BUILDINGS.some(config => config[0] === item.name)) };
  }

  function enqueueInfo(adapter, current, name, ignoreBusy = false) {
    const forecast = queueForecast(adapter, current);
    const config = BUILDINGS.find(item => item[0] === name);
    const currentLevel = config ? adapter._number(`${name}等级`) : null;
    const fromLevel = config && Number.isInteger(forecast.next[name]) ? forecast.next[name] : null;
    const targetLevel = fromLevel === null ? null : fromLevel + 1;
    const cap = config?.[4] ?? null;
    const entryCost = currentLevel !== null ? rounded(adapter._at(current.df, currentLevel, 1)) : null;
    const cost = fromLevel !== null && fromLevel < current.df?.width ? rounded(adapter._at(current.df, fromLevel, 1)) : null;
    const speed = current.speedBonus === null ? null : 1 + current.speedBonus / 100;
    const effectiveMonths = fromLevel !== null && fromLevel < current.df?.width && speed !== null && speed > 0 ?
      num(divide(adapter._at(current.df, fromLevel, 2), speed)) : null;
    const reason = !current.ready || !config ? '建筑或队列数据尚未确认。' : !current.unlocked ? '请先解锁洞府。' :
      adapter._blocked() ? '请先关闭原游戏中的对话框。' : !ignoreBusy && adapter.busy ? '正在处理上一项操作。' :
      adapter._caveCancelPending || adapter._caveQueuePending ? '上次洞府操作尚未确认，请在原界面核对。' :
      current.active !== true ? '请先开始一项建筑升级，再加入待建队列。' :
      !nativeInputAvailable(adapter) ? '当前环境尚未提供原控件输入，请使用原界面。' :
      name === '画室' ? '画室须在原界面完成原游戏解锁检查后操作。' :
      !forecast.known ? '存在尚未识别的队列项目，请先在原界面处理。' : forecast.full ? '建筑队列已满。' :
      currentLevel === null || fromLevel === null || cap === null ? '建筑等级尚未载入。' :
      targetLevel > cap ? '当前建造及同名队列已到建筑上限，不能继续排队。' :
      entryCost === null || entryCost <= 0 || cost === null || effectiveMonths === null ? '原游戏升级费用或时间尚未确认。' :
      current.spiritStones === null ? '灵石余额尚未载入。' : current.spiritStones < entryCost ? '当前灵石不足以通过原加队列按钮的费用检查。' : null;
    return { fromLevel, targetLevel, cap, cost, months: rounded(effectiveMonths), effectiveMonths, entryCost,
      canEnqueue: !reason, reason, reserveCost: false, requiresOriginal: name === '画室' || !nativeInputAvailable(adapter),
      note: '加入队列不预扣灵石；等级与费用按前项均成功估算，实际执行时由原事件重新检查。' };
  }

  async function tapButton(adapter, instance, options = {}) {
    if (!nativeInputAvailable(adapter)) return adapter._fail('原控件输入尚未接入，请使用原界面。', { requiresOriginal: true });
    if (gameTime(adapter) === null) return adapter._fail('无法读取原游戏计时，请使用原界面。', { requiresOriginal: true, inputSent: false });
    // The source tests 开关, then Wait(0.2); it does not toggle a debounce flag.
    // Input delivery alone is never a receipt. Callers verify native effects.
    const result = await adapter._nativeTap(instance, { allowModal: false, blockers: ['黑幕', '遮挡底板上', '遮挡底板下'], ...options });
    if (!result.ok && !result.inputSent) return result;
    const afterInput = gameTime(adapter);
    // ScheduledWait.InitTimer uses runtime.GetGameTime(), not wall-clock time.
    // Waiting another .21 game seconds after touch delivery also prevents a
    // natural queue shift from finishing this API before the original delete
    // callback. A paused/zero-timescale engine times out without releasing a
    // retry; callers retain their controller-only uncertainty latch.
    try {
      if (afterInput === null) throw new Error('missing native clock');
      await adapter._waitUntil(() => { const now = gameTime(adapter); return now !== null && now - afterInput >= 0.21; }, 3500);
    } catch {
      return adapter._fail('原洞府等待尚未结束；请恢复原游戏计时后在原界面核对，勿重复提交。',
        { inputSent: true, nativeWaitComplete: false, transactionMayHaveRun: true, requiresOriginal: true });
    }
    return { ...result, nativeWaitComplete: true };
  }

  async function ensureQueuePanel(adapter) {
    const page = await ensurePage(adapter);
    if (page) return page;
    if (!nativeInputAvailable(adapter)) return adapter._fail('原控件输入尚未接入，请使用原界面。', { requiresOriginal: true });
    if (adapter._global('信息显示模式') !== '洞府') {
      const findHeader = () => adapter._instances('队列按钮文字').find(instance => shown(instance) &&
        safe(() => instance.instVars.功能) === '洞府' && plain(safe(() => instance.text)) === '洞府' && committed(adapter, instance));
      await settled(adapter, () => Boolean(findHeader()));
      const opened = await adapter._nativeTap(findHeader(), { allowModal: false, blockers: ['黑幕', '数字输入背景'] });
      if (!opened.ok) return opened;
      await adapter._waitUntil(() => adapter._global('信息显示模式') === '洞府', 3000);
    }
    await settled(adapter, () => adapter._instances('队列删除按钮').some(instance => committed(adapter, instance)));
    return null;
  }

  async function settled(adapter, predicate) {
    await new Promise(resolve => setTimeout(resolve, 40));
    await adapter._waitUntil(predicate, 3000);
  }

  async function ensurePage(adapter, force = false) {
    const findEntry = () => adapter._instances('二级菜单按钮文字').find(instance => shown(instance) &&
      safe(() => instance.instVars.功能) === '洞府' && plain(safe(() => instance.text)) === '洞府');
    if (!findEntry()) { adapter._call('打开修炼二级菜单'); await settled(adapter, () => Boolean(findEntry())); }
    if (!enabled(findEntry())) return adapter._fail('原游戏的洞府入口暂不可用。');
    const ready = () => adapter._global('主页界面') === '洞府' && adapter._instances('洞府信息背景').some(shown) &&
      BUILDINGS.every(([name]) => Boolean(control(adapter, name, adapter._flag('洞府开关') === true)));
    if (force || !ready()) { adapter._call('打开洞府系统', 1); await settled(adapter, ready); }
    return null;
  }

  function building(adapter, current, config) {
    const [name, column, effectLabel, unit, cap] = config;
    const level = adapter._number(`${name}等级`);
    const validLevel = Number.isInteger(level) && level >= 0 && level < current.df?.width;
    const rawCost = validLevel ? adapter._at(current.df, level, 1) : null;
    const baseMonths = validLevel ? adapter._at(current.df, level, 2) : null;
    const speed = current.speedBonus === null ? null : 1 + current.speedBonus / 100;
    const effectiveMonths = speed === null || speed <= 0 ? null : num(divide(baseMonths, speed));
    const effectAt = atLevel => {
      const raw = adapter._at(current.df, atLevel, column);
      const factor = current.caveEnergy === null ? null : current.caveEnergy / 100 + 1;
      const value = column === 9 || column === 11 ? num(raw) : num(multiply(raw, factor));
      return { label: effectLabel, value, unit };
    };
    const cost = rounded(rawCost);
    const requiresOriginal = name === '画室';
    const active = current.active === true && current.activeName === name;
    const reason = !current.ready || !validLevel ? '建筑数据尚未完整载入。' : !current.unlocked ? '请先完成主线教学解锁洞府。' :
      adapter._blocked() ? '请先完成原游戏中的对话框。' : adapter.busy ? '正在处理上一项操作。' :
      adapter._caveCancelPending || adapter._caveQueuePending ? '上次洞府操作尚未确认，请在原界面核对。' :
      current.active === null ? '洞府升级状态尚未载入。' : current.active ? '已有建筑正在升级，可将下一项加入待建队列。' :
      !current.queueClear ? '存在建筑队列，请先在原界面处理后再单次升级。' :
      requiresOriginal ? '画室须在原界面完成原游戏解锁检查后操作。' : level >= cap ? '建筑等级已满。' :
      cost === null || cost <= 0 || effectiveMonths === null ? '原游戏升级费用或时间尚未确认。' :
      current.spiritStones === null ? '灵石余额尚未载入。' : current.spiritStones < cost ? '灵石不足。' : null;
    return { name, level, cap, cost, baseMonths: num(baseMonths), effectiveMonths, months: rounded(effectiveMonths),
      effect: validLevel ? effectAt(level) : null, nextEffect: validLevel && level < cap ? effectAt(level + 1) : null,
      active, selected: adapter._caveSelectedName === name, canStart: !reason, reason, requiresOriginal };
  }

  async function choose(adapter, name) {
    if (!BUILDINGS.some(item => item[0] === name)) return adapter._fail('请选择原游戏中存在的洞府建筑。');
    const page = await ensurePage(adapter);
    if (page) return page;
    const blocked = guard(adapter, true);
    if (blocked) return blocked;
    const nativeButton = control(adapter, name, adapter._flag('洞府开关') === true);
    if (!nativeButton || !enabled(nativeButton)) return adapter._fail('原游戏的建筑按钮暂不可用。');
    // The original page has one button per building. Selection is only DOM view state.
    adapter._caveSelectedName = name;
    return null;
  }

  async function action(adapter, operation) {
    const blocked = guard(adapter);
    if (blocked) return blocked;
    adapter.busy = true;
    adapter._caveBusy = true;
    try { return await operation(); }
    catch (error) { return adapter._fail(error.message || '原游戏未确认洞府操作完成，请查看原界面。',
      adapter._caveCancelPending || adapter._caveQueuePending ? { transactionMayHaveRun: true, requiresOriginal: true } : {}); }
    finally { adapter._caveBusy = false; adapter.busy = false; }
  }

  proto.getCaveSnapshot = function () {
    const current = data(this);
    const selectedName = this._caveSelectedName ?? (BUILDINGS.some(item => item[0] === current.activeName) ? current.activeName : '修室');
    const forecast = queueForecast(this, current);
    const buildings = BUILDINGS.map(config => ({ ...building(this, current, config), selected: config[0] === selectedName,
      enqueue: enqueueInfo(this, current, config[0]) }));
    const selected = buildings.find(item => item.name === selectedName) ?? null;
    const activeBuilding = buildings.find(item => item.name === current.activeName) ?? null;
    const rawProgress = this._number('洞府升级进度');
    const progress = current.active === true && rawProgress !== null ? Math.max(0, Math.min(100, rawProgress)) : 0;
    const remainingMonths = current.active === true && rawProgress !== null && activeBuilding?.effectiveMonths !== null && activeBuilding?.effectiveMonths !== undefined ?
      rounded(multiply((100 - rawProgress) / 100, activeBuilding.effectiveMonths)) : null;
    const commonReason = !current.ready ? '洞府数据尚未完整载入。' : !current.unlocked ? '请先完成主线教学解锁洞府。' :
      this._blocked() ? '请先完成原游戏中的对话框。' : this.busy ? '正在处理上一项操作。' :
      this._caveCancelPending || this._caveQueuePending ? '上次洞府操作尚未确认，请在原界面核对。' : null;
    const stopReason = commonReason || (current.active !== true ? '当前没有正在升级的洞府建筑。' : null) ||
      (!nativeInputAvailable(this) ? '原控件输入尚未接入，请使用原界面取消。' : null) ||
      (current.refundable === null ? '取消返还状态尚未载入。' : null) || (!activeBuilding ? '当前升级建筑尚未确认。' : null);
    const messages = this._instances('记录文字').map(instance => ({ id: safe(() => instance.uid), rawText: safe(() => instance.text), y: num(safe(() => instance.y)) }))
      .filter(item => typeof item.rawText === 'string' && /洞府建筑升级成功|建造已取消|无法升级|建筑等级已满/.test(item.rawText))
      .sort((a, b) => (b.y ?? 0) - (a.y ?? 0)).slice(0, 10)
      .map(({ id, rawText }) => ({ id, rawText, text: plain(rawText) }));
    return { ready: current.ready, unlocked: current.unlocked, unlockFlag: current.unlockFlag,
      unlockHint: '完成原游戏主线“修建洞府”教学后开放。', spiritStones: current.spiritStones,
      caveEnergy: current.caveEnergy, speedBonus: current.speedBonus, buildings, selectedName, selected,
      upgrade: { active: current.active, name: current.activeName, progress, rawProgress, remainingMonths,
        refundable: current.refundable, refundAmount: current.active === true ? current.refundable === true ? activeBuilding?.cost ?? null : current.refundable === false ? 0 : null : null },
      queue: forecast.entries, queueCount: current.queue.filter(item => item.empty === false).length,
      queueCapacity: 4, queueFingerprint: forecast.fingerprint, queueCanReorder: false,
      queueSupported: nativeInputAvailable(this), queueRequiresOriginal: !nativeInputAvailable(this),
      canEnqueue: Boolean(selected?.enqueue.canEnqueue), enqueueReason: selected?.enqueue.reason ?? '请选择建筑。',
      canStart: Boolean(selected?.canStart), startReason: selected ? selected.reason : '请选择建筑。',
      canStop: !stopReason, stopReason, blocked: this._blocked(), busy: Boolean(this.busy || this._caveBusy),
      paused: this._flag('游戏暂停'), messages, logs: messages.map(item => item.text),
      prepared: this._global('主页界面') === '洞府' && this._instances('洞府信息背景').some(shown),
      cancelContinuesQueue: current.active === true && !current.queueClear,
      originalControls: ['画室解锁及升级'],
      note: '队列不预扣灵石；原事件逐项检查费用并接续。取消当前建造后，原队列会继续；原游戏只紧缩队列，不支持任意重排。' };
  };

  proto.openCave = function () {
    return action(this, async () => { const opened = await ensurePage(this, true);
      return opened ?? this._result(true, '已打开原游戏洞府界面。'); });
  };
  proto.selectCaveBuilding = function (name) {
    return action(this, async () => { const selected = await choose(this, name);
      return selected ?? this._result(true, `已选择${name}。`, { name }); });
  };

  proto.openCaveQueue = function () {
    return action(this, async () => { const opened = await ensureQueuePanel(this);
      return opened ?? this._result(true, '已打开原游戏洞府队列。'); });
  };

  proto.enqueueCaveUpgrade = function (name, options = {}) {
    return action(this, async () => {
      const target = name ?? this._caveSelectedName ?? '修室';
      const selected = await choose(this, target);
      if (selected) return selected;
      const blocked = guard(this, true);
      if (blocked) return blocked;
      let current = data(this);
      const info = enqueueInfo(this, current, target, true);
      if (!info.canEnqueue) return this._fail(info.reason, { requiresOriginal: info.requiresOriginal });
      const expectedFingerprint = options.expectedQueueFingerprint ?? options.queueFingerprint;
      if (expectedFingerprint !== undefined && expectedFingerprint !== queueFingerprint(this, current) ||
          options.expectedTargetLevel !== undefined && options.expectedTargetLevel !== info.targetLevel) {
        return this._fail('当前建造或队列已变化，请重新查看并确认。');
      }
      const find = () => control(this, target, true);
      await settled(this, () => committed(this, find()));
      const nativeButton = find();
      current = data(this);
      const latest = enqueueInfo(this, current, target, true);
      if (!latest.canEnqueue || !enabled(nativeButton) || plain(safe(() => nativeButton.text)) !== '加队列') return this._fail(latest.reason || '原加队列按钮暂不可用。');
      if (expectedFingerprint !== undefined && expectedFingerprint !== queueFingerprint(this, current) ||
          options.expectedTargetLevel !== undefined && options.expectedTargetLevel !== latest.targetLevel) return this._fail('队列已变化，请重新确认。');
      const before = queueRaw(current);
      const emptyIndex = current.queue.findIndex(item => item.empty === true);
      if (emptyIndex < 0) return this._fail('建筑队列已满。');
      const expected = [...before]; expected[emptyIndex] = target;
      const stonesBefore = current.spiritStones;
      // Full original Touch path 3167-3173, including source bool condition and
      // native 开始洞府升级 checks. The adapter never calls the append setter.
      this._caveQueuePending = { kind: 'enqueue', before, expected };
      const pressed = await tapButton(this, nativeButton);
      if (!pressed.ok && !pressed.inputSent) { this._caveQueuePending = null; return pressed; }
      if (pressed.nativeWaitComplete === false) return pressed;
      try {
        await this._waitUntil(() => sameQueue(data(this), expected), 3500);
      } catch {
        return this._fail('原控件已接收操作，但队列可能随建造继续变化；请核对当前建造及队列，勿重复提交。',
          { transactionMayHaveRun: true, queue: queueForecast(this, data(this)).entries });
      }
      const after = data(this);
      this._caveQueuePending = null;
      return this._result(true, `${target}已加入队列，加入时不预扣灵石。`, { name: target, slot: emptyIndex + 1,
        targetLevel: latest.targetLevel, projectedCost: latest.cost, entryCost: latest.entryCost,
        queueBefore: before, queueAfter: queueRaw(after), chargedAtEnqueue: false,
        spiritStonesBefore: stonesBefore, spiritStonesAfter: after.spiritStones });
    });
  };

  proto.removeCaveQueue = function (slot, options = {}) {
    return action(this, async () => {
      if (!Number.isInteger(slot) || slot < 1 || slot > 4) return this._fail('请选择待建队列1至4，当前建造请使用取消升级。');
      if (this._caveCancelPending) return this._fail('上次取消尚未确认，请先核对当前建造。');
      const opened = await ensureQueuePanel(this);
      if (opened) return opened;
      const blocked = guard(this, true);
      if (blocked) return blocked;
      const current = data(this);
      const entry = queueForecast(this, current).entries[slot - 1];
      const expectedToken = options.expectedToken ?? options.token;
      if (!entry || entry.empty !== false) return this._fail('此队列槽已为空。');
      if (options.expectedName !== undefined && options.expectedName !== entry.name ||
          expectedToken !== undefined && expectedToken !== entry.token) return this._fail('队列项目或预计等级已变化，请重新确认移除。');
      const find = () => this._instances('队列删除按钮').find(instance => shown(instance) &&
        num(safe(() => instance.instVars.编号)) === slot && committed(this, instance));
      await settled(this, () => Boolean(find()));
      const nativeButton = find();
      const fresh = data(this);
      const freshEntry = queueForecast(this, fresh).entries[slot - 1];
      if (!enabled(nativeButton) || freshEntry.token !== entry.token) return this._fail('原删除按钮或队列已变化，请重新确认。');
      const before = queueRaw(fresh);
      const expected = before.filter((raw, index) => index !== slot - 1 && raw !== 0);
      while (expected.length < 4) expected.push(0);
      this._caveQueuePending = { kind: 'remove', before, expected };
      const pressed = await tapButton(this, nativeButton);
      if (!pressed.ok && !pressed.inputSent) { this._caveQueuePending = null; return pressed; }
      if (pressed.nativeWaitComplete === false) return pressed;
      try { await this._waitUntil(() => sameQueue(data(this), expected), 3500); }
      catch { return this._fail('原移除操作尚未稳定，建造可能同时接续；请核对队列，勿重复提交。', { transactionMayHaveRun: true }); }
      this._caveQueuePending = null;
      return this._result(true, '已通过原控件移除待建项目并紧缩队列；待建项目未预扣费用，无退款。',
        { slot, name: entry.name, queueBefore: before, queueAfter: queueRaw(data(this)), refundAmount: 0 });
    });
  };
  proto.startCaveUpgrade = function (name) {
    return action(this, async () => {
      const target = name ?? this._caveSelectedName ?? '修室';
      if (this._caveCancelPending) return this._fail('上次取消状态尚未确认，请在原界面核对。', { requiresOriginal: true });
      const initial = data(this);
      if (initial.active !== false || !initial.queueClear) return this._fail('已有升级或建筑队列，请先在原界面处理。', { requiresOriginal: true });
      if (target === '画室') return this._fail('画室须在原界面完成原游戏解锁检查后操作。', { requiresOriginal: true });
      const selected = await choose(this, target);
      if (selected) return selected;
      const blocked = guard(this, true);
      if (blocked) return blocked;
      const current = data(this);
      const config = BUILDINGS.find(item => item[0] === target);
      const info = config ? building(this, current, config) : null;
      const nativeButton = control(this, target);
      if (current.active !== false || !current.queueClear || !nativeButton || !enabled(nativeButton) || plain(safe(() => nativeButton.text)) !== '升级') {
        return this._fail('原游戏的升级按钮或队列状态已变化，请重新确认。');
      }
      // building() deliberately reports this controller's busy state while acting;
      // recheck every gameplay condition independently before dispatch.
      if (!info || !Number.isInteger(info.level) || info.level < 0 || info.level >= info.cap || info.cost === null || info.cost <= 0 || info.effectiveMonths === null) return this._fail('建筑已满级或原升级数据尚未确认。');
      if (current.spiritStones === null || current.spiritStones < info.cost) return this._fail('灵石不足。');
      if (current.spiritStones - info.cost === current.spiritStones) return this._fail('该费用无法被原游戏精确扣除，请使用原界面。');
      this._call('开始洞府升级', target, false);
      await this._waitUntil(() => this._flag('洞府开关') === true && this._global('洞府升级建筑') === target ||
        this._number(`${target}等级`) > info.level, 3000);
      const after = this._number('灵石');
      return this._result(true, `已提交${target}单次升级，由原游戏扣费并完成建造。`, { name: target, levelBefore: info.level,
        levelAfter: this._number(`${target}等级`), cost: info.cost, spiritStonesBefore: current.spiritStones,
        spiritStonesAfter: after, currencyDelta: after === null ? null : after - current.spiritStones });
    });
  };

  proto.stopCaveUpgrade = function (options = {}) {
    return action(this, async () => {
      if (this._caveCancelPending) return this._fail('上次取消状态尚未确认，请在原界面核对，勿重复退款。', { requiresOriginal: true });
      if (this._flag('洞府开关') !== true) return this._result(true, '当前没有正在升级的洞府建筑。');
      if (!nativeInputAvailable(this)) return this._fail('原控件输入尚未接入，请使用原界面取消。', { requiresOriginal: true });
      const page = await ensurePage(this);
      if (page) return page;
      const blocked = guard(this, true);
      if (blocked) return blocked;
      const findCancel = () => this._instances('洞府升级取消按钮文字').find(instance => shown(instance) && committed(this, instance));
      await settled(this, () => Boolean(findCancel()));
      const current = data(this);
      // Recheck the confirmation after every page/control await and before any
      // input: the original queue may have advanced while the user was reading.
      if (options.expectedQueueFingerprint !== undefined && options.expectedQueueFingerprint !== queueFingerprint(this, current)) {
        return this._fail('当前建造或队列已变化，请重新查看后确认要停止的建筑。');
      }
      if (current.active !== true) return this._result(true, '该升级已由原游戏结束。');
      const cancel = findCancel();
      const config = BUILDINGS.find(item => item[0] === current.activeName);
      const info = config ? building(this, current, config) : null;
      if (!cancel || !enabled(cancel) || plain(safe(() => cancel.text)) !== '取消' ||
          current.refundable === null || !info || info.cost === null || info.cost <= 0) return this._fail('原游戏取消按钮或返还金额尚未确认。');
      const refund = current.refundable ? info.cost : 0;
      const beforeFingerprint = queueFingerprint(this, current);
      const before = queueRaw(current);
      const oldLogKeys = new Set(this._instances('记录文字').map(instance => JSON.stringify([safe(() => instance.uid), safe(() => instance.text)])));
      const cancellationReceipt = () => this._instances('记录文字').find(instance => {
        const text = safe(() => instance.text);
        return typeof text === 'string' && text.includes('【建造已取消】') &&
          !oldLogKeys.has(JSON.stringify([safe(() => instance.uid), text]));
      });
      // This controller-only latch prevents retries after an uncertain native
      // Touch. Source 2970-2981 owns the refund, stop, sound and queue continuation.
      this._caveCancelPending = { name: current.activeName, level: info.level, refund, beforeFingerprint };
      const pressed = await tapButton(this, cancel);
      if (!pressed.ok && !pressed.inputSent) { this._caveCancelPending = null; return pressed; }
      if (pressed.nativeWaitComplete === false) return pressed;
      try {
        await this._waitUntil(() => {
          const after = data(this);
          const changed = after.active === false || queueFingerprint(this, after) !== beforeFingerprint;
          // Natural completion also changes active/queue, so only a fresh native
          // cancellation log can confirm this transaction. No invented receipt.
          return changed && Boolean(cancellationReceipt());
        }, 3500);
      } catch {
        return this._fail('取消或队列接续尚未稳定，请核对当前建造和灵石，勿重复取消。',
          { transactionMayHaveRun: true, requiresOriginal: true, queue: queueForecast(this, data(this)).entries });
      }
      const after = data(this);
      const receiptText = safe(() => cancellationReceipt().text);
      const actuallyRefunded = typeof receiptText === 'string' ? receiptText.includes('灵石已经返还') : null;
      // Wait(0.2) reads the then-current active building. If the quoted building
      // completed in that interval, the receipt has no amount/name: report them
      // as unknown instead of attributing the old quote to the cancellation.
      const sameQuotedLevel = this._number(`${current.activeName}等级`) === info.level;
      const confirmedRefund = actuallyRefunded === false ? 0 : sameQuotedLevel ? info.cost : null;
      this._caveCancelPending = null;
      const continuation = after.active === true ? `原队列已接续${after.activeName}，并按原规则扣费。` : '当前没有正在升级的建筑。';
      return this._result(true, `${actuallyRefunded ? '已通过原控件取消建造并处理灵石返还。' : '已通过原控件取消建造；原转世规则不返还灵石。'}${continuation}`,
        { name: sameQuotedLevel ? current.activeName : null, quotedName: current.activeName,
          refundAmount: confirmedRefund, refundSubmitted: actuallyRefunded, sourceLog: plain(receiptText),
          queueBefore: before, queueAfter: queueRaw(after), continuedName: after.active === true ? after.activeName : null,
          spiritStonesBefore: current.spiritStones, spiritStonesAfter: after.spiritStones,
          currencyDelta: after.spiritStones === null || current.spiritStones === null ? null : after.spiritStones - current.spiritStones });
    });
  };
})();
