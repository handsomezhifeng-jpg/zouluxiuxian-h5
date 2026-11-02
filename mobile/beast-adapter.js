/* Beast instances and native taming. No game globals/arrays are assigned here.
 * data.json: inventory tip 1231/1232; deploy guards 1520-1526, native 1527-1541;
 * equipped page 949-962; taming 3198-3245; pure formulas 全球参数 27/28/184.
 * save[x,17]: 1=ll ID, 2=affinity level, 3=affinity XP, 4..6=aptitudes,
 * 7=rarity, 8=evolution. Inventory stores no remaining affinity XP.
 */
(() => {
  'use strict';
  if (!window.GameAdapter) throw new Error('Beast adapter requires GameAdapter.');
  const proto = window.GameAdapter.prototype;
  const PROGRESS_SID = 947016983623910;
  const RETURN_AUTOSELL_REASON = '自动出售可能改变退回物品，请使用原界面或先关闭自动出售。';
  const MATERIAL_MULTIPLIERS = [1, 10, 100, 1000, 10000, 100000];
  const CLASSES = { 道具tips按钮文字: 555, 道具tips背景: 52, 灵兽按钮文字: 392,
    二级菜单按钮背景: 516, 驭兽形象: 1033, 驭兽按钮文字: 1034,
    驭兽翻页箭头2: 894, 驭兽翻页箭头右: 895 };
  const safe = (fn, fallback = null) => { try { return fn() ?? fallback; } catch { return fallback; } };
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const paramNumber = value => value === null || value === undefined ? null : finite(typeof value === 'number' ? value : parseFloat(value));
  const multiply = (a, b) => typeof a === 'number' && typeof b === 'number' ? a * b : a;
  const divide = (a, b) => typeof a === 'number' && typeof b === 'number' ? a / b : a;
  const subtract = (a, b) => typeof a === 'number' && typeof b === 'number' ? a - b : a;
  const percentage = value => finite(Math.max(0, Math.min(100, value)));
  const plain = value => typeof value === 'string' ? value.replace(/\[\/?(?:color|size|b|i|u|s|font|outline|shadow|stroke|background)(?:=[^\]]*)?\]/gi, '') : null;
  const visible = instance => instance && safe(() => instance.isVisible, false) === true &&
    safe(() => instance.layer.isSelfAndParentsVisible, true) !== false;
  const enabled = instance => Boolean(safe(() => instance.instVars.开关, false));
  const formula = (adapter, name, ...params) => finite(safe(() => adapter._call(name, ...params)));
  const label = (adapter, name, ...params) => plain(safe(() => adapter._call(name, ...params)));
  const entry = (name, value, unit = '') => value === null || value === undefined ? null : { label: name, value, unit };

  function data(adapter) {
    const arrays = Object.fromEntries(['save', 'svwp', 'wp', 'll', 'xm', 'dj', 'zy', 'jy'].map(name => [name, adapter._array(name)]));
    const ready = Boolean(adapter._layout() === '主界面' && adapter._dataReady() &&
      arrays.save?.width > 11 && arrays.save?.height > 18 && arrays.svwp?.height >= 14 && arrays.svwp?.depth >= 1 &&
      arrays.wp?.height >= 9 && arrays.ll?.height >= 12 && arrays.xm?.height >= 2 && arrays.dj?.width >= 152 &&
      arrays.zy?.height >= 7 && arrays.jy?.height >= 3);
    return { ...arrays, ready };
  }
  function read(adapter, array, x, y = 0, z = 0) { return adapter._at(array, x, y, z); }
  function reason(adapter, ownAction = false) {
    if (adapter._layout() !== '主界面') return '请先进入游戏。';
    if (!ownAction && (adapter.busy || adapter._beastBusy)) return '正在处理上一项操作。';
    if (adapter._blocked()) return '请先完成或关闭原游戏中的对话框。';
    if (adapter._instances('筛选背景').some(visible)) return '请先关闭原界面的筛选窗口。';
    if (safe(() => adapter._engine().IsSuspended(), false)) return '请先继续游戏。';
    return null;
  }
  function committed(adapter, name) {
    const objectClass = safe(() => adapter._engine().GetObjectClassByIndex(CLASSES[name]));
    if (safe(() => objectClass.GetName()) === name) {
      return safe(() => objectClass.GetInstances().map(instance => instance.GetInterfaceClass()));
    }
    // getAllInstances also includes pending-create instances and is not a commit proof.
    return safe(() => adapter.runtime.objects[name].getPickedInstances());
  }
  function rawRow(adapter, held, index) {
    if (!held || !Number.isInteger(index) || index < 0 || index >= held.width) return null;
    const row = [];
    for (let y = 0; y < held.height; y++) {
      const cell = [];
      for (let z = 0; z < held.depth; z++) {
        const value = read(adapter, held, index, y, z);
        if (value === null || value === undefined || typeof value === 'number' && !Number.isFinite(value)) return null;
        cell.push(value);
      }
      row.push(cell);
    }
    return row;
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function heldState(adapter) {
    const held = adapter._array('svwp');
    if (!held || ![held.width, held.height, held.depth].every(Number.isSafeInteger) || held.height < 14 || held.depth < 1) return null;
    const rows = [];
    for (let index = 0; index < held.width; index++) {
      const row = rawRow(adapter, held, index);
      if (!row) return null;
      rows.push(row);
    }
    return { held, height: held.height, depth: held.depth, rows };
  }
  function matchesHeld(adapter, before, expected) {
    const current = adapter._array('svwp');
    if (!before || current !== before.held || current.height !== before.height || current.depth !== before.depth || current.width !== expected.length) return false;
    return expected.every((row, index) => same(rawRow(adapter, current, index), row));
  }
  function slotState(adapter, save = adapter._array('save')) {
    if (!save) return null;
    const values = [];
    for (let x = 1; x <= 8; x++) {
      const value = read(adapter, save, x, 17);
      if (value === null || value === undefined || typeof value === 'number' && !Number.isFinite(value)) return null;
      values.push(value);
    }
    const id = paramNumber(values[0]);
    if (!Number.isInteger(id) || id < 0 || id === 0 && values[0] !== 0) return null;
    return { save, values, empty: values[0] === 0 };
  }
  function returnRisk(adapter, slot = slotState(adapter)) {
    // 获得道具 1097 may auto-sell other rows when an old beast is returned.
    // First deployment returns nothing and must retain the original availability.
    return slot && !slot.empty && adapter._flag('自动出售开关') === true ? RETURN_AUTOSELL_REASON : null;
  }
  function itemIdForBeast(adapter, beastId, d) {
    const name = read(adapter, d.ll, paramNumber(beastId), 1);
    if (typeof name !== 'string') return null;
    let id = null;
    // 道具编号 iterates definitions and retains the last exact name match.
    for (let x = 1; x < d.wp.width; x++) if (read(adapter, d.wp, x, 1) === name) id = x;
    return id !== null && read(adapter, d.wp, id, 2) === '灵兽' ? id : null;
  }
  function returnedRow(adapter, slot, ledger, d) {
    const id = itemIdForBeast(adapter, slot.values[0], d);
    if (id === null || read(adapter, d.wp, id, 5) !== 0) return null;
    const values = slot.values;
    const params = [values[1], values[6], values[3], values[4], values[5], values[7]].map(paramNumber);
    if (params.some(value => value === null)) return null;
    const row = Array.from({ length: ledger.height }, () => Array(ledger.depth).fill(0));
    row[0][0] = id; row[1][0] = 1;
    [2, 3, 4, 5, 6, 8].forEach((column, index) => { row[column][0] = params[index]; });
    return row;
  }
  function instance(adapter, d, id, beastId, values) {
    const [rawLevel, rawRarity, rawQi, rawAttack, rawDefense, rawEvolution] = values;
    const baseName = read(adapter, d.wp, id, 1);
    const tierRaw = read(adapter, d.wp, id, 3);
    const tier = paramNumber(tierRaw);
    const level = paramNumber(rawLevel), rarity = paramNumber(rawRarity), evolution = paramNumber(rawEvolution);
    const aptitudes = { qi: paramNumber(rawQi), attack: paramNumber(rawAttack), defense: paramNumber(rawDefense) };
    const raceId = paramNumber(read(adapter, d.ll, beastId, 2));
    const race = raceId === null ? null : read(adapter, d.xm, raceId, 1);
    const requirementThreshold = tierRaw === null ? null : multiply(subtract(tierRaw, 1), 10);
    const threshold = paramNumber(requirementThreshold);
    const requiredLevel = threshold === null ? null : Math.floor(threshold) + 1;
    const requiredTaming = formula(adapter, '驭兽技艺要求', beastId);
    const ownLevel = adapter._number('lv'), taming = adapter._number('驭兽等级');
    const met = ownLevel !== null && requirementThreshold !== null && ownLevel > requirementThreshold &&
      taming !== null && requiredTaming !== null && taming >= requiredTaming;
    const evolutionLabel = label(adapter, '历练兽等级转换', rawEvolution);
    return {
      id, beastId, name: typeof baseName === 'string' ? baseName : null,
      displayName: typeof baseName === 'string' ? `${evolutionLabel ? evolutionLabel + '·' : ''}${baseName}` : null,
      category: '灵兽', tier, tierLabel: tierRaw === null ? null : label(adapter, '品阶转换', tierRaw),
      raceId, race: typeof race === 'string' ? race : null,
      rarity, rarityLabel: rawRarity === null ? null : label(adapter, '稀有计算', rawRarity),
      evolution, evolutionLabel, level, aptitudes,
      // Equipped contributions come from live globals below. Inventory tips do not
      // show calculated combat contributions; no speculative stat preview is added.
      stats: { qi: null, attack: null, defense: null },
      requirements: { level: requiredLevel, realm: requiredLevel === null ? null : read(adapter, d.dj, requiredLevel, 1),
        tamingLevel: requiredTaming, met }
    };
  }
  function equipped(adapter, d, slot) {
    if (!slot || slot.empty) return null;
    const v = slot.values, id = itemIdForBeast(adapter, v[0], d);
    if (id === null) return null;
    const result = instance(adapter, d, id, paramNumber(v[0]), [v[1], v[6], v[3], v[4], v[5], v[7]]);
    const requiredAffinity = formula(adapter, '灵兽升级经验', v[1]);
    const undeployReason = reason(adapter) || returnRisk(adapter, slot);
    return { ...result, affinity: paramNumber(v[2]), requiredAffinity,
      affinityProgress: requiredAffinity === null ? null : percentage(multiply(divide(v[2], requiredAffinity), 100)),
      maxLevel: 150, stats: { qi: adapter._number('灵兽真气'), attack: adapter._number('灵兽攻击'), defense: adapter._number('灵兽防御') },
      canUndeploy: !undeployReason, reason: undeployReason, undeployReason,
      requiresOriginal: undeployReason === RETURN_AUTOSELL_REASON,
      note: '下阵保留契合等级、稀有、三项资质与进化；契合余量不随背包保存。' };
  }
  function beastDetail(adapter, index, ownAction = false) {
    const d = data(adapter), held = d.svwp;
    if (!d.ready || !Number.isInteger(index) || index < 1 || index >= held.width) return null;
    const row = rawRow(adapter, held, index);
    const id = row ? paramNumber(row[0][0]) : null;
    if (!Number.isInteger(id) || id < 1 || read(adapter, d.wp, id, 2) !== '灵兽') return null;
    const beastId = paramNumber(read(adapter, d.wp, id, 4));
    if (!Number.isInteger(beastId) || beastId < 1 || beastId >= d.ll.width) return null;
    const count = paramNumber(row[1][0]);
    if (count === null || count <= 0) return null;
    const detail = instance(adapter, d, id, beastId, [2, 3, 4, 5, 6, 8].map(column => row[column][0]));
    const complete = detail.level !== null && detail.rarity !== null && detail.evolution !== null &&
      Object.values(detail.aptitudes).every(value => value !== null) && detail.requirements.level !== null && detail.requirements.tamingLevel !== null;
    const current = slotState(adapter, d.save);
    const why = reason(adapter, ownAction) || returnRisk(adapter, current) || (!complete ? '灵兽实例数据尚未完整载入。' :
      !detail.requirements.met ? `需达到${detail.requirements.realm || '相应境界'}、驭兽技艺${detail.requirements.tamingLevel}级后上阵。` : null);
    const details = [entry('种族', detail.race), entry('稀有', detail.rarityLabel), entry('进化', detail.evolutionLabel),
      entry('契合等级', detail.level), entry('真气资质', detail.aptitudes.qi), entry('攻击资质', detail.aptitudes.attack),
      entry('防御资质', detail.aptitudes.defense), entry('所需境界', detail.requirements.realm), entry('所需驭兽技艺', detail.requirements.tamingLevel)].filter(Boolean);
    return { ...detail, inventoryIndex: index, count, instanceKey: JSON.stringify(row), affinity: null,
      canDeploy: !why, reason: why, requiresOriginal: why === RETURN_AUTOSELL_REASON,
      details, effectText: details.map(value => `${value.label}：${value.value}${value.unit}`).join('\n'),
      note: '背包不保存契合余量；上阵后按原规则从本级0点开始。',
      actions: [{ id: 'deploy-beast', label: current && !current.empty ? '替换上阵' : '上阵', enabled: !why, reason: why }] };
  }
  function expectedInstance(detail, options) {
    if (options.expectedItemId !== undefined && options.expectedItemId !== detail.id) return false;
    const expected = options.expectedBeast;
    if (expected === undefined) return true;
    if (!expected || ['id', 'beastId', 'rarity', 'level', 'evolution'].some(key => !Object.is(expected[key], detail[key]))) return false;
    if (['qi', 'attack', 'defense'].some(key => !Object.is(expected.aptitudes?.[key], detail.aptitudes[key]))) return false;
    return expected.instanceKey === undefined || expected.instanceKey === detail.instanceKey;
  }
  function trainingSettings(adapter, ownAction = false) {
    const d = data(adapter), slot = slotState(adapter, d.save);
    const materialMultiplier = adapter._number('驭兽材料倍率');
    const savedMaterialMultiplier = paramNumber(read(adapter, d.save, 46, 22));
    const active = adapter._flag('驭兽开关');
    const why = reason(adapter, ownAction) || (!d.ready ? '驭兽数据尚未完整载入。' :
      read(adapter, d.save, 11, 18) !== 1 ? '请先完成原主线教学，解锁驭兽。' :
      !slot || slot.empty ? '请先上阵一只灵兽，原倍率控件才会出现。' :
      active !== false ? active === true ? '请先停止驭兽，再调整材料倍率。' : '驭兽状态尚未载入。' :
      !MATERIAL_MULTIPLIERS.includes(materialMultiplier) ? '当前原倍率不在常规十倍档位，请使用原界面调整。' :
      adapter._nativeInputBusy ? '正在处理上一项设置。' :
      typeof adapter._nativeTap !== 'function' ? '原控件输入尚未载入，请使用原界面。' : null);
    return { materialMultiplier, savedMaterialMultiplier, choices: MATERIAL_MULTIPLIERS.slice(),
      canConfigure: !why, reason: why,
      requiresOriginal: !MATERIAL_MULTIPLIERS.includes(materialMultiplier) || typeof adapter._nativeTap !== 'function',
      note: '倍率只通过原箭头逐档调整，原设置不会被重置；每轮耗材按该倍率，技艺经验不按倍率等比增加。' };
  }
  function training(adapter, ownAction = false) {
    const d = data(adapter), slot = slotState(adapter, d.save), pet = d.ready ? equipped(adapter, d, slot) : null;
    const unlocked = d.ready ? read(adapter, d.save, 11, 18) === 1 : null;
    const level = adapter._number('驭兽等级'), proficiency = adapter._number('驭兽经验');
    const proficiencyCap = level === null ? null : paramNumber(read(adapter, d.jy, level, 1));
    const multiplier = adapter._number('驭兽材料倍率');
    const materialTier = slot && !slot.empty ? finite(Math.ceil(divide(slot.values[1], 10))) : null;
    const materialName = materialTier === null ? null : read(adapter, d.zy, materialTier, 3);
    const owned = d.ready && typeof materialName === 'string' ? formula(adapter, '道具数量', materialName) : null;
    const inventoryIndex = d.ready && typeof materialName === 'string' && owned > 0 ? formula(adapter, '道具序号', materialName) : null;
    const materialId = inventoryIndex === null ? null : paramNumber(read(adapter, d.svwp, inventoryIndex, 0));
    const enough = owned !== null && multiplier !== null && multiplier > 0 && owned >= multiplier;
    const active = adapter._flag('驭兽开关'), rawProgress = finite(adapter._local(PROGRESS_SID));
    const why = reason(adapter, ownAction) || (!d.ready ? '驭兽数据尚未完整载入。' : !unlocked ? '完成灵兽上阵主线教学后解锁驭兽。' :
      !slot ? '上阵灵兽数据尚未载入。' : slot.empty ? '请先上阵一只灵兽。' : !pet ? '上阵灵兽定义尚未确认。' :
      !(slot.values[1] < 150) ? '契合等级已满，无法开始驭兽。' : !enough ? `${typeof materialName === 'string' ? materialName : '所需妖核'}不足，无法驭兽。` : null);
    return {
      ready: d.ready, unlocked, unlockReason: unlocked ? null : '完成灵兽上阵主线教学后解锁驭兽。',
      level, proficiency, proficiencyCap, skill: { level, experience: proficiency, requiredExperience: proficiencyCap, maxLevel: 100 },
      equipped: pet, active, progress: rawProgress === null ? null : percentage(rawProgress), rawProgress, cycleMonths: 1,
      materialMultiplier: multiplier, materials: typeof materialName === 'string' ? [{ id: materialId, name: materialName,
        inventoryIndex, required: multiplier, owned, enough }] : [], materialsReady: enough,
      affinityPerCycle: slot && !slot.empty && materialTier !== null && level !== null && multiplier !== null ?
        formula(adapter, '驭兽契合增加', materialTier, read(adapter, d.jy, level, 2), multiplier) : null,
      canStart: !why && active === false, canStop: d.ready && active === true && !reason(adapter, ownAction),
      reason: why, paused: adapter._flag('游戏暂停'), blocked: adapter._blocked(), busy: Boolean(adapter.busy || adapter._beastBusy),
      settings: trainingSettings(adapter, ownAction), messages: [], logs: [],
      note: '每轮由原游戏消耗所需妖核并结算契合值；倍率调整经过原箭头事件。'
    };
  }
  async function clearTips(adapter) {
    adapter._call('关闭物品tips');
    await adapter._waitUntil(() => committed(adapter, '道具tips按钮文字')?.length === 0 &&
      committed(adapter, '道具tips背景')?.length === 0, 1800);
  }
  async function openTraining(adapter) {
    const d = data(adapter);
    if (!d.ready || read(adapter, d.save, 11, 18) !== 1) throw new Error('请先完成原主线教学，解锁驭兽。');
    let entryButton = committed(adapter, '二级菜单按钮背景')?.find(value => visible(value) && safe(() => value.instVars.功能) === '驭兽');
    if (!entryButton) {
      adapter._call('打开技艺二级菜单');
      await adapter._waitUntil(() => committed(adapter, '二级菜单按钮背景')?.some(value => visible(value) && safe(() => value.instVars.功能) === '驭兽'), 1800);
      entryButton = committed(adapter, '二级菜单按钮背景')?.find(value => visible(value) && safe(() => value.instVars.功能) === '驭兽');
    }
    if (!entryButton || !enabled(entryButton) || safe(() => entryButton.animationName) !== '解锁') throw new Error('原游戏驭兽入口暂不可用。');
    const previous = new Set(committed(adapter, '驭兽形象') || []);
    adapter._call('打开驭兽系统', 1, 0);
    await adapter._waitUntil(() => committed(adapter, '驭兽形象')?.some(value => !previous.has(value) && visible(value)), 1800);
    const currentSlot = slotState(adapter);
    if (currentSlot && !currentSlot.empty) await adapter._waitUntil(() => committed(adapter, '驭兽按钮文字')?.some(value => visible(value) && enabled(value)), 1800);
  }

  proto.getBeastDetail = function (inventoryIndex) { return beastDetail(this, inventoryIndex); };
  proto.getBeastTrainingSnapshot = function () { return training(this); };
  proto.getBeastTrainingSettings = function () { return trainingSettings(this); };
  proto.configureBeastTraining = async function (options = {}) {
    if (!MATERIAL_MULTIPLIERS.includes(options.materialMultiplier)) return this._fail('请选择原材料倍率档位：1、10、100、1000、10000或100000。');
    const guarded = this._guard(); if (guarded) return guarded;
    let current = trainingSettings(this);
    if (!current.canConfigure) return this._fail(current.reason, { requiresOriginal: current.requiresOriginal });
    if (current.materialMultiplier === options.materialMultiplier) return this._result(true, '驭兽材料倍率未改变。',
      { settings: current, requiresSave: current.savedMaterialMultiplier !== current.materialMultiplier });
    this._beastBusy = true; this.busy = true;
    try {
      await openTraining(this);
      while (this._number('驭兽材料倍率') !== options.materialMultiplier) {
        current = trainingSettings(this, true);
        if (!current.canConfigure) return this._fail(current.reason, { requiresOriginal: current.requiresOriginal });
        const before = current.materialMultiplier;
        const increasing = before < options.materialMultiplier;
        const name = increasing ? '驭兽翻页箭头右' : '驭兽翻页箭头2';
        const next = increasing ? before * 10 : before / 10;
        if (!MATERIAL_MULTIPLIERS.includes(next) || increasing && before > 10000 || !increasing && before <= 1)
          return this._fail('原倍率已到可调整边界，请重新查看。');
        await this._waitUntil(() => committed(this, name)?.some(value => visible(value) && enabled(value)), 1800);
        const arrow = committed(this, name)?.find(value => visible(value) && enabled(value));
        const fresh = trainingSettings(this, true);
        if (!fresh.canConfigure || fresh.materialMultiplier !== before) return this._fail(fresh.reason || '倍率已变化，请重新选择。');
        // Original 3211-3216 validate !驭兽开关 and arrow 开关, then wait 0.2.
        const tapped = await this._nativeTap(arrow, { allowModal: false,
          blockers: ['黑幕', '遮挡底板上', '遮挡底板下'], timeout: 1800 });
        if (tapped?.ok !== true) return tapped ?? this._fail('原倍率箭头未接收输入。');
        await this._waitUntil(() => this._number('驭兽材料倍率') === next &&
          committed(this, name)?.includes(arrow) && enabled(arrow), 3000);
      }
      const result = trainingSettings(this, true);
      return this._result(true, `驭兽材料倍率已设为${result.materialMultiplier}。`,
        { settings: result, requiresSave: result.savedMaterialMultiplier !== result.materialMultiplier });
    } catch (error) { return this._fail(error.message || '原游戏尚未确认材料倍率设置。'); }
    finally { this._beastBusy = false; this.busy = false; }
  };

  proto.deployBeast = async function (inventoryIndex, options = {}) {
    const guarded = this._guard(); if (guarded) return guarded;
    const detail = beastDetail(this, inventoryIndex);
    if (!detail?.canDeploy) return this._fail(detail?.reason || '该物品不是可上阵的灵兽。',
      detail?.requiresOriginal ? { requiresOriginal: true } : {});
    if (!expectedInstance(detail, options)) return this._fail('灵兽行或资质已变化，请重新查看并确认。');
    const originalRow = rawRow(this, this._array('svwp'), inventoryIndex);
    this._beastBusy = true; this.busy = true;
    let createdTips = false;
    try {
      await clearTips(this);
      if (reason(this, true)) throw new Error(reason(this, true));
      if (!same(rawRow(this, this._array('svwp'), inventoryIndex), originalRow)) throw new Error('原纳戒行已变化，请重新选择灵兽。');
      const held = this._array('svwp');
      const params = [200, 200, inventoryIndex, '纳戒', 0, 0,
        ...[2, 3, 4, 5, 6].map(column => read(this, held, inventoryIndex, column)),
        read(this, held, inventoryIndex, 1), detail.id, 5,
        ...[8, 9, 10, 11, 12, 13].map(column => read(this, held, inventoryIndex, column)), 0];
      if (params.some(value => value === null)) throw new Error('灵兽原实例参数尚未完整载入。');
      this._call('道具tips建立', ...params); createdTips = true;
      await this._waitUntil(() => committed(this, '道具tips按钮文字')?.some(value => visible(value) &&
        safe(() => value.text) === '上阵' && safe(() => value.instVars.道具序号) === inventoryIndex), 1800);
      const button = committed(this, '道具tips按钮文字')?.find(value => visible(value) &&
        safe(() => value.text) === '上阵' && safe(() => value.instVars.道具序号) === inventoryIndex);
      const current = beastDetail(this, inventoryIndex, true);
      if (current?.requiresOriginal) return this._fail(current.reason, { requiresOriginal: true });
      if (!button || !enabled(button) || !current?.canDeploy || !expectedInstance(current, options) ||
        !same(rawRow(this, this._array('svwp'), inventoryIndex), originalRow)) throw new Error(current?.reason || '原灵兽按钮或实例已经改变，请重新查看。');
      const d = data(this), slot = slotState(this, d.save), ledger = heldState(this);
      if (!slot || !ledger) throw new Error('无法确认原灵兽与纳戒数据。');
      const expectedRows = ledger.rows.map(row => row.map(cell => cell.slice()));
      if (!slot.empty) {
        const returned = returnedRow(this, slot, ledger, d);
        if (!returned) throw new Error('旧灵兽回收参数尚未确认，请在原界面替换。');
        expectedRows.push(returned);
      }
      const rawCount = originalRow[1][0];
      if (typeof rawCount !== 'number' || rawCount - 1 === rawCount) throw new Error('原游戏无法精确扣除此灵兽。');
      if (rawCount - 1 <= 0) expectedRows.splice(inventoryIndex, 1);
      else expectedRows[inventoryIndex][1][0] = rawCount - 1;
      const expectedSlot = [read(this, d.wp, detail.id, 4), originalRow[2][0], 0,
        originalRow[4][0], originalRow[5][0], originalRow[6][0], originalRow[3][0], originalRow[8][0]];
      this._call('灵兽上阵', inventoryIndex);
      await this._waitUntil(() => {
        const after = slotState(this);
        return after?.save === slot.save && same(after.values, expectedSlot) &&
          matchesHeld(this, ledger, expectedRows) && this._flag('驭兽开关') === false;
      }, 3000);
      return this._result(true, slot.empty ? '灵兽已上阵。' : '已替换上阵，旧灵兽按原资质回到纳戒。');
    } catch (error) { return this._fail(error.message || '原游戏尚未确认灵兽上阵。'); }
    finally { if (createdTips) safe(() => this._call('关闭物品tips')); this._beastBusy = false; this.busy = false; }
  };

  proto.undeployBeast = async function () {
    const guarded = this._guard(); if (guarded) return guarded;
    const why = reason(this); if (why) return this._fail(why);
    const d = data(this), initial = slotState(this, d.save);
    if (!d.ready || !initial) return this._fail('上阵灵兽数据尚未载入。');
    if (initial.empty) return this._fail('当前没有已上阵灵兽。');
    const initialRisk = returnRisk(this, initial);
    if (initialRisk) return this._fail(initialRisk, { requiresOriginal: true });
    this._beastBusy = true; this.busy = true;
    try {
      await clearTips(this);
      if (!this._first('系统菜单背景')) throw new Error('原人物界面尚未载入。');
      const previous = new Set(committed(this, '灵兽按钮文字') || []);
      this._call('打开灵兽分页');
      await this._waitUntil(() => committed(this, '灵兽按钮文字')?.some(value => !previous.has(value) && visible(value) && safe(() => value.text) === '下阵'), 1800);
      const button = committed(this, '灵兽按钮文字')?.find(value => visible(value) && safe(() => value.text) === '下阵');
      const slot = slotState(this), ledger = heldState(this);
      if (reason(this, true)) throw new Error(reason(this, true));
      const currentRisk = returnRisk(this, slot);
      if (currentRisk) return this._fail(currentRisk, { requiresOriginal: true });
      // Native feeding may advance level/affinity while the new page commits.
      // Identity remains the same only when species, rarity, aptitudes and evolution match.
      if (!button || !enabled(button) || !slot || slot.save !== initial.save ||
        !same([0, 3, 4, 5, 6, 7].map(x => slot.values[x]), [0, 3, 4, 5, 6, 7].map(x => initial.values[x])) || !ledger) throw new Error('上阵灵兽或原下阵按钮已经改变。');
      const returned = returnedRow(this, slot, ledger, d);
      if (!returned) throw new Error('无法确认原灵兽回收参数。');
      const expectedRows = [...ledger.rows, returned];
      this._call('灵兽下阵');
      await this._waitUntil(() => {
        const after = slotState(this);
        return after?.save === slot.save && after.values.every(value => value === 0) &&
          matchesHeld(this, ledger, expectedRows) && this._flag('驭兽开关') === false;
      }, 3000);
      return this._result(true, '灵兽已下阵，同一资质的灵兽已回到纳戒。');
    } catch (error) { return this._fail(error.message || '原游戏尚未确认灵兽下阵。'); }
    finally { this._beastBusy = false; this.busy = false; }
  };

  proto.openBeastTraining = async function () {
    const guarded = this._guard(); if (guarded) return guarded;
    const why = reason(this); if (why) return this._fail(why);
    this._beastBusy = true; this.busy = true;
    try { await openTraining(this); return this._result(true, '已打开原游戏驭兽界面。'); }
    catch (error) { return this._fail(error.message); }
    finally { this._beastBusy = false; this.busy = false; }
  };
  proto.startBeastTraining = async function () {
    const guarded = this._guard(); if (guarded) return guarded;
    const snapshot = training(this);
    if (snapshot.active === true) return this._result(true, '已经在驭兽。');
    if (!snapshot.canStart) return this._fail(snapshot.reason || '当前无法开始驭兽。');
    const initial = slotState(this);
    this._beastBusy = true; this.busy = true;
    try {
      await openTraining(this);
      const current = training(this, true), slot = slotState(this);
      const button = committed(this, '驭兽按钮文字')?.find(value => visible(value) && safe(() => value.text) === '驭兽');
      if (!current.canStart || !button || !enabled(button) || !slot || slot.save !== initial?.save || !same(slot.values, initial.values)) throw new Error(current.reason || '原驭兽按钮或上阵灵兽已经改变。');
      this._call('开始驭兽');
      await this._waitUntil(() => this._flag('驭兽开关') === true && same(slotState(this)?.values, initial.values), 1800);
      return this._result(true, '已开始喂核驭兽，原游戏将逐轮消耗妖核。');
    } catch (error) { return this._fail(error.message || '原游戏尚未开始驭兽。'); }
    finally { this._beastBusy = false; this.busy = false; }
  };
  proto.stopBeastTraining = async function () {
    const guarded = this._guard(); if (guarded) return guarded;
    const why = reason(this); if (why) return this._fail(why);
    if (this._flag('驭兽开关') !== true) return this._result(true, '当前未在驭兽。');
    this._beastBusy = true; this.busy = true;
    try {
      this._call('停止驭兽');
      await this._waitUntil(() => this._flag('驭兽开关') === false && this._local(PROGRESS_SID) === 0, 1800);
      return this._result(true, '已停止驭兽。');
    } catch (error) { return this._fail(error.message); }
    finally { this._beastBusy = false; this.busy = false; }
  };
})();
