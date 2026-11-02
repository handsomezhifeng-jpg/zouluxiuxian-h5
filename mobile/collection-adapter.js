/* Collection controls for the shipped event engine. No save-array writes.
 * Source data.json: item tips 1164-1210; equip 1260-1303; pills 1333-1362;
 * fruit 1364-1389; sales 1438-1456; learning 1478-1489; arts 2417-2444.
 * Every item action uses its inventory row, preserving the original instance
 * quality fields and the native item's consumption/equipment functions.
 */
(() => {
  'use strict';
  const Adapter = window.GameAdapter;
  if (!Adapter) throw new Error('GameAdapter must load before collection-adapter.js');
  const proto = Adapter.prototype;
  const attempt = (fn, fallback = null) => { try { return fn() ?? fallback; } catch { return fallback; } };
  const number = value => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  // Preserve table-cell types until the generated source expression coerces them.
  const sourceMultiply = (left, right) => typeof left === 'number' && typeof right === 'number' ? left * right : left;
  const sourceDivide = (left, right) => typeof left === 'number' && typeof right === 'number' ? left / right : left;
  const sourceSubtract = (left, right) => typeof left === 'number' && typeof right === 'number' ? left - right : left;
  const finiteResult = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  // Numeric function parameters use parseFloat in EventVariable.SetValue.
  const numericParameter = value => finiteResult(typeof value === 'number' ? value : parseFloat(value));
  const slots = { 1: '法戒', 2: '飞剑', 3: '护心' };
  const slotByType = { 法戒: 1, 飞剑: 2, 护心: 3 };
  // Original price branches 165-172 and item-tip buttons offer these categories.
  // Sacred artifacts use a separate return flow and are deliberately excluded.
  const sellCategories = new Set(['法宝', '宝材', '丹药', '灵物', '灵兽', '灵果', '配方', '功法', '妖核', '草木', '金石', '逆道果', '命石', '符纸']);
  const fruitEffects = {
    感气果: ['人物气感', '灵果天资'], 凝神果: ['人物神识', '灵果天资'],
    淬骨果: ['人物根骨', '灵果天资'], 冥悟果: ['人物悟性', '灵果天资'],
    福缘果: ['人物机缘', '灵果天资'], 长生果: ['寿元', '灵果寿元'],
    参悟果: ['参悟值', '灵果参悟']
  };
  const pillCaps = { 真气: ['丹药真气', 7], 攻击: ['丹药攻击', 8], 防御: ['丹药防御', 9], 寿元: ['丹药寿元', 10] };
  const artEffects = [
    [4, '每重真气加成', '%'], [5, '每重攻击加成', '%'], [6, '每重防御加成', '%'],
    [7, '每重寿元', ''], [8, '每重修炼速度', '%'], [9, '每重祛毒速度', '']
  ];

  function read(adapter, table, x, y = 0, z = 0) {
    return adapter._at(adapter._array(table), x, y, z);
  }
  function formula(adapter, name, ...params) { return finiteResult(attempt(() => adapter._call(name, ...params))); }
  function label(adapter, name, ...params) {
    const value = attempt(() => adapter._call(name, ...params));
    return typeof value === 'string' ? value.replace(/\[\/?(?:color|size|b|i|u|s|font|outline|shadow|stroke|background)(?:=[^\]]*)?\]/gi, '') : null;
  }
  function entry(labelText, value, unit = '') { return value === null ? null : { label: labelText, value, unit }; }
  function action(id, text, reason = null) { return { id, label: text, enabled: !reason, reason }; }
  function blockedReason(adapter) {
    if (adapter._layout() !== '主界面') return '请先进入游戏。';
    if (adapter.busy || adapter._collectionBusy) return '正在处理上一项操作。';
    if (adapter._blocked()) return '请先完成或关闭原游戏中的对话框。';
    if (adapter._instances('筛选背景').some(instance => adapter._visible(instance))) return '请先关闭原界面的筛选窗口。';
    return null;
  }
  function addOriginal(detail, reason) {
    detail.actions.push(action('original', '原界面详情', reason));
    detail.originalRoute = 'inventory';
    detail.effectText = detail.details.map(item => `${item.label}：${item.value}${item.unit}`).join('\n');
    detail.reason = reason || (detail.nativeActionsKnown ? null : '此类物品的竖屏操作尚未验证，可在原界面继续操作。');
    return detail;
  }
  function itemBase(adapter, index) {
    if (!Number.isInteger(index) || index < 1) return null;
    return adapter._inventorySnapshot()?.find(item => item.inventoryIndex === index) ?? null;
  }
  function heldCells(adapter, held, width, height, depth) {
    const rows = [];
    for (let x = 0; x < width; x++) {
      const row = [];
      for (let y = 0; y < height; y++) for (let z = 0; z < depth; z++) {
        const value = adapter._at(held, x, y, z);
        // Missing/error reads must not become evidence that an item disappeared.
        if (value === null || value === undefined) return null;
        row.push(value);
      }
      rows.push(row);
    }
    return rows;
  }
  function consumptionConfirmation(adapter, index, detail, quantity) {
    const held = adapter._array('svwp');
    if (!held) return null;
    const { width, height, depth } = held;
    if (![width, height, depth].every(Number.isSafeInteger) || width <= index || index < 0 || height < 2 || depth < 1) return null;
    const rows = heldCells(adapter, held, width, height, depth);
    if (!rows) return null;
    const countOffset = depth; // row layout above is y-major; quantity is [x,1,0].
    const rawCount = rows[index][countOffset];
    if (number(rows[index][0]) !== detail.id || typeof rawCount !== 'number' || !Number.isFinite(rawCount) ||
        rawCount !== detail.count || rawCount <= 0 || !Number.isSafeInteger(quantity) || quantity < 1) return null;
    const remaining = rawCount - quantity;
    if (!Number.isFinite(remaining) || remaining === rawCount) return null;
    // Native 失去道具 (1103/1104) subtracts, then Delete(index, X) at <= 0.
    // Match the whole transform, including IDs/quality and the shifted suffix.
    // An unrelated concurrent deletion or row replacement must not prove success.
    const removed = remaining <= 0;
    const expected = rows.map(row => row.slice());
    if (removed) expected.splice(index, 1);
    else expected[index][countOffset] = remaining;
    return () => {
      const current = adapter._array('svwp');
      if (current !== held || current.height !== height || current.depth !== depth ||
          current.width !== width - (removed ? 1 : 0)) return false;
      const actual = heldCells(adapter, current, current.width, height, depth);
      return actual !== null && actual.every((row, x) => row.length === expected[x].length &&
        row.every((value, cell) => Object.is(value, expected[x][cell])));
    };
  }
  function treasureDetails(adapter, id, quality) {
    const subId = number(read(adapter, 'wp', id, 4));
    const type = subId === null ? null : read(adapter, 'lq', subId, 2);
    const base = subId === null ? null : read(adapter, 'lq', subId, 4);
    const tier = number(read(adapter, 'wp', id, 3));
    const requirement = tier === null ? null : formula(adapter, '法宝装备要求', tier);
    // Native tips 1165-1167: round(multiply(品质1, divide(lq[...,4],100))).
    // String table cells are not converted before strict divide/multiply.
    const amount = quality === null || base === null ? null : finiteResult(Math.round(sourceMultiply(quality, sourceDivide(base, 100))));
    const statLabel = { 法戒: '基础真气', 飞剑: '基础攻击', 护心: '基础防御' }[type];
    return {
      equipmentSlot: slotByType[type] ?? null, equipmentType: typeof type === 'string' ? type : null,
      requiredLevel: requirement,
      requiredRealm: requirement === null ? null : read(adapter, 'dj', requirement, 1),
      details: [entry(statLabel || '属性', amount), entry('品质', quality === null ? null : label(adapter, '品质计算', quality))].filter(Boolean)
    };
  }

  proto.getItemDetail = function (inventoryIndex) {
    const item = itemBase(this, inventoryIndex);
    if (!item) return null;
    const reason = blockedReason(this);
    const rawQuality = read(this, 'svwp', inventoryIndex, 2);
    const quality = rawQuality === null ? null : numericParameter(rawQuality);
    const detail = { ...item, quality, qualityName: null, details: [], actions: [], nativeActionsKnown: false };
    detail.tierLabel = item.tier === null ? null : label(this, '品阶转换', item.tier);

    if (item.category === '法宝') {
      Object.assign(detail, treasureDetails(this, item.id, quality));
      detail.qualityName = quality === null ? null : label(this, '品质计算', quality);
      const level = this._number('lv');
      const unavailable = reason || (!detail.equipmentSlot || quality === null || detail.requiredLevel === null || level === null ?
        '法宝数据尚未完整载入。' : level < detail.requiredLevel ? `需要达到${detail.requiredRealm || '相应境界'}后装备。` : null);
      detail.actions.push(action('equip', '装备', unavailable));
      detail.nativeActionsKnown = true;
    } else if (item.category === '丹药') {
      const effect = read(this, 'ld', item.subtableId, 2);
      const base = read(this, 'ld', item.subtableId, 3);
      const poisonBase = read(this, 'ld', item.subtableId, 4);
      // Use/limit events 1337/1339 read raw arrays, then round strict multiply.
      const poison = rawQuality === null || poisonBase === null ? null : finiteResult(Math.round(sourceMultiply(rawQuality, poisonBase)));
      // This native leaf formula converts numeric parameters internally, including
      // scientific-string bases, exactly as the original tip/use expressions do.
      const gain = base === null || rawQuality === null ? null : formula(this, '丹药属性', base, rawQuality, effect);
      const poisonNow = this._number('丹毒');
      const poisonCap = this._number('丹毒上限');
      const level = this._number('lv');
      const capInfo = pillCaps[effect];
      const used = capInfo ? this._number(capInfo[0]) : null;
      const cap = capInfo && level !== null ? number(read(this, 'dj', level, capInfo[1])) : null;
      detail.qualityName = quality === null ? null : label(this, '品质计算', quality);
      detail.effectType = typeof effect === 'string' ? effect : null;
      detail.details = [entry(`基础${effect || '属性'}`, gain), entry('增加丹毒', poison), entry('当前丹毒', poisonNow), entry('丹毒上限', poisonCap), entry('本境界已用丹效', used), entry('本境界丹效上限', cap)].filter(Boolean);
      const unavailable = reason || (!capInfo || used === null || cap === null || poison === null || poisonNow === null || poisonCap === null ?
        '丹药数据尚未完整载入。' : poisonNow >= poisonCap * .8 || poisonNow + poison >= poisonCap ?
          '丹毒过高，原游戏暂不允许服丹。' : used >= cap ? '本境界该类丹效已达上限。' : null);
      detail.actions.push(action('use', '服用一枚', unavailable));
      detail.nativeActionsKnown = true;
    } else if (item.category === '灵果' && fruitEffects[item.name]) {
      const rawYears = read(this, 'svwp', inventoryIndex, 3);
      const years = rawYears === null ? null : numericParameter(rawYears);
      const [effect, functionName] = fruitEffects[item.name];
      const gain = years === null ? null : formula(this, functionName, rawYears);
      detail.name = years === null ? item.name : label(this, '灵果名', years, item.name) || item.name;
      detail.years = years;
      detail.details = [entry('年份', years, '年'), entry(effect, gain)].filter(Boolean);
      detail.actions.push(action('use', '食用一枚', reason || (gain === null ? '灵果数据尚未完整载入。' : null)));
      detail.nativeActionsKnown = true;
    } else if (item.category === '功法') {
      const art = this.getArtDetail(item.artId);
      const cap = formula(this, '功法上限');
      const learnedCount = formula(this, '功法已学数量', 0);
      detail.art = art;
      detail.details = art?.details ?? [];
      detail.learnedCount = learnedCount;
      detail.artCapacity = cap;
      const unavailable = reason || (!art || cap === null || learnedCount === null ? '功法数据尚未完整载入。' :
        art.level > 0 ? '已领悟该功法，无法重复领悟。' : learnedCount >= cap ? '已学功法达到当前栏位上限。' : null);
      detail.actions.push(action('learn', '领悟功法', unavailable));
      detail.nativeActionsKnown = true;
    }
    detail.sellUnitPrice = sellCategories.has(item.category) && typeof this.queryItemPrice === 'function' ? this.queryItemPrice(inventoryIndex, 'svwp', true) : null;
    detail.sellLocked = number(read(this, 'svwp', inventoryIndex, 7)) === 1;
    if (sellCategories.has(item.category)) {
      // Original click 1440 blocks svwp[row,7] === 1 before opening quantity input.
      const unavailable = reason || (detail.sellLocked ? '该物品已锁定，请先在原界面解锁。' :
        detail.sellUnitPrice === null || detail.sellUnitPrice <= 0 ? '原游戏售价尚未确认。' : null);
      detail.actions.push(action('sell', '卖出', unavailable));
      detail.nativeActionsKnown = true;
    }
    return addOriginal(detail, reason);
  };

  proto.getArtDetail = function (artId) {
    const gf = this._array('gf');
    const save = this._array('save');
    if (!Number.isInteger(artId) || artId < 1 || !gf || !save || artId >= gf.width || artId >= save.width || save.height <= 19) return null;
    const name = this._at(gf, artId, 1);
    const level = number(this._at(save, artId, 2));
    const tier = number(this._at(gf, artId, 2));
    const rawDifficulty = this._at(gf, artId, 3);
    const difficulty = rawDifficulty === null ? null : numericParameter(rawDifficulty);
    const rawInsight = this._at(save, artId, 19);
    const insight = number(rawInsight);
    if (typeof name !== 'string' || level === null) return null;
    const requiredInsight = level > 0 && difficulty !== null ? formula(this, '功法参悟值', level, rawDifficulty) : null;
    const availableInsight = this._number('参悟');
    const efficiency = this._number('功法参悟效率');
    const comprehension = this._number('总悟性');
    const active = this._flag('功法开关') === true && this._number('功法编号') === artId;
    const reason = blockedReason(this);
    const unavailable = reason || (level < 1 ? '请先从纳戒中的功法书领悟。' : level >= 100 ? '该功法已至满重。' :
      availableInsight === null ? '参悟数据尚未载入。' : availableInsight <= 0 ? '参悟值不足。' : null);
    const details = artEffects.map(([column, text, unit]) => {
      const rawValue = this._at(gf, artId, column);
      // Book tips 1204-1209 round first; detox then divides that number by 100.
      const value = rawValue === null || rawValue === '' ? null : finiteResult(Math.round(rawValue));
      return value === null || value === 0 ? null : entry(text, column === 9 ? value / 100 : value, unit);
    }).filter(Boolean);
    const actions = [];
    if (active) actions.push(action('stop', '停止参悟', reason));
    else actions.push(action('study', '参悟此功法', unavailable));
    actions.push(action('original', '原界面详情', reason));
    return {
      id: artId, name, level, tier, tierLabel: tier === null ? null : label(this, '品阶转换', tier),
      learned: level > 0, cap: 100, insight, requiredInsight,
      // Native detail 2372/2373: strict subtract(raw save cell), clamp, round.
      remainingInsight: requiredInsight === null || rawInsight === null ? null : finiteResult(Math.round(Math.max(0, sourceSubtract(requiredInsight, rawInsight)))),
      availableInsight, monthlyInsightRate: efficiency === null || comprehension === null ? null : finiteResult((efficiency * comprehension) * 100),
      active, details, actions, originalRoute: 'arts', description: null,
      effectText: details.map(item => `${item.label}：${item.value}${item.unit}`).join('\n'),
      reason: active ? reason : unavailable
    };
  };

  proto.getEquipmentSnapshot = function () {
    const equipment = this._array('svzb');
    if (!equipment || equipment.width < 4 || equipment.height < 3) return null;
    return [1, 2, 3].map(slot => {
      const id = number(this._at(equipment, slot, 0, 0));
      const rawQuality = this._at(equipment, slot, 1, 0);
      const quality = rawQuality === null ? null : numericParameter(rawQuality);
      const name = id ? read(this, 'wp', id, 1) : null;
      const category = id ? read(this, 'wp', id, 2) : null;
      const detail = {
        slot, slotName: slots[slot], id, name: typeof name === 'string' ? name : null,
        category, quality, empty: id === 0, details: [], actions: []
      };
      if (category === '法宝') Object.assign(detail, treasureDetails(this, id, quality));
      if (id !== null && id !== 0) detail.actions.push(action('unequip', '卸下', blockedReason(this)));
      return detail;
    });
  };

  proto.performItemAction = async function (inventoryIndex, actionId, options = {}) {
    if (actionId === 'sell') return this.sellItem(inventoryIndex, options.quantity ?? 1);
    const guarded = this._guard();
    if (guarded) return guarded;
    if (this._collectionBusy) return this._fail('正在处理上一项物品操作。');
    const detail = this.getItemDetail(inventoryIndex);
    if (!detail) return this._fail('该物品已不在纳戒中。');
    const selected = detail.actions.find(item => item.id === actionId);
    if (!selected?.enabled) return this._fail(selected?.reason || '该物品尚未接入此操作，请使用原界面。');
    if (actionId === 'original') return { ...this.openOriginal('inventory'), requiresOriginal: true, route: 'inventory' };
    this._collectionBusy = true;
    this.busy = true;
    try {
      if (actionId === 'equip') {
        // Original events 1263-1268 validate realm and map the three equipment types.
        this._call('法宝装备', detail.equipmentSlot, inventoryIndex);
        await this._waitUntil(() => number(read(this, 'svzb', detail.equipmentSlot, 0, 0)) === detail.id &&
          number(read(this, 'svzb', detail.equipmentSlot, 1, 0)) === detail.quality, 3000);
      } else if (actionId === 'learn') {
        // Original 1482-1489 recheck duplicate learning/capacity and consume this exact row.
        this._call('领悟功法', detail.artId, inventoryIndex);
        await this._waitUntil(() => number(read(this, 'save', detail.artId, 2)) > 0, 3000);
      } else if (actionId === 'use' && ['丹药', '灵果'].includes(detail.category)) {
        const consumed = consumptionConfirmation(this, inventoryIndex, detail, 1);
        if (!consumed) throw new Error('物品数据已变化或无法确认扣除，请重新查看纳戒。');
        this._call(detail.category === '丹药' ? '丹药使用' : '灵果食用', inventoryIndex, true, false);
        await this._waitUntil(consumed, 3000);
      } else return this._fail('该操作尚未验证，请使用原界面。');
      return this._result(true, actionId === 'equip' ? '已交由原游戏装备法宝。' : actionId === 'learn' ? '已领悟功法。' : '已使用一枚。');
    } catch (error) {
      return this._fail(error.message || '原游戏未确认完成，请查看原界面。');
    } finally { this._collectionBusy = false; this.busy = false; }
  };

  proto.sellItem = async function (inventoryIndex, quantity, options={}) {
    const guarded = this._guard();
    if (guarded) return guarded;
    if (this._collectionBusy) return this._fail('正在处理上一项物品操作。');
    if (!Number.isSafeInteger(quantity) || quantity < 1) return this._fail('卖出数量须为正整数。');
    const detail = this.getItemDetail(inventoryIndex);
    if (!detail) return this._fail('该物品已不在纳戒中。');
    if(options.expectedItemId!==undefined&&options.expectedItemId!==detail.id ||
       options.expectedUnitPrice!==undefined&&options.expectedUnitPrice!==detail.sellUnitPrice) return this._fail('物品或售价已变化，请重新查看并确认。');
    const selected = detail.actions.find(item => item.id === 'sell');
    if (!selected?.enabled) return this._fail(selected?.reason || '该类物品不能通过此入口卖出。');
    if (quantity > detail.count) return this._fail('卖出数量不能超过当前持有量。');
    if (detail.count - quantity === detail.count) return this._fail('该数量无法被原游戏精确扣除，请在原界面操作。');
    const totalPrice = detail.sellUnitPrice * quantity;
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) return this._fail('原游戏售价不可用。');
    const stonesBefore = this._number('灵石');
    const consumed = consumptionConfirmation(this, inventoryIndex, detail, quantity);
    if (!consumed) return this._fail('物品数据已变化或无法确认扣除，请重新查看纳戒。');
    this._collectionBusy = true;
    this.busy = true;
    try {
      // Original single-item click 1441 and quantity-confirm click 1456 both call
      // 道具出售(row, quantity, 单售文字=true, 出售开关=true). That function
      // prices this exact row, calls 获得资源(...,"灵石",0), then 失去道具.
      // Quantity selection and explicit confirmation belong to the portrait UI.
      this._call('道具出售', inventoryIndex, quantity, true, true);
      await this._waitUntil(consumed, 3000);
      const stonesAfter = this._number('灵石');
      return this._result(true, `已卖出${quantity}枚${detail.name}。`, {
        inventoryIndex, quantity, unitPrice: detail.sellUnitPrice, totalPrice,
        currencyDelta: stonesBefore === null || stonesAfter === null ? null : stonesAfter - stonesBefore
      });
    } catch (error) { return this._fail(error.message || '原游戏未确认卖出完成，请查看纳戒。'); }
    finally { this._collectionBusy = false; this.busy = false; }
  };

  proto.performArtAction = async function (artId, actionId) {
    const guarded = this._guard();
    if (guarded) return guarded;
    const detail = this.getArtDetail(artId);
    if (!detail) return this._fail('该功法数据不可用。');
    const selected = detail.actions.find(item => item.id === actionId);
    if (!selected?.enabled) return this._fail(selected?.reason || '当前不能进行该操作。');
    if (actionId === 'original') {
      const opened = this.openOriginal('arts');
      if (opened.ok && detail.learned) this._call('功法详情显示', artId, 0, 1, 0, 0);
      return { ...opened, requiresOriginal: true, route: 'arts' };
    }
    this._collectionBusy = true;
    this.busy = true;
    try {
      if (actionId === 'study') {
        // Events 2418-2419 retain resource/cap checks; native start stops other activities.
        this._call('开始功法', artId);
        await this._waitUntil(() => this._flag('功法开关') === true && this._number('功法编号') === artId, 3000);
        return this._result(true, `开始参悟${detail.name}。`);
      }
      if (actionId === 'stop') {
        this._call('停止功法');
        return this._result(true, '已停止参悟。');
      }
      return this._fail('该功法操作尚未验证。');
    } catch (error) { return this._fail(error.message); }
    finally { this._collectionBusy = false; this.busy = false; }
  };

  proto.unequipItem = async function (slot) {
    const guarded = this._guard();
    if (guarded) return guarded;
    const reason = blockedReason(this);
    if (reason) return this._fail(reason);
    const detail = this.getEquipmentSnapshot()?.find(item => item.slot === slot);
    if (!detail || detail.empty || !detail.id) return this._fail('该位置没有已装备的法宝。');
    if (this._collectionBusy) return this._fail('正在处理上一项物品操作。');
    this._collectionBusy = true;
    this.busy = true;
    try {
      // Events 1299-1303 return the original item/quality through 获得道具.
      this._call('法宝卸下', slot);
      await this._waitUntil(() => number(read(this, 'svzb', slot, 0, 0)) === 0, 3000);
      return this._result(true, '已卸下法宝并交回纳戒。');
    } catch (error) { return this._fail(error.message); }
    finally { this._collectionBusy = false; this.busy = false; }
  };
})();
