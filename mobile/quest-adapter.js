/* Read-only main-quest projection. Load after game-adapter.js.
 * Source data.json:
 * /project/6/0/1/127/8/9/8/10/8/0/8/0: 任务存在检测 scans svrw[x,0].
 * /project/6/0/1/127/8/9/8/2/8/0: native list filters rw[id,2] == 主线任务.
 * /project/6/0/1/127/8/9/8/4/8/0: native objective/description text (1714-1745).
 * /project/6/0/1/129/8/9/8/2: actual automatic completion conditions (9146-9214).
 * No callFunction calls, setters, timer advancement, task claiming, or event dispatch.
 */
(() => {
  'use strict';
  if (!window.GameAdapter) throw new Error('Quest adapter requires GameAdapter.');
  const proto = window.GameAdapter.prototype;
  const num = value => {
    if (typeof value !== 'number' && !(typeof value === 'string' && value.trim() !== '')) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const plain = value => typeof value === 'string' ? value.replace(/\[\/?(?:color|size|b|i|u|s|font|outline|shadow|stroke|background)(?:=[^\]]*)?\]/gi, '') : null;
  const FLAGS = {
    arts: [1, '功法'], realm: [2, '渡劫'], capture: [4, '捕兽'], adventure: [6, '历练'],
    herbs: [7, '草木'], mining: [8, '金石'], alchemy: [9, '炼丹'], smithing: [10, '炼器'],
    beastTraining: [11, '驭兽'], challenge: [15, '挑战'], inventory: [17, '纳戒'], market: [18, '商会'],
    cave: [3, '洞府'], spirits: [14, '灵阵'], reincarnation: [16, '转世'], abyss: [5, '深渊']
  };
  // These transitions are explicit save.SetXY(row,18,1) actions in original X2-X13.
  // They describe future unlocks; a met objective alone never changes the reported flag.
  const NEXT_UNLOCKS = {
    311: ['adventure'], 312: ['inventory'], 313: ['market'], 314: ['arts'],
    315: ['realm', 'herbs', 'mining'], 316: ['alchemy'], 317: ['smithing'],
    320: ['capture'], 321: ['beastTraining'], 322: ['challenge'],
    323: ['cave'], 324: ['spirits'], 326: ['reincarnation']
  };
  const TARGETS = {
    引导购买: '目标：购买并领悟任意一本功法', 引导参悟: '目标：将任意功法参悟至5重',
    引导草木: '目标：草木技艺等级提升至5级', 引导金石: '目标：金石技艺等级提升至5级',
    引导炼丹: '目标：炼制并服用凡阶聚气丹', 引导炼器: '目标：炼制并装备玄铁剑',
    引导捕兽: '目标：捕捉并上阵任意灵兽', 引导驭兽: '目标：任意灵兽契合等级至5级',
    引导挑战: '目标：战胜修士石浩', 引导洞府: '目标：洞府修室升至2级',
    引导灵物: '目标：灵阵摆放任意灵物', 引导转世: '目标：进行转世 或 至筑基圆满',
    引导深渊: '目标：探索深渊至第5层', 引导门派: '目标：创建门派',
    引导秘境: '目标：探索秘境获得并嵌入乾金石'
  };

  proto.getQuestSnapshot = function () {
    const rw = this._array('rw');
    const held = this._array('svrw');
    const save = this._array('save');
    // rw reads columns 0..11; active-task lookup needs only svrw[x,0,0]. The
    // shipped dimensions are rw[343,21,1], svrw[1,21,1], save[180,60,4];
    // the main layout expands save to [321,52,31]. A zero-depth array is not ready.
    const ready = Boolean(this._layout() === '主界面' && this._dataReady() && rw && rw.width > 319 &&
      rw.height >= 12 && rw.depth >= 1 && held && held.height >= 1 && held.depth >= 1 &&
      save && save.width >= 19 && save.height >= 19 && save.depth >= 1);
    const at = (name, x, y = 0, z = 0) => this._at(this._array(name), x, y, z);
    const numberAt = (name, x, y = 0, z = 0) => num(at(name, x, y, z));
    const unlocks = Object.fromEntries(Object.entries(FLAGS).map(([key, [row, name]]) => {
      const flag = ready ? num(this._at(save, row, 18)) : null;
      return [key, { id: key, name, saveRow: row, saveColumn: 18, flag,
        unlocked: flag === null ? null : flag === 1 }];
    }));
    const paused = this._flag('游戏暂停');
    const quests = [];
    const compare = (current, operator, required) => current === null || required === null ? null :
      operator === '>' ? current > required : operator === '>=' ? current >= required :
      operator === '===' ? current === required : null;
    const artLevels = () => {
      if (!save || save.height <= 2) return null;
      return Array.from({ length: save.width }, (_, id) => this._at(save, id, 2));
    };
    if (ready) for (let inventoryIndex = 0; inventoryIndex < held.width; inventoryIndex++) {
      const id = num(this._at(held, inventoryIndex, 0));
      if (!Number.isInteger(id) || id < 1 || id >= rw.width || this._at(rw, id, 2) !== '主线任务') continue;
      const name = plain(this._at(rw, id, 1));
      const description = plain(this._at(rw, id, 6));
      const type = this._at(rw, id, 3);
      const targetId = num(this._at(rw, id, 4));
      const tableTarget = num(this._at(rw, id, 5));
      let target = TARGETS[type] ?? description;
      if (type === '引导修炼') {
        const method = plain(at('xl', targetId, 1));
        target = method && tableTarget !== null ? `目标：将${method}修炼至${tableTarget}重` : description;
      } else if (type === '引导战胜') {
        const enemy = plain(at('ll', targetId, 1));
        target = enemy && tableTarget !== null ? `目标：战胜${enemy}${tableTarget}次` : description;
      } else if (type === '引导卖出') {
        target = tableTarget === null ? description : `目标：拥有灵石${tableTarget}以上`;
      } else if (type === '引导突破') {
        const realm = plain(at('dj', tableTarget, 1));
        target = realm ? `目标：境界突破至${realm}` : description;
      }
      let current = null, required = null, comparison = null, unit = null, conditionMet = null;
      let combinedCondition = false;
      let hint = description;
      let rawCurrent = null;
      const details = {};
      // Exact event conditions. rw[5] is not generically a count: e.g. quest 318
      // contains 10 there, while its real condition is 丹药真气 > 0 (event 9165).
      if (id === 311) {
        current = numberAt('save', 1, 1); required = tableTarget; comparison = '>='; unit = '重';
        hint = '在修炼中提升吐纳至20重，由原主线自动检测。';
      } else if (id === 312) {
        current = rawCurrent = numberAt('save', 1, 4); required = tableTarget; comparison = '>'; unit = '原计数';
        details.initialTemplateCount = 1;
        details.counterNote = '发行模板save[1,4]初始为1；原事件使用严格大于5，不统一减1。';
        hint = '在凡界持续战胜乌鬃野猪5次。原检测要求save[1,4]大于5，初始模板计数为1。';
      } else if (id === 313) {
        current = this._number('灵石'); required = tableTarget; comparison = '>='; unit = '灵石';
        details.shortfall = current === null || required === null ? null : Math.max(0, required - current);
        hint = '继续凡界历练，凡核按出售价值直接结算灵石。当前持有灵石达到500即可，无需手动出售。';
      } else if (id === 314) {
        // Native 主线任务功法检测(0) sums save[x,2] over the full array. System
        // AddVar converts non-numbers with parseFloat (c3runtime.js:3875), not Number.
        // Empty/unparseable cells therefore remain unknown here instead of becoming 0.
        // New-game normalization (data /project/6/4/1/14/8/2/8/0/8/0) normally
        // rounds/converts the shipped empty cells to numeric zero before the main layout.
        const levels = artLevels();
        const numbers = levels?.map(value => {
          if (value === null || value === undefined) return null;
          const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
          return Number.isFinite(parsed) ? parsed : null;
        }) ?? null;
        const total = numbers && numbers.every(value => value !== null) ? numbers.reduce((sum, value) => sum + value, 0) : null;
        current = Number.isFinite(total) ? total : null;
        required = 1; comparison = '>='; unit = '功法累计重数';
        details.learnedArts = numbers ? numbers.filter(value => value !== null && value > 0).length : null;
        details.progressUnknownReason = current === null ? '原功法累计检测包含无法确定的数值，保留原目标文字。' : null;
        hint = '在商会购买任意一本功法，再到纳戒领悟；只买到书还未完成。';
      } else if (id === 315) {
        // 主线任务功法检测2 returns 1 when any save[x,2] >= 5 (9234-9236).
        const values = artLevels()?.map(num) ?? null;
        const known = values?.filter(value => value !== null) ?? null;
        current = known?.length ? Math.max(...known) : null;
        required = 5; comparison = '>='; unit = '重';
        hint = '在功法中参悟任意已领悟功法，使其达到5重；参悟消耗原游戏参悟值。';
      } else if (id === 316 || id === 317) {
        current = this._number(id === 316 ? '草木等级' : '金石等级');
        required = 5; comparison = '>='; unit = '级';
        hint = id === 316 ? '采集草木，将草木技艺提升至5级，完成原剧情后解锁炼丹。' :
          '挖掘金石，将金石技艺提升至5级，完成原剧情后解锁炼器。';
      } else if (id === 318) {
        current = this._number('丹药真气'); required = 0; comparison = '>'; unit = '丹药真气';
        details.recipeLearned = numberAt('save', 1, 13) > 0;
        hint = details.recipeLearned ? '已学会凡阶聚气丹方，准备材料炼制，再到纳戒服用丹药。' : '学习凡阶聚气丹方，准备材料炼制，再到纳戒服用丹药。';
      } else if (id === 319) {
        const equipped = numberAt('svzb', 2, 0, 0);
        const equippedName = equipped === null ? null : plain(at('wp', equipped, 1));
        details.equippedSword = equippedName;
        conditionMet = equippedName === null ? null : equippedName === '玄铁剑';
        details.recipeLearned = numberAt('save', 16, 15) > 0;
        hint = details.recipeLearned ? '已学会玄铁剑器方，准备材料炼制，再到纳戒装备玄铁剑。' : '学习玄铁剑器方，准备材料炼制，再到纳戒装备玄铁剑。';
      } else if ([320, 326, 328, 330, 339, 341].includes(id)) {
        current = this._number('lv'); required = tableTarget; comparison = '>='; unit = '境界序号';
        details.currentRealm = current === null ? null : plain(at('dj', current, 1));
        details.requiredRealm = required === null ? null : plain(at('dj', required, 1));
      } else if (id === 321 || id === 323) {
        rawCurrent = numberAt('save', 1, id === 321 ? 17 : 21);
        conditionMet = compare(rawCurrent, '>', 0);
      } else if (id === 322) {
        current = numberAt('save', 2, 17); required = 5; comparison = '>='; unit = '契合等级';
      } else if (id === 324) {
        current = this._number('修室等级'); required = 2; comparison = '>='; unit = '级';
      } else if (id === 327) {
        combinedCondition = true;
        current = this._number('转世次数'); required = 1; comparison = '>='; unit = '次';
        details.alternativeLevel = this._number('lv');
        details.alternativeRequired = 20;
        details.alternativeRealm = plain(at('dj', 20, 1));
        details.currentRealm = plain(at('dj', details.alternativeLevel, 1));
        details.reincarnationDispatch = num(this._at(rw, id, 8));
        details.realmAlternativeDispatch = 26;
        details.requirementMode = 'any';
        hint = `可先查看转世预览；原任务也允许继续修行至${details.alternativeRealm || '筑基圆满'}，无需强制转世。`;
        conditionMet = compare(current, comparison, required);
        const alternative = compare(details.alternativeLevel, '>=', 20);
        conditionMet = conditionMet === true || alternative === true ? true :
          conditionMet === null || alternative === null ? null : false;
      } else if (id === 329) {
        current = this._number('深渊层数'); required = 5; comparison = '>='; unit = '层';
      }
      if (!combinedCondition && conditionMet === null && comparison !== null) conditionMet = compare(current, comparison, required);
      if (conditionMet === true) hint = paused === true ?
        '目标条件已满足，恢复游戏后等待原主线检测推进；有剧情时需继续对话。' :
        '目标条件已满足，等待原主线检测推进；有剧情时需继续对话。';
      const progressText = id === 327 ? `转世${current ?? '未知'} / 1次，或${details.currentRealm || '当前境界未知'} → ${details.alternativeRealm || '筑基圆满'}` :
        current === null || required === null ? null :
        id === 312 ? `原始战胜计数${current}（需>${required}）` :
        id === 318 ? `丹药真气${current}（需>0）` : `${current} / ${required}${unit ?? ''}`;
      const triggerChild = id >= 311 && id <= 342 ? id - 311 : null;
      quests.push({
        id, inventoryIndex, name, description, type, target, current, required, comparison, unit,
        rawCurrent, tableTarget, progressText, conditionMet, hint, details,
        unlocks: (NEXT_UNLOCKS[id] ?? []).map(key => unlocks[key]),
        rewards: { insight: num(this._at(rw, id, 10)), spiritStones: num(this._at(rw, id, 11)) },
        source: {
          task: `rw.json#/data/${id}`, active: `svrw[${inventoryIndex},0,0]`,
          // Branch order matches 9149..9214, but not every later predicate is projected above.
          trigger: triggerChild === null ? null : `/project/6/0/1/129/8/9/8/2/8/0/8/0/8/${triggerChild}`,
          progressKnown: comparison !== null && current !== null && required !== null
        }
      });
    }
    const currentQuest = quests[0] ?? null;
    return {
      ready, quests, currentQuest, activeCount: quests.length,
      // These convenient fields mirror the FIRST original main-quest row; quests retains parallel goals.
      id: currentQuest?.id ?? null, name: currentQuest?.name ?? null,
      description: currentQuest?.description ?? null, target: currentQuest?.target ?? null,
      current: currentQuest?.current ?? null, required: currentQuest?.required ?? null,
      comparison: currentQuest?.comparison ?? null, unit: currentQuest?.unit ?? null,
      conditionMet: currentQuest?.conditionMet ?? null, progressText: currentQuest?.progressText ?? null,
      hint: currentQuest?.hint ?? (ready ? '当前原存档中没有进行中的主线任务。' : '原任务数据尚未载入。'),
      unlocks, paused, detectionInterval: { seconds: 1, clock: '原游戏时间', requiresUnpaused: true }
    };
  };
})();
