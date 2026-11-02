/* Shipped Construct spirit array bridge. Load after game-adapter.js.
 * Source data.json: entry 8987; slots 3353-3363; tips 1227-1229;
 * placement guards/function 1458-1469; removal 1471-1476; totals 3373-3397.
 * Only original named functions change gameplay. Snapshots never call functions,
 * roll randomness, merge inventory rows, or assign engine/save/instance variables.
 */
(() => {
  'use strict';
  if (!window.GameAdapter) throw new Error('Spirit adapter requires GameAdapter.');
  const proto = window.GameAdapter.prototype;
  const OBJECTS = { 二级菜单按钮文字: 27, 灵物置物台: 1414, 道具tips按钮文字: 555,
    道具tips背景: 52, 黑幕: 509, 遮挡底板上: 510, 遮挡底板下: 512,
    数字输入背景: 549, 筛选背景: 323, 对话背景: 1512 };
  const ATTRIBUTES = [['energy', '灵气'], ['balefulness', '煞性'], ['sharpness', '锋韧'],
    ['fortitude', '刚体'], ['fortune', '气运']];
  const safe = (fn, fallback = null) => { try { return fn() ?? fallback; } catch { return fallback; } };
  const num = value => {
    if (typeof value !== 'number' && !(typeof value === 'string' && value.trim() !== '')) return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  };
  const parameter = value => {
    const result = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(result) ? result : null;
  };
  // c3runtime generated helpers preserve the left operand for nonnumeric cells.
  // lw has string cells: Number(base) would silently invent different attributes.
  const multiply = (a, b) => typeof a === 'number' && typeof b === 'number' ? a * b : a;
  const divide = (a, b) => typeof a === 'number' && typeof b === 'number' ? a / b : a;
  const enabled = instance => Boolean(safe(() => instance.instVars.开关, false));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const identity = detail => detail ? JSON.stringify([detail.id, ...detail.qualityParameters.map(parameter)]) : null;

  proto._spiritData = function () {
    const tables = Object.fromEntries(['wp', 'lw', 'df', 'lz', 'save', 'svwp', 'svlz']
      .map(name => [name, this._array(name)]));
    const { wp, lw, df, lz, save, svwp, svlz } = tables;
    const ready = Boolean(this._layout() === '主界面' && this._dataReady() &&
      wp?.width >= 628 && wp.height >= 9 && lw?.width >= 125 && lw.height >= 9 &&
      df?.width >= 151 && df.height >= 12 && lz?.width >= 101 && lz.height >= 7 &&
      save?.width >= 15 && save.height >= 19 && svwp?.height >= 14 &&
      svlz?.width >= 26 && svlz.height >= 7 &&
      Object.values(tables).every(table => table && table.depth >= 1));
    const level = this._number('灵阵等级');
    const rawCapacity = ready && Number.isInteger(level) ? this._at(df, level, 11) : null;
    // Original renderer is a 5x5 grid, even though svlz reserves 51 rows.
    const cap = num(rawCapacity);
    const capacity = Number.isInteger(cap) && cap >= 0 && cap <= 25 ? cap : null;
    return { ...tables, ready, level, rawCapacity, capacity };
  };

  proto._spiritCommitted = function (name) {
    // Public getAllInstances includes pending creates. Source SOL reads committed
    // instances (c3runtime:1610,2841,3230); wait for the exact new UID below.
    const cls = safe(() => this._engine().GetObjectClassByIndex(OBJECTS[name]));
    if (safe(() => cls.GetName()) === name) return safe(() => cls.GetInstances()
      .map(instance => instance.GetInterfaceClass()), []);
    return safe(() => this.runtime.objects[name].getPickedInstances(), []);
  };

  proto._spiritCovered = function (button, blockers) {
    const x = num(safe(() => button.x)), y = num(safe(() => button.y));
    if (x === null || y === null) return true;
    const css = safe(() => button.layer.layerToCssPx(x, y));
    // Touch.IsTouchingObject checks interactivity/viewport, including invisible
    // hitboxes. Test the button centre in each blocker's own layer coordinates.
    return blockers.some(name => this._spiritCommitted(name).some(instance => {
      if (safe(() => instance.layer.isSelfAndParentsInteractive, true) === false) return false;
      const box = safe(() => instance.getBoundingBox()), viewport = safe(() => instance.layer.getViewport());
      if (!box || viewport && (box.right <= viewport.left || box.left >= viewport.right ||
          box.bottom <= viewport.top || box.top >= viewport.bottom)) return false;
      const point = css ? safe(() => instance.layer.cssPxToLayer(...css)) : null;
      const [px, py] = point ?? [x, y];
      return px >= box.left && px <= box.right && py >= box.top && py <= box.bottom;
    }));
  };

  proto._spiritModal = function () {
    return this._blocked() || ['筛选背景', '对话背景'].some(name =>
      this._instances(name).some(instance => this._visible(instance)));
  };

  proto._spiritReason = function (ownOperation = false) {
    const data = this._spiritData();
    if (this._layout() !== '主界面' || !data.ready) return '原灵阵数据尚未载入。';
    // Menu 8987 requires ==1; placement 1460 additionally requires >0.
    if (num(this._at(data.save, 14, 18)) !== 1) return '请先完成洞府主线教学，解锁灵物系统。';
    if (data.capacity === null) return '原灵阵容量尚未确定，暂不能操作槽位。';
    if (this._spiritModal()) return '请先完成或关闭原游戏中的对话框或筛选窗口。';
    if (!ownOperation && (this.busy || this._spiritBusy)) return '正在处理上一项操作。';
    return null;
  };

  proto._spiritDetail = function (table, row, location = 'inventory') {
    if (!Number.isInteger(row) || row < 1 || !table || row >= table.width) return null;
    const { wp, lw } = this._spiritData();
    const id = num(this._at(table, row, 0)), count = num(this._at(table, row, 1));
    if (!Number.isInteger(id) || id <= 0 || count === null || count <= 0 ||
        this._at(wp, id, 2) !== '灵物') return null;
    const subtableId = num(this._at(wp, id, 4));
    const qualityParameters = [2, 3, 4, 5, 6].map(column => this._at(table, row, column));
    const attributeDetails = ATTRIBUTES.map(([key, name], index) => {
      const qualityPercent = parameter(qualityParameters[index]);
      const base = subtableId === null ? null : this._at(lw, subtableId, index + 3);
      const value = qualityPercent === null || base === null ? null : multiply(qualityPercent / 100, base);
      return { key, name, qualityPercent, base, value: num(value) };
    });
    const allCells = [];
    for (let y = 0; y < table.height; y++) for (let z = 0; z < table.depth; z++) allCells.push(this._at(table, row, y, z));
    const qualities = qualityParameters.map(parameter);
    const known = qualities.every(value => value !== null) && attributeDetails.every(item => item.value !== null);
    return { row, inventoryIndex: location === 'inventory' ? row : null, slot: location === 'slot' ? row : null,
      location, id, name: this._at(wp, id, 1), count, tier: num(this._at(wp, id, 3)),
      category: '灵物', kind: this._at(lw, subtableId, 8), subtableId,
      instance: JSON.stringify(allCells), qualityParameters,
      quality: qualities.every(value => value !== null) ? Math.round(qualities.reduce((a, b) => a + b, 0) / 5) : null,
      attributes: Object.fromEntries(attributeDetails.map(item => [item.key, item.value])),
      attributeDetails, known, lockFlag: this._at(table, row, 7),
      canEquip: location === 'inventory' && known && !this._spiritReason(), reason: known ? this._spiritReason() : '原灵物品质或属性数据尚未确定。' };
  };

  proto.getSpiritItemDetail = function (row) {
    const data = this._spiritData();
    return data.ready ? this._spiritDetail(data.svwp, row) : null;
  };

  proto.getSpiritSnapshot = function () {
    const data = this._spiritData(), { ready, level, rawCapacity, capacity, save, svwp, svlz, df, lw, wp, lz } = data;
    const flag = ready ? num(this._at(save, 14, 18)) : null;
    const unlocked = flag === null ? null : flag === 1;
    const unlockReason = !ready ? '原灵阵数据尚未载入。' : unlocked ? null : '请先完成洞府主线教学，解锁灵物系统。';
    const reason = this._spiritReason(), inventory = [];
    if (ready) for (let row = 1; row < svwp.width; row++) {
      const item = this._spiritDetail(svwp, row);
      if (item) inventory.push(item);
    }
    const slots = Array.from({ length: 25 }, (_, index) => {
      const slot = index + 1, available = unlocked === true && capacity !== null && slot <= capacity;
      const rawId = ready ? num(this._at(svlz, slot, 0)) : null;
      const item = ready && rawId > 0 ? this._spiritDetail(svlz, slot, 'slot') : null;
      let requiredArrayLevel = null;
      if (ready) for (let l = 1; l < df.width; l++) {
        if (num(this._at(df, l, 11)) >= slot) { requiredArrayLevel = l; break; }
      }
      const recoveryReason = rawId > 0 && this._flag('自动出售开关') === true ?
        '请先在原界面关闭自动出售，再回收或替换灵物。' : null;
      const slotReason = reason || (!available ? `此槽位尚未开放${requiredArrayLevel === null ? '' : `，需要灵阵等级${requiredArrayLevel}`}。` : null) || recoveryReason;
      return { slot, unlocked: available, empty: rawId === null ? null : rawId === 0, item,
        canEquip: !slotReason && inventory.some(entry => entry.known),
        canUnequip: !slotReason && Boolean(item?.known),
        reason: slotReason, recoveryReason, requiredArrayLevel };
    });
    const totals = Object.fromEntries(ATTRIBUTES.map(([key]) => [key, null]));
    const attributeLevels = { ...totals };
    if (ready && capacity !== null) ATTRIBUTES.forEach(([key], index) => {
      let sum = 0;
      for (let slot = 1; slot <= capacity; slot++) {
        const id = num(this._at(svlz, slot, 0));
        // Native totals do not filter item ID; wp/lw row 0 are numeric zeroes.
        const subId = num(this._at(wp, id, 4));
        const quality = this._at(svlz, slot, index + 2);
        const base = this._at(lw, subId, index + 3);
        const contribution = parameter(multiply(divide(quality, 100), base));
        if (quality === null || base === null || contribution === null) { sum = null; break; }
        sum += contribution; // original AddVar coerces via parseFloat.
      }
      totals[key] = sum === null ? null : Math.round(sum);
      if (sum !== null) {
        let found = 0;
        for (let row = 0; row < lz.width; row++) {
          const threshold = this._at(lz, row, 1);
          if (typeof threshold === 'number' && totals[key] >= threshold) found = row;
        }
        attributeLevels[key] = Math.max(0, Math.min(100, Math.round(found)));
      }
    });
    const bonus = (key, column, divisor = 1) => attributeLevels[key] === null ? null :
      num(this._at(lz, attributeLevels[key], column)) === null ? null : num(this._at(lz, attributeLevels[key], column)) / divisor;
    return { ready, unlocked, unlockFlag: flag, unlockReason, arrayLevel: level, rawCapacity, capacity,
      maxSlots: 25, selectedSlot: this._number('选中置物台编号'), slots, inventory, totals, attributeLevels,
      bonuses: { caveEnergy: bonus('energy', 2), realmBreakReductionPercent: bonus('balefulness', 3, 100),
        realmAttackPercent: bonus('sharpness', 4, 100), realmDefensePercent: bonus('fortitude', 5, 100), resourcePercent: bonus('fortune', 6) },
      canEquip: !reason && inventory.some(item => item.known) && capacity > 0, reason,
      blocked: this._spiritModal(), busy: Boolean(this.busy || this._spiritBusy),
      messages: [], originalControls: ['灵阵建筑升级'] };
  };

  proto._spiritSlot = function (slot) {
    return this._spiritCommitted('灵物置物台').find(instance => this._visible(instance) &&
      num(safe(() => instance.instVars.编号)) === slot && safe(() => instance.instVars.用途) === '置物台') ?? null;
  };

  proto._spiritWaitCreated = async function (name, previous, predicate, timeout = 2200) {
    // Original open 3347 resumes after WaitForPreviousActions before it creates
    // slots. The _call return is not evidence that pending instances exist yet.
    // Wait for a new matching UID to actually appear AND enter source SOL.
    let created = null;
    await this._waitUntil(() => {
      created = this._spiritCommitted(name).find(instance => !previous.has(instance.uid) &&
        predicate(instance) && this._visible(instance)) ?? null;
      return Boolean(created);
    }, timeout);
    return created;
  };

  proto._spiritEnsurePage = async function () {
    if (this._global('主页界面') === '灵物' && this._spiritSlot(1)) return null;
    const entry = () => this._spiritCommitted('二级菜单按钮文字').find(instance => this._visible(instance) &&
      safe(() => instance.text) === '灵物' && safe(() => instance.instVars.功能) === '灵物');
    if (!entry()) {
      this._call('打开修炼二级菜单');
      await this._waitUntil(() => Boolean(entry()), 1500);
    }
    if (!enabled(entry()) || this._spiritCovered(entry(), ['黑幕'])) return this._fail('原灵物入口按钮暂不可用。');
    if (this._spiritReason(true)) return this._fail(this._spiritReason(true));
    const previous = new Set(this._instances('灵物置物台').map(instance => instance.uid));
    this._call('打开灵物系统', 1, 0, 0);
    await this._spiritWaitCreated('灵物置物台', previous, instance =>
      num(safe(() => instance.instVars.编号)) === 1 && safe(() => instance.instVars.用途) === '置物台');
    return null;
  };

  proto._spiritPrepareSlot = async function (slot) {
    this._call('关闭物品tips');
    await this._waitUntil(() => this._spiritCommitted('道具tips背景').length === 0 &&
      this._spiritCommitted('道具tips按钮文字').length === 0, 1500);
    const card = this._spiritSlot(slot);
    if (!card || this._spiritCovered(card, ['遮挡底板上', '遮挡底板下', '数字输入背景', '对话背景', '黑幕'])) {
      return this._fail('原灵阵槽位尚未显示或被遮挡。');
    }
    // Original refresh owns selection/highlighting, no direct global write.
    const previous = new Set(this._instances('灵物置物台').map(instance => instance.uid));
    this._call('刷新灵阵物品', 0, 0, 0, 2, slot);
    const created = await this._spiritWaitCreated('灵物置物台', previous, instance =>
      num(safe(() => instance.instVars.编号)) === slot && safe(() => instance.instVars.用途) === '置物台');
    await this._waitUntil(() => safe(() => this._spiritSlot(slot).uid) === created.uid &&
      this._number('选中置物台编号') === slot, 1500);
    return null;
  };

  proto._spiritPrepareTip = async function (detail, removing) {
    const source = this._array(removing ? 'svlz' : 'svwp');
    const viewport = safe(() => this.runtime.layout.getLayer(19).getViewport());
    const width = num(viewport?.width), height = num(viewport?.height);
    if (width === null || height === null || height < 400) return this._fail('原游戏视口尚未准备完成。');
    // All 21 parameters of the original tips constructor, including extra qualities.
    const previous = new Set(this._instances('道具tips按钮文字').map(instance => instance.uid));
    this._call('道具tips建立', viewport.left + width / 2 - 80, viewport.top + height / 2 - 150, detail.row,
      removing ? '置物台' : '纳戒', 0, 0, ...detail.qualityParameters,
      detail.count, detail.id, removing ? 4 : 5,
      ...[8, 9, 10, 11, 12, 13].map(column => this._at(source, detail.row, column) ?? 0), 0);
    const text = removing ? '取下' : '放置';
    const button = await this._spiritWaitCreated('道具tips按钮文字', previous, instance =>
      safe(() => instance.text) === text && num(safe(() => instance.instVars.道具序号)) === detail.row);
    if (!button || !this._visible(button) || !enabled(button) ||
        this._spiritCovered(button, ['遮挡底板上', '数字输入背景', '黑幕', '筛选背景'])) {
      return this._fail('原灵物操作按钮尚不可用或被遮挡。');
    }
    return null;
  };

  proto._spiritInventoryCounts = function () {
    const held = this._array('svwp'), counts = new Map();
    if (!held) return null;
    for (let row = 1; row < held.width; row++) {
      const detail = this._spiritDetail(held, row);
      if (!detail) continue;
      if (!detail.known || !Number.isInteger(detail.count)) return null;
      const key = identity(detail);
      counts.set(key, (counts.get(key) || 0) + detail.count);
    }
    return counts;
  };

  proto._runSpiritAction = async function (mode, slot, row, options = {}) {
    const guard = this._guard();
    if (guard) return guard;
    const reason = this._spiritReason();
    if (reason) return this._fail(reason);
    const before = this.getSpiritSnapshot();
    if (mode !== 'open' && (!Number.isInteger(slot) || !before.slots[slot - 1]?.unlocked)) return this._fail('该灵阵槽位尚未开放。');
    const removing = mode === 'unequip';
    const incoming = mode === 'equip' ? this.getSpiritItemDetail(row) : null;
    const oldItem = mode === 'open' ? null : before.slots[slot - 1].item;
    if (mode !== 'open' && before.slots[slot - 1].empty !== true && !oldItem?.known) return this._fail('原槽位物品尚未确定，请在原界面检查。');
    // 获得道具 1097 can run 自动出售 before the caller continues. Do not change
    // that player strategy or let an automatic deletion invalidate the source row.
    if (oldItem && this._flag('自动出售开关') === true) return this._fail('请先在原界面关闭自动出售，再回收或替换灵物。', { requiresOriginal: true });
    if (mode === 'equip') {
      if (!incoming?.known) return this._fail('该物品行不是可放置的原灵物。');
      if (options.expectedItemId !== undefined && incoming.id !== options.expectedItemId ||
          options.expectedInstance !== undefined && incoming.instance !== options.expectedInstance ||
          options.instance !== undefined && incoming.instance !== options.instance) return this._fail('纳戒物品已经变化，请重新选择这件灵物。');
    }
    if (removing && !oldItem?.known) return this._fail('该槽位没有可取下的原灵物。');
    this._spiritBusy = true;
    this.busy = true;
    let createdTips = false;
    try {
      const opened = await this._spiritEnsurePage();
      if (opened) return opened;
      if (mode === 'open') return this._result(true, '已打开原游戏灵物界面。');
      const prepared = await this._spiritPrepareSlot(slot);
      if (prepared) return prepared;
      const detail = removing ? oldItem : incoming;
      createdTips = true;
      const tip = await this._spiritPrepareTip(detail, removing);
      if (tip) return tip;
      const finalReason = this._spiritReason(true);
      if (finalReason) return this._fail(finalReason);
      if (this._number('选中置物台编号') !== slot || !this._spiritSlot(slot)) return this._fail('原选中槽位已经变化，请重试。');
      const current = removing ? this._spiritDetail(this._array('svlz'), slot, 'slot') : this.getSpiritItemDetail(row);
      if (!current || current.instance !== detail.instance || current.id !== detail.id) return this._fail('灵物实例已经变化，请重新选择。');
      const currentOld = this._spiritDetail(this._array('svlz'), slot, 'slot');
      if (oldItem ? !currentOld || currentOld.instance !== oldItem.instance :
          num(this._at(this._array('svlz'), slot, 0)) !== 0) return this._fail('原槽位物品已经变化，请重新查看。');
      if (oldItem && this._flag('自动出售开关') === true) return this._fail('自动出售已开启，请先在原界面关闭后再回收灵物。');
      if (!this.getSpiritSnapshot().slots[slot - 1]?.unlocked) return this._fail('该灵阵槽位已不可用。');
      const expectedCounts = this._spiritInventoryCounts();
      if (!expectedCounts) return this._fail('原纳戒灵物数量尚未确定。');
      const adjust = (item, delta) => { const key = identity(item); expectedCounts.set(key, (expectedCounts.get(key) || 0) + delta); };
      if (incoming) adjust(incoming, -1);
      if (oldItem) adjust(oldItem, 1);
      this._call(removing ? '灵物卸下' : '灵物更换', slot, removing ? slot : row);
      // Count signatures verify the actual instance transfer, including deletion
      // of the final inventory row and native return of a replaced spirit.
      await this._waitUntil(() => {
        const equipped = this._spiritDetail(this._array('svlz'), slot, 'slot');
        if (removing ? num(this._at(this._array('svlz'), slot, 0)) !== 0 :
            !equipped || equipped.id !== incoming.id || !same(equipped.qualityParameters, incoming.qualityParameters)) return false;
        const counts = this._spiritInventoryCounts();
        return counts && [...new Set([...counts.keys(), ...expectedCounts.keys()])].every(key =>
          (counts.get(key) || 0) === (expectedCounts.get(key) || 0));
      }, 2200);
      return this._result(true, removing ? '已按原游戏规则取下灵物。' : '已按原游戏规则放置灵物。',
        { slot, itemId: detail.id, snapshot: this.getSpiritSnapshot() });
    } catch (error) {
      return this._fail(error?.message || '原灵物操作尚未完成，请稍后查看。');
    } finally {
      if (createdTips) safe(() => this._call('关闭物品tips'));
      this._spiritBusy = false;
      this.busy = false;
    }
  };
  proto.openSpirits = function () { return this._runSpiritAction('open'); };
  proto.equipSpirit = function (slot, row, options = {}) { return this._runSpiritAction('equip', slot, row, options); };
  proto.unequipSpirit = function (slot) { return this._runSpiritAction('unequip', slot); };
})();
