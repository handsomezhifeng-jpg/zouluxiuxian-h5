/* Read the original 商会 stock; transactions are performed only by 购买.
 * Evidence in source/data.json, /project/6/0/1/128/8/16:
 * 6912-6934 floor/category choices; 6966-6997 stock and learned-book guards;
 * 7062-7066 quantity/balance guards; 7074-7077 original purchase function.
 * X4 event 9296 and secondary-menu event 9003 use save[18,18] to unlock 商会.
 * Snapshot/detail methods do not open windows, refresh stock, or write save data.
 */
(() => {
  'use strict';
  const Adapter = window.GameAdapter;
  if (!Adapter) throw new Error('GameAdapter must load before market-adapter.js');
  const proto = Adapter.prototype;
  const categories = ['全部', '草木', '金石', '妖核', '丹药', '法宝', '功法', '配方', '灵兽', '宝材'];
  const floorLabels = ['一楼', '二楼', '三楼', '四楼', '五楼'];
  const attempt = (fn, fallback = null) => { try { return fn() ?? fallback; } catch { return fallback; } };
  const number = value => {
    if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'string' && !value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const text = value => typeof value === 'string' && value !== '' ? value : null;
  const read = (adapter, table, x, y = 0) => adapter._at(adapter._array(table), x, y, 0);
  const label = (adapter, name, ...args) => {
    const value = text(attempt(() => adapter._call(name, ...args)));
    return value?.replace(/\[\/?(?:color|size|b|i|u|s|font|outline|shadow|stroke|background)(?:=[^\]]*)?\]/gi, '') ?? null;
  };

  function state(adapter) {
    const stock = adapter._array('svgw');
    const definitions = adapter._array('wp');
    const save = adapter._array('save');
    const ready = Boolean(stock && stock.width > 1 && stock.height >= 7 && stock.depth > 0 &&
      definitions && definitions.width > 1 && definitions.height >= 9 &&
      save && save.width > 18 && save.height > 18);
    const flag = number(adapter._at(save, 18, 18));
    const unlocked = ready && flag === 1;
    const unlockReason = !ready ? '商会数据尚未完整载入。' : !unlocked ? '请先推进主线剧情解锁商会。' : null;
    return { ready, stock, definitions, save, unlocked, unlockReason,
      level: adapter._number('lv'), spiritStones: adapter._number('灵石') };
  }

  function blockedReason(adapter) {
    if (adapter._layout() !== '主界面') return '请先进入游戏。';
    if (adapter.busy || adapter._marketBusy) return '正在处理上一项操作。';
    if (adapter._blocked()) return '请先完成或关闭原游戏中的对话框。';
    if (adapter._instances('筛选背景').some(instance => adapter._visible(instance))) return '请先关闭原界面的筛选窗口。';
    return null;
  }

  function floorsFor(current) {
    // Original floors require lv >= 31/61/91/121; floor one has no level gate.
    return floorLabels.map((name, index) => {
      const floor = index + 1;
      const minLevel = index === 0 ? null : index * 30 + 1;
      const levelReason = minLevel === null ? null : current.level === null ? '人物境界尚未载入。' :
        current.level < minLevel ? `达到第${minLevel}境界等级后开放。` : null;
      const reason = current.unlockReason || levelReason;
      return { floor, label: name, minLevel, minTier: index * 3 + 1, maxTier: index * 3 + 3,
        unlocked: !reason, reason };
    });
  }

  function selectedFilter(adapter, options = {}) {
    const floor = options.floor ?? adapter._marketFloor ?? 1;
    const category = options.category ?? adapter._marketCategory ?? '全部';
    const valid = Number.isInteger(floor) && floor >= 1 && floor <= 5 && categories.includes(category);
    return { floor, category, valid, reason: valid ? null : '商会楼层或分类无效。' };
  }

  function learnedState(adapter, current, category, subtype, subtableId) {
    let column = null;
    let learnedLabel = null;
    if (category === '功法') { column = 2; learnedLabel = '已领悟'; }
    else if (subtype === '丹方') { column = 13; learnedLabel = '已学会'; }
    else if (subtype === '器方') { column = 15; learnedLabel = '已学会'; }
    if (column === null) return { learned: false, learnedLabel: null, learnedReason: null };
    const value = subtableId === null ? null : number(adapter._at(current.save, subtableId, column));
    if (value === null) return { learned: null, learnedLabel, learnedReason: '该书籍的学习状态尚未载入。' };
    return { learned: value > 0, learnedLabel: value > 0 ? learnedLabel : null,
      learnedReason: value > 0 ? `${learnedLabel}此书，原商会不允许重复购买。` : null };
  }

  function itemFor(adapter, current, floors, listIndex, commonReason = null) {
    if (!current.ready || !Number.isInteger(listIndex) || listIndex < 1 || listIndex >= current.stock.width) return null;
    const id = number(adapter._at(current.stock, listIndex, 0));
    if (!Number.isInteger(id) || id < 1 || id >= current.definitions.width) return null;
    const name = text(adapter._at(current.definitions, id, 1));
    const category = text(adapter._at(current.definitions, id, 2));
    const tier = number(adapter._at(current.definitions, id, 3));
    const subtableId = number(adapter._at(current.definitions, id, 4));
    const subtype = text(adapter._at(current.definitions, id, 7));
    const stock = number(adapter._at(current.stock, listIndex, 1));
    const quality = number(adapter._at(current.stock, listIndex, 2));
    const level = number(adapter._at(current.stock, listIndex, 3));
    const floor = Number.isInteger(tier) ? floors.find(item => tier >= item.minTier && tier <= item.maxTier) : null;
    // Pure source-equivalent query: original 道具单价 mutates global sale discount.
    const unitPrice = typeof adapter.queryItemPrice === 'function' ? adapter.queryItemPrice(listIndex, 'svgw', false) : null;
    const learned = learnedState(adapter, current, category, subtype, subtableId);
    const maxAffordable = current.spiritStones !== null && current.spiritStones >= 0 && unitPrice !== null && unitPrice > 0 ?
      Math.max(0, Math.floor(current.spiritStones / unitPrice)) : null;
    const maxPurchase = stock !== null && maxAffordable !== null ?
      Math.max(0, Math.min(Math.floor(stock), maxAffordable, Number.MAX_SAFE_INTEGER)) : null;
    const reason = commonReason || current.unlockReason || (!name || !category || !floor ? '该货品定义尚未确认。' : null) ||
      floor?.reason || (stock === null ? '库存尚未载入。' : stock <= 0 ? '已售罄。' : null) || learned.learnedReason ||
      (unitPrice === null || unitPrice <= 0 ? '原游戏单价尚未确认。' : null) ||
      (current.spiritStones === null || current.spiritStones < 0 ? '灵石余额尚未载入。' : maxAffordable === 0 ? '灵石不足。' : null);
    return { listIndex, id, name, category, tier, subtableId, subtype, stock, unitPrice, quality, level,
      floor: floor?.floor ?? null, requiredLevel: floor?.minLevel ?? null,
      qualityParameters: [2, 3, 4, 5, 6].map(column => adapter._at(current.stock, listIndex, column)),
      effectLabel: text(adapter._at(current.definitions, id, 8)),
      learned: learned.learned, learnedLabel: learned.learnedLabel,
      maxAffordable, maxPurchase, canPurchase: !reason && maxPurchase !== null && maxPurchase >= 1,
      reason, definitionKnown: Boolean(name && category && floor) };
  }

  proto.getMarketSnapshot = function (options = {}) {
    const current = state(this);
    const floors = floorsFor(current);
    const filter = selectedFilter(this, options);
    const reason = filter.reason || blockedReason(this) || current.unlockReason;
    const items = [];
    if (current.ready && filter.valid) {
      const selectedFloor = floors.find(item => item.floor === filter.floor);
      for (let listIndex = 1; listIndex < current.stock.width; listIndex++) {
        // Filter raw definitions before invoking the native price function. The shop
        // array has 1000 rows, while the portrait view displays only one floor/category.
        const id = number(this._at(current.stock, listIndex, 0));
        if (!Number.isInteger(id) || id < 1 || id >= current.definitions.width) continue;
        const tier = number(this._at(current.definitions, id, 3));
        if (tier === null || tier < selectedFloor.minTier || tier > selectedFloor.maxTier) continue;
        if (filter.category !== '全部' && this._at(current.definitions, id, 2) !== filter.category) continue;
        const item = itemFor(this, current, floors, listIndex, reason);
        if (item && item.floor === filter.floor && (filter.category === '全部' || item.category === filter.category)) items.push(item);
      }
    }
    return { ready: current.ready, unlocked: current.unlocked, unlockReason: current.unlockReason,
      spiritStones: current.spiritStones, level: current.level, floors,
      floor: filter.floor, category: filter.category, categories: [...categories], items,
      filterValid: filter.valid, reason, stockCount: items.length, refreshPolicy: 'original-events-only' };
  };

  proto.getMarketItemDetail = function (listIndex) {
    const current = state(this);
    const item = itemFor(this, current, floorsFor(current), listIndex, blockedReason(this));
    if (!item) return null;
    const details = [];
    const tierLabel = item.tier === null ? null : label(this, '品阶转换', item.tier);
    const qualityName = ['法宝', '丹药'].includes(item.category) && item.quality !== null ? label(this, '品质计算', item.quality) : null;
    let art = null;
    if (item.category === '功法' && typeof this.getArtDetail === 'function' && item.subtableId !== null) {
      art = this.getArtDetail(item.subtableId);
      for (const effect of art?.details ?? []) details.push({ ...effect });
    }
    // wp[:,8] is a complete literal description only for 宝材; most other items use
    // category-specific original tip formulas, so do not advertise it as a computed effect.
    const description = item.category === '宝材' ? item.effectLabel : null;
    return { ...item, tierLabel, qualityName, art, details, description,
      effectText: details.map(entry => `${entry.label}：${entry.value}${entry.unit ?? ''}`).join('\n'),
      actions: [{ id: 'purchase', label: '购买', enabled: item.canPurchase, reason: item.reason }] };
  };

  proto.prepareMarket = function (options = {}) {
    const guarded = this._guard();
    if (guarded) return guarded;
    const snapshot = this.getMarketSnapshot(options);
    if (!snapshot.unlocked) return this._fail(snapshot.unlockReason, { snapshot });
    if (!snapshot.filterValid) return this._fail(snapshot.reason, { snapshot });
    const floor = snapshot.floors.find(item => item.floor === snapshot.floor);
    if (!floor?.unlocked) return this._fail(floor?.reason || '该楼层尚未开放。', { snapshot });
    if (snapshot.reason) return this._fail(snapshot.reason, { snapshot });
    // Selection is portrait view state only. Native stock is initialized/refilled by
    // the original new-game/year events; opening the DOM shop must never refill it.
    this._marketFloor = snapshot.floor;
    this._marketCategory = snapshot.category;
    return this._result(true, '已读取原商会库存。', { snapshot });
  };
  proto.openMarket = function (options = {}) { return this.prepareMarket(options); };
  proto.selectMarketFloor = function (floor, category = this._marketCategory ?? '全部') {
    return this.prepareMarket({ floor, category });
  };

  proto.purchaseItem = async function (listIndex, quantity, options = {}) {
    const guarded = this._guard();
    if (guarded) return guarded;
    if (this._marketBusy) return this._fail('正在处理上一项购买操作。');
    if (!Number.isSafeInteger(quantity) || quantity < 1) return this._fail('购买数量须为正整数。');
    const detail = this.getMarketItemDetail(listIndex);
    if (!detail) return this._fail('该货品已不在原商会清单中。');
    if (!detail.canPurchase) return this._fail(detail.reason || '当前不能购买该货品。');
    if (options.expectedItemId !== undefined && options.expectedItemId !== detail.id ||
        options.expectedUnitPrice !== undefined && options.expectedUnitPrice !== detail.unitPrice) {
      return this._fail('货品或单价已变化，请重新查看并确认。', { detail });
    }
    if (quantity > detail.stock) return this._fail('购买数量不能超过当前库存。', { detail });
    if (quantity > detail.maxPurchase) return this._fail('灵石不足以支付该数量。', { detail });
    if (detail.stock - quantity === detail.stock) return this._fail('该数量无法被原游戏精确扣除，请在原界面操作。');
    const totalPrice = detail.unitPrice * quantity;
    const stonesBefore = this._number('灵石');
    if (!Number.isFinite(totalPrice) || totalPrice <= 0 || stonesBefore === null || stonesBefore < totalPrice ||
        stonesBefore - totalPrice === stonesBefore) return this._fail('原游戏金额无法可靠扣除，请重新确认数量。');
    this._marketBusy = true;
    this.busy = true;
    try {
      // Original 购买 transfers all svgw instance parameters via 获得道具,
      // subtracts 灵石/stock, writes the log and refreshes native inventory/shop UI.
      // Quantity input and user confirmation are supplied by the portrait UI.
      this._call('购买', listIndex, quantity);
      await this._waitUntil(() => number(read(this, 'svgw', listIndex, 0)) === detail.id &&
        number(read(this, 'svgw', listIndex, 1)) === detail.stock - quantity, 3000);
      const stonesAfter = this._number('灵石');
      return this._result(true, `已购买${quantity}份${detail.name}。`, {
        listIndex, id: detail.id, name: detail.name, quantity, unitPrice: detail.unitPrice, totalPrice,
        stockBefore: detail.stock, stockAfter: number(read(this, 'svgw', listIndex, 1)),
        spiritStonesBefore: stonesBefore, spiritStonesAfter: stonesAfter,
        currencyDelta: stonesAfter === null ? null : stonesAfter - stonesBefore
      });
    } catch (error) {
      return this._fail(error.message || '原游戏未确认购买完成，请先查看纳戒与灵石，勿重复提交。',
        { listIndex, id: detail.id, quantity, transactionMayHaveRun: true });
    } finally { this._marketBusy = false; this.busy = false; }
  };
})();
