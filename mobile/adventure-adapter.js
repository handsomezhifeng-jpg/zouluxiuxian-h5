/* Real Construct adventure view/controller. Load after game-adapter.js.
 * Sources: data.json /project/6/0/1/128/8/5 (events 2467-2622),
 * /project/6/0/1/129/8/4/8/0/8/2 (event 8999: save[6,18] entry unlock).
 * This file never assigns globalVars, instance variables, or array cells.
 */
(() => {
  'use strict';
  if (!window.GameAdapter) throw new Error('Adventure adapter requires GameAdapter.');
  const proto = window.GameAdapter.prototype;
  const ENEMY_QI_SID = 441198026611266;
  // Region names and thresholds are read from original map creation events 2473-2485.
  const REGIONS = [
    { id: 1, name: '凡界', requiredLevel: null, object: '地图世界人界' },
    { id: 2, name: '灵界', requiredLevel: 31, object: '地图世界灵界' },
    { id: 3, name: '玄界', requiredLevel: 61, object: '地图世界玄界' },
    { id: 4, name: '仙界', requiredLevel: 91, object: '地图世界仙界' },
    { id: 5, name: '神界', requiredLevel: 121, object: '地图世界神界' }
  ];
  const safe = (fn, fallback = null) => { try { return fn() ?? fallback; } catch { return fallback; } };
  const num = value => {
    if (typeof value !== 'number' && !(typeof value === 'string' && value.trim() !== '')) return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  };
  const plain = text => typeof text === 'string' ? text.replace(/\[\/?(?:color|size|b|i|u)(?:=[^\]]*)?\]/gi, '') : null;
  const visible = instance => instance && safe(() => instance.isVisible, false) === true &&
    safe(() => instance.layer.isSelfAndParentsVisible, true) !== false;
  const enabled = instance => {
    const value = safe(() => instance.instVars.开关);
    return value !== null && Boolean(value);
  };

  proto._adventureData = function () {
    const ll = this._array('ll');
    const save = this._array('save');
    const ready = Boolean(this._layout() === '主界面' && this._dataReady() && ll && ll.width > 1 &&
      ll.height >= 12 && save && save.height >= 30);
    return { ll, save, ready };
  };

  proto._adventureEntryUnlocked = function () {
    // Original secondary-menu event 8999, not a fabricated character-level shortcut.
    return num(this._at(this._array('save'), 6, 18)) === 1;
  };

  proto._adventureRegionUnlocked = function (id) {
    const region = REGIONS.find(item => item.id === id);
    if (!region) return false;
    const level = this._number('lv');
    return region.requiredLevel === null || (level !== null && level >= region.requiredLevel);
  };

  proto._adventureGuard = function () {
    const guard = this._guard();
    if (guard) return guard;
    if (!this._adventureData().ready) return this._fail('历练数据尚未载入。');
    if (!this._adventureEntryUnlocked()) return this._fail('请先完成原游戏主线，解锁历练。');
    return null;
  };

  proto._adventureEnsureEntry = function () {
    const findEntry = () => this._instances('二级菜单按钮文字').find(instance => visible(instance) &&
      (safe(() => instance.instVars.功能) === '历练' || safe(() => instance.text) === '历练'));
    let button = findEntry();
    if (!button) {
      // Original navigation creates the appropriate unlocked/locked secondary-menu buttons.
      this._call('打开历练二级菜单');
      button = findEntry();
    }
    if (!button || !enabled(button)) return this._fail('原游戏中的历练入口暂不可用。');
    return null;
  };

  proto._adventureCard = function (enemyId) {
    // 历练选项背景: instVars 敌人编号 / 开关 / 解锁, verified object class 831.
    return this._instances('历练选项背景').find(instance => visible(instance) &&
      num(safe(() => instance.instVars.敌人编号)) === enemyId) ?? null;
  };

  proto._adventureEnsureMap = function (regionId, force = false) {
    const region = REGIONS.find(item => item.id === regionId);
    if (!region || !this._adventureRegionUnlocked(regionId)) return this._fail('当前境界尚未解锁该界域。');
    const entry = this._adventureEnsureEntry();
    if (entry) return entry;
    const ll = this._array('ll');
    const existing = this._instances('历练选项背景').some(instance => visible(instance) &&
      num(this._at(ll, num(safe(() => instance.instVars.敌人编号)), 3)) === regionId);
    if (force || !existing) {
      // Original region-selection sequence: overview refreshes its own 解锁 flags, then opens a map.
      this._call('打开历练系统', 1);
      const mapButton = this._instances(region.object).find(instance => visible(instance));
      if (!mapButton || !enabled(mapButton) || num(safe(() => mapButton.instVars.解锁)) !== 1) {
        return this._fail('原游戏中的界域入口暂不可用。');
      }
      this._call('打开历练地图', 1, regionId, 0, 0);
    }
    this._adventureRegionId = regionId; // Presentation selection only; no original game state is changed.
    return null;
  };

  proto._adventureLogs = function () {
    // Original event 427 queues text in 信息缓存; events 428-433 create 记录文字 objects.
    // UID and the original text identify actual messages; this bridge invents no reward events.
    return this._instances('记录文字')
      .map(instance => ({ id: safe(() => instance.uid), rawText: safe(() => instance.text), y: num(safe(() => instance.y)) }))
      .filter(entry => typeof entry.rawText === 'string' && /战胜|历练战斗失败|获得灵物|没有发现该妖兽/.test(entry.rawText))
      .sort((a, b) => (b.y ?? 0) - (a.y ?? 0))
      .slice(0, 12)
      .map(({ id, rawText }) => ({ id, text: plain(rawText), rawText }));
  };

  proto.getAdventureSnapshot = function () {
    const { ll, save, ready } = this._adventureData();
    const unlocked = ready ? this._adventureEntryUnlocked() : null;
    const active = this._flag('历练开关');
    const activeEnemyId = this._number('敌人编号');
    const blocked = this._blocked();
    const ownLevel = this._number('lv');
    const dj = this._array('dj');
    const regions = REGIONS.map(region => ({
      id: region.id, name: region.name, requiredLevel: region.requiredLevel,
      requiredRealm: region.requiredLevel === null ? null : this._at(dj, region.requiredLevel, 1),
      unlocked: ownLevel === null && region.requiredLevel !== null ? null : this._adventureRegionUnlocked(region.id)
    }));
    const activeRegion = activeEnemyId !== null && activeEnemyId > 0 ? num(this._at(ll, activeEnemyId, 3)) : null;
    const selectedRegion = REGIONS.some(item => item.id === this._adventureRegionId) ? this._adventureRegionId : (activeRegion ?? 1);
    const enemies = [];
    const readEnemy = id => {
      const regionId = num(this._at(ll, id, 3));
      const revealFlag = num(this._at(save, id, 3));
      const known = id === this._adventureStageTarget ? true : revealFlag === null ? null : revealFlag !== 0;
      const evolutionLevel = known ? num(this._at(save, id, 28)) : null;
      const storedName = known ? this._at(ll, id, 1) : null;
      const label = evolutionLevel === null ? null : plain(safe(() => this._call('历练兽等级转换', evolutionLevel)));
      const enemyStats = {
        qi: known ? this._formula('历练敌人真气', id) : null,
        attack: known ? this._formula('历练敌人攻击', id) : null,
        defense: known ? this._formula('历练敌人防御', id, false) : null
      };
      const zy = this._array('zy');
      const lw = this._array('lw');
      const nuclei = [];
      if (known && regionId !== null) {
        for (let outcome = 1; outcome <= 3; outcome++) {
          nuclei.push({
            name: this._at(zy, (regionId - 1) * 3 + outcome, 3),
            // Event 2564 feeds these values to AdvancedRandom; they are raw weights, not invented percentages.
            weight: num(this._at(ll, id, 7 + outcome))
          });
        }
      }
      return {
        id, regionId, known, artId: known ? num(this._at(ll, id, 2)) : null,
        name: known && typeof storedName === 'string' ? storedName : known === false ? '未知妖兽' : null,
        unlocked: known === true && this._adventureRegionUnlocked(regionId),
        selectable: ready && unlocked === true && known === true && this._adventureRegionUnlocked(regionId) && !blocked && !this.busy,
        stats: enemyStats,
        evolution: {
          level: evolutionLevel, label,
          kills: known ? num(this._at(save, id, 29)) : null,
          required: evolutionLevel === null ? null : this._formula('历练进化值', evolutionLevel)
        },
        kills: known ? num(this._at(save, id, 4)) : null,
        drops: known ? {
          nuclei,
          spiritItem: this._at(lw, id, 1),
          insightBase: num(this._at(ll, id, 7)),
          quantity: null, probability: null,
          note: '掉落数量、参悟奖励与灵物概率由原游戏按进化、机缘和掉落加成结算。'
        } : null
      };
    };
    if (ready) {
      for (let id = 1; id < ll.width; id++) {
        if (num(this._at(ll, id, 3)) === selectedRegion) enemies.push(readEnemy(id));
      }
    }
    const hintedEnemyId = Number.isInteger(this._adventureSelectedEnemyId) ? this._adventureSelectedEnemyId : null;
    const selectedEnemy = enemies.some(enemy => enemy.id === hintedEnemyId) ? hintedEnemyId :
      enemies.some(enemy => enemy.id === activeEnemyId) ? activeEnemyId : enemies.find(enemy => enemy.known)?.id ?? null;
    const selected = enemies.find(enemy => enemy.id === selectedEnemy) ?? null;
    const current = ready && activeEnemyId !== null && activeEnemyId > 0 && activeEnemyId < ll.width ?
      enemies.find(enemy => enemy.id === activeEnemyId) ?? readEnemy(activeEnemyId) : null;
    const rawEnemyQi = num(this._local(ENEMY_QI_SID));
    const messages = this._adventureLogs();
    return {
      ready, unlocked, unlockFlag: ready ? num(this._at(save, 6, 18)) : null,
      unlockHint: '完成原游戏历练主线教学后开启。', selectedRegion, selectedEnemy,
      regions, enemies,
      battle: {
        active, enemyId: activeEnemyId, name: active === true ? current?.name ?? null : null,
        regionId: active === true ? current?.regionId ?? null : null,
        artId: active === true ? current?.artId ?? null : null,
        enemyQi: active === true && rawEnemyQi !== null ? Math.max(0, rawEnemyQi) : null,
        rawEnemyQi, maxEnemyQi: active === true ? current?.stats.qi ?? null : null,
        attack: active === true ? current?.stats.attack ?? null : null,
        defense: active === true ? current?.stats.defense ?? null : null,
        playerQi: this._number('真气'), maxPlayerQi: this._number('真气上限'),
        playerAttack: this._number('攻击'), playerDefense: this._number('防御'),
        kills: current?.kills ?? null,
        evolutionKills:current?.evolution.kills ?? null,evolutionRequired:current?.evolution.required ?? null,
        repeating: active === null ? null : active,
        lastRewards: null // No inferred inventory delta or simulated drop is presented as an actual reward.
      },
      canStart: Boolean(ready && unlocked && selected?.selectable && !(active === true && selectedEnemy === activeEnemyId)),
      blocked, busy: Boolean(this.busy), paused: this._flag('游戏暂停'),
      messages, logs: messages.map(entry => entry.text)
    };
  };

  proto.openAdventure = function () {
    const guard = this._adventureGuard();
    if (guard) return guard;
    try {
      const entry = this._adventureEnsureEntry();
      if (entry) return entry;
      this._call('打开历练系统', 1);
      this._adventureRegionId = null;
      return this._result(true, '已打开原游戏历练界域。');
    } catch (error) { return this._fail(error.message); }
  };

  proto.selectRegion = function (regionId) {
    const guard = this._adventureGuard();
    if (guard) return guard;
    if (!Number.isInteger(regionId) || !REGIONS.some(region => region.id === regionId)) return this._fail('请选择有效界域。');
    try {
      const result = this._adventureEnsureMap(regionId, true);
      if (result) return result;
      const priorRegion = num(this._at(this._array('ll'), this._adventureSelectedEnemyId, 3));
      if (priorRegion !== regionId) this._adventureSelectedEnemyId = null;
      return this._result(true, `已进入${REGIONS.find(region => region.id === regionId).name}。`, { regionId });
    } catch (error) { return this._fail(error.message); }
  };

  proto.selectEnemy = function (enemyId) {
    const guard = this._adventureGuard();
    if (guard) return guard;
    const { ll, save } = this._adventureData();
    if (!Number.isInteger(enemyId) || enemyId < 1 || enemyId >= ll.width) return this._fail('请选择有效妖兽。');
    const reveal = num(this._at(save, enemyId, 3));
    if (reveal === null || reveal === 0) return this._fail('没有发现该妖兽的踪迹。');
    const regionId = num(this._at(ll, enemyId, 3));
    try {
      const map = this._adventureEnsureMap(regionId);
      if (map) return map;
      const card = this._adventureCard(enemyId);
      if (!card || !enabled(card) || num(safe(() => card.instVars.解锁)) !== 1) return this._fail('原游戏中的妖兽选项暂不可用。');
      // The original card starts combat immediately. This separate preview is UI state only.
      this._adventureSelectedEnemyId = enemyId;
      return this._result(true, '已选中历练目标。', { enemyId, regionId });
    } catch (error) { return this._fail(error.message); }
  };

  proto.startBattle = function (enemyId) {
    const target = enemyId ?? this.getAdventureSnapshot().selectedEnemy;
    const selected = this.selectEnemy(target);
    if (!selected.ok) return selected;
    if (this._flag('历练开关') === true && this._number('敌人编号') === target) return this._result(true, '正在持续历练该妖兽。');
    try {
      // Event 2534 performs all original state changes and 停止所有行为 itself.
      this._call('开始历练', target);
      return this._result(true, '已开始原游戏持续历练。战胜后会继续挑战同一妖兽。', { enemyId: target });
    } catch (error) { return this._fail(error.message); }
  };

  proto.stopBattle = function () {
    const guard = this._adventureGuard();
    if (guard) return guard;
    if (this._flag('历练开关') !== true) return this._result(true, '当前没有进行中的历练战斗。');
    const enemyId = this._number('敌人编号');
    const regionId = num(this._at(this._array('ll'), enemyId, 3));
    try {
      const map = this._adventureEnsureMap(regionId);
      if (map) return map;
      const card = this._adventureCard(enemyId);
      if (!card || !enabled(card)) return this._fail('原游戏中的停止历练选项暂不可用。');
      this._call('停止历练');
      return this._result(true, '已停止历练战斗。');
    } catch (error) { return this._fail(error.message); }
  };
})();
