/* Original reincarnation controller, with the original read-only preview retained.
 * Shipped data.json: entry 9077/X17 9331; reset 852-861; trial 870-927;
 * global formulas 19-24; scourge 2148-2156. Details: analysis evidence file.
 * Never call 打开转世挑战界面 for inspection: it refills qi, then starts combat.
 * Actions below send audited original controls; confirmation requires a fresh
 * asset/result review token. No action assigns engine globals or save arrays.
 */
(() => {
  'use strict';
  if (!window.GameAdapter) throw new Error('Reincarnation preview requires GameAdapter.');
  const proto = window.GameAdapter.prototype;
  const safe = (read, fallback = null) => { try { return read() ?? fallback; } catch { return fallback; } };
  const num = value => {
    if (typeof value !== 'number' && !(typeof value === 'string' && value.trim() !== '')) return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  };
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const multiply = (left, right) => typeof left === 'number' && typeof right === 'number' ? left * right : left;
  const known = values => values.every(value => value !== null);
  const plain = value => typeof value === 'string' ?
    value.replace(/\[\/?(?:color|size|b|i|u|s|font)(?:=[^\]]*)?\]/gi, '') : null;
  const summary = pairs => pairs.every(pair => pair[1] !== null) ?
    pairs.map(([label, value]) => label + value).join('、') : null;
  const ROOTS = ['金', '水', '木', '火', '土'];
  const APTITUDES = ['气感', '神识', '根骨', '悟性', '机缘'];
  const SKILLS = ['草木', '金石', '炼丹', '炼器', '种植', '驭兽', '画符'];
  const BUILDINGS = ['修室', '书阁', '丹炉', '器鼎', '兽栏', '画室', '灵田', '灵阵'];
  const EVIDENCE = [
    { key: 'unlock', pointer: '/project/6/0/1/129/8/10/8/21/8/0', events: [9331, 9077, 9079] },
    { key: 'reset', pointer: '/project/6/0/1/127/8/6/8/14/8/0', events: [852, 853, 854, 856, 857, 858, 859, 860, 861] },
    { key: 'trial', pointer: '/project/6/0/1/127/8/6/8/16', events: [870, 875, 880, 882, 883, 884, 885, 886, 888, 891, 898, 901, 919, 925] },
    { key: 'enemy-and-points', pointer: '/project/6/1/1/129/8/13', events: [19, 20, 21, 22, 23, 24] },
    { key: 'scourge', pointer: '/project/6/0/1/128/8/3/8/18/8/5', events: [2148, 2150, 2153, 2156] },
    { key: 'equipped-fate-stones', pointer: '/project/6/0/1/128/8/18/8/5/8/1', events: [7649, 7650, 7651] },
    { key: 'planted-crops', pointer: '/project/6/0/1/128/8/19/8/14/8/1', events: [7794] }
  ];

  proto.getReincarnationPreview = function () {
    const save = this._array('save'), dj = this._array('dj');
    const ready = Boolean(this._layout() === '主界面' && this._dataReady() &&
      save?.width >= 18 && save.height >= 30 && save.depth >= 1 &&
      dj?.width >= 12 && dj.height >= 4 && dj.depth >= 1);
    const global = name => ready ? this._number(name) : null;
    const flag = name => ready ? this._flag(name) : null;
    const cell = (table, x, y = 0, z = 0) => ready ? this._at(table, x, y, z) : null;
    const value = (table, x, y = 0, z = 0) => num(cell(table, x, y, z));
    const level = global('lv'), age = global('年龄'), lifespan = global('寿元');
    const year = global('年'), month = global('月');
    const remainingLife = known([age, lifespan]) ? lifespan - age : null;
    const unlockFlag = value(save, 16, 18), unlocked = unlockFlag === null ? null : unlockFlag === 1;
    const unlockReason = !ready ? '原游戏数据尚未载入。' : unlocked ? null : '筑基一境后继续完成原主线教学，才会解锁转世试练。';
    const points = global('重生值'), turns = global('转世次数'), cycleLevel = global('转世等级');
    const trialActive = flag('转世开关'), observedPoints = global('获得转世点');
    const trialEnemyLevel = global('转世敌人等级');
    const expired = window.MobileLifespan?.expired(remainingLife) ?? (remainingLife === null ? null : remainingLife < 0); // source 919 is strictly <0
    const blocked = ready ? Boolean(this._blocked() || ['筛选背景', '道具tips背景', '神国菜单背景']
      .some(name => this._instances(name).some(instance => this._visible(instance)))) : null;
    const reason = unlockReason || (expired === null ? '原寿元数据尚未确定。' : expired ?
      '寿命已耗尽；原重生分支不会获得本次试练转世点。' : trialActive === null ?
      '原试练状态尚未确定。' : trialActive ? '原转世试练正在进行。' :
      blocked ? '原界面存在提示或遮罩，试练入口暂不可操作。' : null);

    // Read exact source confirmation context; never open trial/confirmation UI.
    const confirmClass = safe(() => this._engine().GetObjectClassByIndex(1467));
    const confirmations = safe(() => confirmClass.GetName()) === '对话选择框确定' ?
      safe(() => confirmClass.GetInstances().map(instance => instance.GetInterfaceClass()), []) : [];
    const confirmation = confirmations.find(instance => this._visible(instance) &&
      safe(() => instance.instVars.开关, false) &&
      ['确定转世', '强行转世', '确定重生'].includes(safe(() => instance.instVars.目标功能)));
    const confirmationKind = safe(() => confirmation.instVars.目标功能);
    const normalConfirmed = ready && trialActive === false && confirmationKind === '确定转世' && observedPoints !== null && observedPoints > 0;
    const normalPoints = normalConfirmed ? Math.round(observedPoints) : null;

    let scourge = ready ? 0 : null;
    if (ready) for (let id = 1; id <= 15; id++) {
      const raw = cell(save, id, 27);
      // Original System.AddVar parses numeric strings, rather than treating an
      // absent/error read as zero. Retain unknown when it cannot be established.
      const n = typeof raw === 'number' ? raw : parseFloat(raw);
      if (!Number.isFinite(n)) { scourge = null; break; }
      scourge += n;
    }
    if (scourge !== null) scourge = Math.round(scourge);
    const roots = ROOTS.map((name, i) => ({ name, current: value(save, i + 1, 20), after: 0 }));
    const aptitudes = APTITUDES.map(name => ({ name, value: global(name) }));
    const skills = SKILLS.map(name => ({ name, level: global(name + '等级'), experience: global(name + '经验'), afterLevel: 1, afterExperience: 0 }));
    const buildings = BUILDINGS.map(name => ({ name, level: global(name + '等级') }));
    const cultivation = [];
    const xl = this._array('xl');
    if (ready && xl?.width >= 18 && xl.height >= 2) for (let id = 1; id <= 17; id++) {
      cultivation.push({ id, name: plain(cell(xl, id, 1)), level: value(save, id, 1), afterLevel: 0 });
    }
    const gf = this._array('gf');
    let artsCount = ready && gf?.width > 1 && gf.height >= 2 ? 0 : null;
    if (artsCount !== null) for (let id = 1; id < gf.width; id++) {
      const n = value(save, id, 2);
      if (n === null) { artsCount = null; break; }
      if (n > 0) artsCount++;
    }
    // Count source instances/slots, not names: different quality beasts/spirits
    // and stacked quantities must not be silently merged or treated as currency.
    const inventory = this._array('svwp'), equipped = this._array('svzb'), spirits = this._array('svlz');
    const countIds = (table, column, z = 0, withCount = false, limit = null) => {
      if (!ready || !table || table.height <= column || table.depth <= z) return null;
      let count = 0;
      const end = limit === null ? table.width - 1 : Math.min(table.width - 1, limit);
      for (let row = 1; row <= end; row++) {
        const id = value(table, row, column, z);
        const quantity = withCount ? value(table, row, 1, z) : 1;
        if (id === null || quantity === null) return null;
        if (id > 0 && quantity > 0) count++;
      }
      return count;
    };
    const inventoryRows = countIds(inventory, 0, 0, true);
    const equippedCount = countIds(equipped, 0, 0);
    const spiritCount = countIds(spirits, 0, 0);
    const fateStoneCount = countIds(equipped, 0, 1, false, 10);
    const plantedCount = countIds(spirits, 1, 2, false, 36);
    const deployedBeastId = value(save, 1, 17), selectedMaterialId = value(save, 1, 26);
    const deployedBeastCount = deployedBeastId === null ? null : deployedBeastId > 0 ? 1 : 0;
    const selectedMaterialCount = selectedMaterialId === null ? null : selectedMaterialId > 0 ? 1 : 0;
    const deployedBeastName = deployedBeastId > 0 ? plain(cell(this._array('ll'), deployedBeastId, 1)) : null;
    const selectedMaterialName = selectedMaterialId > 0 ? plain(cell(this._array('wp'), selectedMaterialId, 1)) : null;
    const recipeCount = (name, column) => {
      const table = this._array(name);
      if (!ready || !table || table.width <= 1) return null;
      let count = 0;
      for (let id = 1; id < table.width; id++) {
        const n = value(save, id, column);
        if (n === null) return null;
        if (n === 1) count++;
      }
      return count;
    };
    const alchemyRecipes = recipeCount('ld', 13), smithingRecipes = recipeCount('lq', 15);
    const rootsText = summary(roots.map(item => [item.name, item.current]));
    const aptitudeText = summary(aptitudes.map(item => [item.name, item.value]));
    const skillsText = summary(skills.map(item => [item.name + 'Lv', item.level]));
    const buildingsText = summary(buildings.map(item => [item.name + 'Lv', item.level]));
    const learnedRecipesText = known([alchemyRecipes, smithingRecipes]) ?
      '丹方' + alchemyRecipes + '种、器方' + smithingRecipes + '种' : null;
    const realm = Number.isInteger(level) ? plain(cell(dj, level, 1)) : null;
    const firstRealm = plain(cell(dj, 1, 1));
    const row = (key, label, current, after, currentText, afterText, scope, ruleText) => ({
      key, label, current, after, currentText: currentText ?? '尚未读取', afterText: afterText ?? '尚未确定', scope, ruleText
    });
    const amount = (n, unit = '') => n === null ? null : n.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + unit;
    const cultivationLevels = cultivation.length === 17 && cultivation.every(item => item.level !== null) ?
      cultivation.reduce((sum, item) => sum + item.level, 0) : null;
    const resets = [
      row('realm', '人物境界', level, 1, realm, firstRealm, '当前人物', '境界回到炼气一境。'),
      row('age', '人物年龄', age, 1, amount(age, '岁'), '1岁', '当前人物', '年龄重置为1，历法年增加1，月份不在本重置中改写。'),
      row('pill-toxicity', '丹毒', global('丹毒'), 0, amount(global('丹毒')), '0', '当前人物丹毒', '原转世例程同时将丹毒清零。'),
      row('cultivation', '修炼进度', cultivationLevels, 0, cultivationLevels === null ? null : '已修炼合计' + cultivationLevels + '层', '全部归零', '全部修炼方法', '已修层数清零，需重新修炼。'),
      row('arts', '个人功法', artsCount, 1, amount(artsCount, '种已学功法'), '仅恢复原初始功法，其他个人功法重置', '个人功法层数和参悟进度', '功法数据清零后，原初始功法恢复1重。'),
      row('skills', '个人技艺', skillsText, '各Lv1，经验0', skillsText, '各Lv1，经验0', '草木、金石、炼丹、炼器、种植、驭兽、画符', '七种个人技艺等级回到1，经验归零；已学配方另列保留。'),
      row('soul-crystals', '魂晶', global('魂晶'), 0, amount(global('魂晶')), '0', '当前魂晶余额', '原转世例程将魂晶清零，不提供转世魂晶奖励。'),
      row('spirit-stones', '灵石', global('灵石'), 0, amount(global('灵石')), '0', '当前灵石余额', '当前灵石余额清零。'),
      row('insight', '参悟', global('参悟'), 0, amount(global('参悟')), '0', '当前参悟余额', '当前参悟余额清零。'),
      row('inventory', '纳戒物品', inventoryRows, 0, amount(inventoryRows, '项物品'), '全部清空', '纳戒全部物品行，含锁定物品及不同品质实例', '纳戒整体清空，不按物品锁定或种类豁免。'),
      row('equipment', '法宝装备', equippedCount, 0, amount(equippedCount, '格已装备'), '全部取空且不返还纳戒', '法宝装备层的全部槽位；已入命命石另列', '原例程直接清空装备，不是卸下返还。'),
      row('deployed-beast', '上阵灵兽', deployedBeastCount, 0, deployedBeastName || amount(deployedBeastCount, '只已上阵'), '清空且不返还纳戒', '上阵灵兽及其等级、契合和资质记录', '原转世例程直接清空上阵记录，不执行卸下回收。'),
      row('selected-material', '已选渡劫材料', selectedMaterialCount, 0, selectedMaterialName || amount(selectedMaterialCount, '件已选择'), '清空且不返还纳戒', '已经装入的渡劫材料；纳戒内材料另外整体清空', '材料的独立选用记录直接清空，不执行取下返还。'),
      row('spirits', '灵阵灵物', spiritCount, 0, amount(spiritCount, '件已摆放'), '全部清空且不返还纳戒', '灵阵物品与五品质；不包含灵田已种灵植层', '已摆放灵物直接清空，建筑等级保留。'),
      row('roots', '五行灵根', rootsText, '金0、水0、木0、火0、土0', rootsText, '金0、水0、木0、火0、土0', '原人物面板显示的五行灵根记录', '五行灵根记录清零，不是额外转世收益。'),
      row('scourge', '累计天谴', scourge, 0, amount(scourge), '0', '各大境界已记录的天谴品级', '天谴记录清零，其双方基础加成也回到无累计天谴状态。'),
      row('pill-bonuses', '丹药累积属性', summary(['寿元', '真气', '攻击', '防御'].map(name => [name, global('丹药' + name)])),
        0, summary(['寿元', '真气', '攻击', '防御'].map(name => [name, global('丹药' + name)])), '全部归零', '已服丹药累积的四项个人属性', '这四项丹药累积值清零，总寿元和总战力随后按原规则重算。'),
      row('fruit-lifespan', '灵果累积寿元', global('灵果寿元'), 0, amount(global('灵果寿元')), '0', '灵果增加的个人寿元', '该寿元累积值清零；不等同于清除已投入五项天资。'),
      row('abyss', '深渊进度', global('深渊层数'), 1, amount(global('深渊层数'), '层'), '1层，领取计时重新开始', '个人深渊层数和领取时间', '层数回到1，原领取时间重置为转世时刻。')
    ];
    const retained = [
      row('aptitudes', '五项基础天资', aptitudeText, aptitudeText, aptitudeText, aptitudeText, '气感、神识、根骨、悟性、机缘的基础值', '原转世例程不清除这些已投入天资；由装备和法则形成的总倍率另按原规则重算。'),
      row('unspent-points', '原有转世点', points, points, amount(points, '点'), points === null ? null : '原有' + points + '点保留，另加实际试练所得', '尚未花费的原有转世点', '仅正常轮回另外结算本次试练所得，强行或寿尽不增加。'),
      row('buildings', '洞府建筑等级', buildingsText, buildingsText, buildingsText, buildingsText, '八类洞府建筑的等级', '原例程不重置建筑等级，但个人技艺、灵阵物品及相关个人属性会变化。'),
      row('recipes', '已学配方', learnedRecipesText, learnedRecipesText, learnedRecipesText, learnedRecipesText, '已学丹方和器方标记', '已学标记保留；炼丹和炼器的个人技艺及对应熟练进度会重置。'),
      row('fate-stones', '已入命命石', fateStoneCount, fateStoneCount, amount(fateStoneCount, '格已入命'), amount(fateStoneCount, '格保留'), '已经装备入命的命石；不包含纳戒内命石', '已入命命石的独立装备层不在本次清空范围；纳戒内物品仍清空。'),
      row('planted-crops', '灵田已种灵植', plantedCount, plantedCount, amount(plantedCount, '株已种植'), amount(plantedCount, '株种植记录保留'), '已播种的灵田记录', '当前种植记录所在层未被重置；种植技艺重置后后续效果须按原规则计算。'),
      row('turns', '转世次数', turns, turns === null ? null : turns + 1, amount(turns, '次'), turns === null ? null : (turns + 1) + '次', '成功确认重生或轮回后的累计次数', '正常轮回和强行重生都会增加1次。')
    ];

    // The original formula is exponential in the persisted cycle level. Do not
    // call it: it shares names with live trial variables/functions.
    const baseQi = cell(dj, 11, 3);
    let nextEnemy = null;
    if (ready && Number.isInteger(cycleLevel) && cycleLevel >= 0 && baseQi !== null) {
      const raw = multiply(baseQi, Math.pow(1.06, cycleLevel));
      const pointsIfDefeated = cycleLevel <= 1500 ? Math.floor(cycleLevel / 50) + 1 :
        finite(Math.floor(30 * Math.pow(1.035, (cycleLevel - 1500) / 7 + 70)));
      nextEnemy = { level: cycleLevel, qi: finite(Math.round(raw)),
        attack: finite(Math.round(multiply(raw, 0.04))), defense: finite(Math.round(multiply(raw, 0.02))),
        pointsIfDefeated };
    }
    const afterPoints = known([points, normalPoints]) ? finite(points + normalPoints) : null;
    const warnings = [];
    if (!window.MobileLifespan?.unlimited && remainingLife !== null && remainingLife <= 10) warnings.push('当前剩余寿元' + remainingLife + '年；此预览不会推进时间。');
    warnings.push('确认转世会清空纳戒、灵石、魂晶、个人装备、上阵灵兽和灵阵灵物。');
    warnings.push('打开原转世挑战会直接进入试练流程，本预览不会打开或启动它。');
    return {
      ready, previewOnly: true, canExecute: false, unlocked, unlockReason,
      eligibility: { unlocked, eligibleForTrial: reason === null, canOpenTrial: reason === null,
        lifespanExpired: expired, remainingLife, trialActive, blocked, reason,
        ruleText: '筑基后完成原主线解锁，寿命耗尽前可反复试练；结果不满意可放弃，确认转世才重置。' },
      current: { level, realm, age, lifespan, remainingLife, year, month, turns, cycleLevel,
        points, soulCrystals: global('魂晶'), spiritStones: global('灵石'), insight: global('参悟'),
        qi: global('真气'), maxQi: global('真气上限'), attack: global('攻击'), defense: global('防御'),
        scourge, roots, aptitudes, skills, buildings, cultivation, inventoryRows, equippedCount, spiritCount,
        fateStoneCount, plantedCount, alchemyRecipes, smithingRecipes,
        deployedBeast: { id: deployedBeastId, name: deployedBeastName, count: deployedBeastCount },
        selectedMaterial: { id: selectedMaterialId, name: selectedMaterialName, count: selectedMaterialCount },
        scourgeMultipliers: { player: scourge === null ? null : finite(Math.pow(1.15, scourge)),
          enemyNormal: scourge === null ? null : finite(Math.pow(1.15, scourge)), afterPlayer: 1, afterEnemyNormal: 1 } },
      trial: { startingLevel: cycleLevel, nextEnemy, active: trialActive, observedPoints, currentEnemyLevel: trialEnemyLevel,
        settlementAvailable: normalConfirmed, estimatedTotalPoints: null,
        reason: '实际通关层数、持续战斗状态与原掉落结算尚未发生，无法保证总收益。',
        ruleText: '从已有轮回境等级开始逐层试练；每层最多20秒，真气耗尽或超时结束。击败后累加该层转世点，最终以原结算为准。',
        summary: nextEnemy ? '下一层为轮回境Lv' + cycleLevel + '；击败该层可产生' + (nextEnemy.pointsIfDefeated ?? '尚未确定') + '点，非本次总收益。' : '下一层数据尚未读取。' },
      rewards: {
        normal: { points: normalPoints, afterPoints, cycleLevel: normalConfirmed ? trialEnemyLevel : null,
          confirmed: normalConfirmed, ruleText: '正常轮回增加原试练实际所得的转世点，并记录下一轮回境等级；未实际试练时总收益未知。' },
        forced: { points: 0, afterPoints: points, cycleLevel,
          ruleText: '寿命耗尽或零收益时强行重生不获得本次转世点，原有未花点数和轮回境等级保留。' },
        aptitudePerPoint: 0.1, soulCrystalGain: 0, afterSoulCrystals: 0,
        turnsAfter: turns === null ? null : turns + 1,
        summary: '每点转世点可增加所选基础天资0.1；魂晶不作为转世奖励，现有魂晶会清零。',
        scope: '以下重置值是原转世例程的即时结果；后续主线或其他事件的额外奖励不计入。'
      },
      resets, retained, unknowns: ['本次试练实际可通关层数及总转世点',
        '重生后按原规则重新计算的总寿元和总战力',
        '未逐项审计的其他系统及存档层，不作整体保留或整体清空保证'],
      warnings, evidence: EVIDENCE
    };
  };
  const REINCARNATION_CLASSES = { 按钮文字: 2, 重生按钮: 373, 重生加号: 372, 转世加点倍率: 282,
    转世界面背景: 1450, 转世进度值: 382, 对话选择框确定: 1467, 对话选择框返回: 1469, 黑幕: 509 };
  const MULTIPLIERS = [1, 10, 100, 1000, 10000, 100000, 1000000];
  const CONFIRM_FEATURES = ['开启试练', '确定转世', '强行转世', '确定重生'];
  const PHASE_LABELS = { locked: '尚未解锁', idle: '未进行试练', 'start-confirmation': '准备开启试练',
    waiting: '原试练流程处理中', trial: '正在进行转世试练', settlement: '试练结束，等待选择',
    'lifespan-confirmation': '寿命耗尽，等待重生', 'other-dialogue': '请先处理原游戏提示' };
  const isEnabled = instance => [true, 1].includes(safe(() => instance.instVars.开关));

  proto._reincarnationCommitted = function (name) {
    const cls = safe(() => this._engine().GetObjectClassByIndex(REINCARNATION_CLASSES[name]));
    if (safe(() => cls.GetName()) === name) return safe(() => cls.GetInstances().map(instance => instance.GetInterfaceClass()), []);
    return safe(() => this.runtime.objects[name].getPickedInstances(), []);
  };
  proto._reincarnationControl = function (name, feature = null, requireSwitch = false) {
    return this._reincarnationCommitted(name).find(instance => this._visible(instance) &&
      (feature === null || safe(() => instance.instVars.目标功能) === feature) &&
      (!requireSwitch || isEnabled(instance))) ?? null;
  };
  proto._reincarnationForeignModal = function (allowOwned = false) {
    const allowed = allowOwned ? ['对话框', '转世'] : [];
    // Entry event 835 requires the god-world menu's actual instance count=0.
    if (this._instances('神国菜单背景').length > 0) return true;
    if (this._reincarnationCommitted('黑幕').some(instance => this._visible(instance) &&
        !allowed.includes(safe(() => instance.instVars.用途)))) return true;
    return ['数字输入背景', '筛选背景', '道具tips背景', '神国菜单背景', '制造物tips背景', '操作屏蔽']
      .some(name => this._instances(name).some(instance => this._visible(instance)));
  };
  proto._reincarnationState = function (ownOperation = false) {
    const preview = this.getReincarnationPreview();
    const confirms = this._reincarnationCommitted('对话选择框确定').filter(instance => this._visible(instance));
    const confirm = confirms.length === 1 ? confirms[0] : null;
    const feature = safe(() => confirm.instVars.目标功能);
    const back = this._reincarnationControl('对话选择框返回');
    const backFeature = safe(() => back.instVars.目标功能);
    const background = this._reincarnationControl('转世界面背景');
    const active = this._flag('转世开关');
    let phase = 'idle';
    if (feature === '确定重生') phase = 'lifespan-confirmation';
    else if (['确定转世', '强行转世'].includes(feature)) phase = 'settlement';
    else if (feature === '开启试练') phase = 'start-confirmation';
    else if (active === true) phase = 'trial';
    else if (background) phase = 'waiting';
    else if (confirms.length || this._reincarnationForeignModal()) phase = 'other-dialogue';
    else if (preview.unlocked !== true) phase = 'locked';
    const ownedModal = CONFIRM_FEATURES.includes(feature);
    const foreign = this._reincarnationForeignModal(ownedModal || Boolean(background));
    const busy = Boolean(this.busy || this._reincarnationBusy || this._nativeInputBusy);
    const basicReason = !preview.ready ? '原游戏数据尚未载入。' : !ownOperation && busy ? '正在处理上一项操作。' :
      typeof this._nativeTap !== 'function' ? '原控件输入尚未准备完成。' : foreign ? '请先关闭其他原游戏提示或窗口。' : null;
    const startReason = basicReason || preview.unlockReason || (active === null ? '原试练状态尚未载入。' :
      !['idle', 'start-confirmation'].includes(phase) ? '请先结束或处理当前原转世流程。' :
      preview.current.remainingLife === null || (!window.MobileLifespan?.unlimited && preview.current.remainingLife < 0) ? '寿命已耗尽，无法开启新的试练。' :
      preview.current.maxQi === null || preview.current.maxQi <= 0 ? '原人物战力尚未准备完成。' :
      phase === 'start-confirmation' && !isEnabled(confirm) ? '原试练确认按钮暂不可用。' : null);
    const abandonReason = basicReason || (active === true ? '原试练中没有中途放弃按钮；请等待原试练结算。' :
      !['start-confirmation', 'settlement'].includes(phase) ? '当前没有可放弃的试练确认。' :
      !['暂不开启', '放弃转世'].includes(backFeature) &&
        !(feature === '放弃转世' && isEnabled(confirm)) ? '原放弃按钮尚未准备完成。' : null);
    const reviewReason = basicReason || (!['settlement', 'lifespan-confirmation'].includes(phase) ?
      '请先完成原试练，或等待原寿尽重生确认。' : active !== false ? '原试练尚未停止。' :
      !confirm || !isEnabled(confirm) ? '原转世确认按钮暂不可用。' : null);
    const allocateReason = basicReason || preview.unlockReason ||
      (phase !== 'idle' ? '请先处理当前试练或转世提示。' : null);
    // This is a static LOCAL in 转世分页, not runtime.globalVars.
    const multiplier = num(this._local(116053250214340)), points = preview.current.points;
    const aptitudes = APTITUDES.map(name => {
      const value = this._number(name);
      const reason = allocateReason || (!MULTIPLIERS.includes(multiplier) ? '原加点倍率尚未确定。' :
        points === null || value === null ? '原天资或转世点尚未载入。' :
        points < multiplier ? '剩余转世点不足当前加点倍率。' : null);
      return { name, value, cost: multiplier, gain: multiplier === null ? null : multiplier * 0.1,
        canAllocate: reason === null, reason };
    });
    const token = preview.ready ? JSON.stringify(['reincarnation-state-v1', safe(() => this.engineWindow.location.origin),
      this._number('存档档位'), phase,
      preview.unlocked, preview.current.level, preview.current.age, preview.current.turns, preview.current.cycleLevel,
      points, multiplier, aptitudes.map(item => item.value), feature, confirm?.uid ?? null,
      backFeature, back?.uid ?? null, active, this._number('获得转世点'), this._number('转世敌人等级')]) : null;
    const actions = [
      { id: 'open', label: '打开原转世页', enabled: !basicReason && preview.unlocked === true && phase === 'idle',
        reason: basicReason || preview.unlockReason || (phase !== 'idle' ? '请先处理当前原转世流程。' : null) },
      { id: 'start-trial', label: '开启转世试练', enabled: !startReason, reason: startReason },
      { id: 'abandon', label: phase === 'start-confirmation' ? '暂不开启' : '放弃本次转世', enabled: !abandonReason, reason: abandonReason },
      { id: 'review', label: '核对转世结算与损失', enabled: !reviewReason, reason: reviewReason },
      { id: 'cycle-multiplier', label: '切换加点倍率', enabled: !allocateReason, reason: allocateReason }
    ];
    return {
      ready: preview.ready, unlocked: preview.unlocked, previewOnly: false, phase, phaseLabel: PHASE_LABELS[phase],
      token, preview, current: preview.current, points, multiplier, aptitudes, actions,
      canStartTrial: !startReason, canAbandon: !abandonReason, canReview: !reviewReason,
      canCycleMultiplier: !allocateReason, busy, reason: basicReason,
      trial: { active, enemyLevel: this._number('转世敌人等级'), enemyQi: num(this._local(701957934333375)),
        maxEnemyQi: num(this._local(532652972974783)), enemyAttack: num(this._local(753714719117005)),
        enemyDefense: num(this._local(444720866506387)), playerQi: this._number('真气'), maxPlayerQi: this._number('真气上限'),
        earnedPoints: this._number('获得转世点'), seconds: num(this._local(364532666168145)),
        nativeText: plain(safe(() => this._reincarnationControl('转世进度值').text)) },
      native: { confirm, feature, back, backFeature, background },
      reasons: { start: startReason, abandon: abandonReason, review: reviewReason, allocate: allocateReason }
    };
  };
  proto.getReincarnationSnapshot = function () {
    const { native, reasons, ...snapshot } = this._reincarnationState();
    return snapshot;
  };

  proto._reincarnationLedger = function () {
    // Review all rows that can be lost, including locked and extra-depth
    // inventory data. Hash type/value/order; never publish raw table contents.
    const tables = [['save', 0], ['svwp', null], ['svzb', null], ['svlz', null]];
    let hash1 = 2166136261, hash2 = 2246822519, count = 0;
    const add = text => { for (let i = 0; i < text.length; i++) {
      hash1 = Math.imul(hash1 ^ text.charCodeAt(i), 16777619);
      hash2 = Math.imul(hash2 ^ text.charCodeAt(i), 3266489917);
    } };
    for (const [name, depth] of tables) {
      const table = this._array(name);
      if (!table || ![table.width, table.height, table.depth].every(Number.isSafeInteger)) return null;
      const maxZ = depth === null ? table.depth : 1;
      if (table.width * table.height * maxZ > 1000000) return null;
      add(JSON.stringify([name, table.width, table.height, table.depth]));
      for (let x = 0; x < table.width; x++) for (let y = 0; y < table.height; y++) for (let z = 0; z < maxZ; z++) {
        const cell = this._at(table, x, y, z);
        if (cell === null || cell === undefined || typeof cell === 'number' && !Number.isFinite(cell)) return null;
        add(JSON.stringify([typeof cell, cell])); count++;
      }
    }
    return [hash1 >>> 0, hash2 >>> 0, count].join(':');
  };
  proto._reincarnationReview = function (ownOperation = false) {
    const state = this._reincarnationState(ownOperation);
    const mode = state.native.feature === '确定转世' ? 'normal' :
      ['强行转世', '确定重生'].includes(state.native.feature) ? 'forced' : null;
    const earned = state.trial.earnedPoints, oldPoints = state.points, turns = state.current.turns;
    const ledger = state.canReview ? this._reincarnationLedger() : null;
    const slot = this._number('存档档位');
    const values = [slot, oldPoints, turns, state.current.age, state.current.level, state.current.cycleLevel, earned,
      ...['魂晶', '灵石', '参悟', '年', '月', '丹毒', '丹药寿元', '灵果寿元', '丹药攻击', '丹药真气', '丹药防御',
        ...SKILLS.flatMap(name => [name + '等级', name + '经验']), ...BUILDINGS.map(name => name + '等级')].map(name => this._number(name))];
    const pointsGain = mode === 'normal' && earned !== null ? Math.round(earned) : mode === 'forced' ? 0 : null;
    const reason = state.reasons.review || (!mode ? '原结算方式尚未确定。' :
      !Number.isInteger(slot) || slot < 0 || slot > 4 ? '当前原存档档位尚未确定，不能确认转世。' :
      mode === 'normal' && (!Number.isInteger(state.trial.enemyLevel) || state.trial.enemyLevel < 0) ? '原试练轮回境结果尚未确定。' :
      !known(values) || !ledger ?
      '当前损失资产或结算数据不完整，暂不能确认转世。' :
      mode === 'normal' && (pointsGain === null || pointsGain <= 0) ? '原正常轮回所得尚未确认。' : null);
    const token = !reason ? JSON.stringify(['reincarnation-review-v1', state.token, mode, ledger, values]) : null;
    return { ready: state.ready, canConfirm: !reason, token, mode, pointsGain,
      pointsAfter: known([oldPoints, pointsGain]) ? oldPoints + pointsGain : null,
      turnsAfter: turns === null ? null : turns + 1, cycleLevelAfter: mode === 'normal' ? state.trial.enemyLevel : state.current.cycleLevel,
      preview: state.preview, summary: mode === 'normal' ? (pointsGain === null ? '原试练收益尚未读取，暂不能确认转世。' :
        '正常轮回将获得本次试练' + pointsGain + '点，随后执行列出的个人重置。') :
        mode === 'forced' ? '本次强制重生不新增转世点，原有未花点数保留，仍执行个人重置。' : '尚未到原转世确认阶段。',
      warnings: [...state.preview.warnings, '此确认会真实转世，纳戒及已列资产将清空；请核对当前独立测试存档。'],
      reason };
  };
  proto.getReincarnationReview = function () { return this._reincarnationReview(); };

  proto._reincarnationCheck = function (options, state) {
    if (!options || typeof options.expectedToken !== 'string' || options.expectedToken !== state.token)
      return this._fail('转世状态或待确认内容已经变化，请刷新并重新核对。', { stale: true });
    return null;
  };
  proto._reincarnationRun = async function (work) {
    if (this.busy || this._reincarnationBusy || this._nativeInputBusy) return this._fail('正在处理上一项操作。');
    if (this._layout() !== '主界面' || !this.getReincarnationPreview().ready) return this._fail('请先进入已载入的原游戏存档。');
    this._reincarnationBusy = true; this.busy = true;
    try { return await work(); }
    catch (error) { return this._fail(error?.message || '原转世操作尚未完成，请查看当前状态。'); }
    finally { this._reincarnationBusy = false; this.busy = false; }
  };
  proto._reincarnationOpenPage = async function () {
    if (this._global('分页界面') === '重生' && this._reincarnationControl('重生按钮')) return null;
    if (this._reincarnationForeignModal() || this._reincarnationControl('对话选择框确定') ||
        this._reincarnationControl('转世界面背景')) return this._fail('请先处理当前原游戏提示。');
    const entry = this._reincarnationCommitted('按钮文字').find(instance => this._visible(instance) &&
      safe(() => instance.text) === '转世' && safe(() => instance.instVars.功能) === '转世');
    if (!entry || !this._first('系统菜单背景')) return this._fail('原转世入口尚未显示。');
    // 835 -> 837, same visible-entry/unlock/modal guards. Only native page setup;
    // opening the challenge is never used to inspect this page.
    const old = new Set(this._reincarnationCommitted('重生按钮').map(instance => instance.uid));
    this._call('打开重生分页');
    await this._waitUntil(() => this._global('分页界面') === '重生' &&
      this._reincarnationCommitted('重生按钮').some(instance => !old.has(instance.uid) && this._visible(instance)), 2500);
    return null;
  };
  proto.openReincarnation = function () {
    return this._reincarnationRun(async () => {
      const state = this._reincarnationState(true);
      const action = state.actions.find(item => item.id === 'open');
      if (!action?.enabled) return this._fail(action?.reason || '原转世页面暂不可打开。');
      const opened = await this._reincarnationOpenPage();
      return opened || this._result(true, '已打开原游戏转世与天资页。');
    });
  };
  proto.startReincarnationTrial = function (options = {}) {
    return this._reincarnationRun(async () => {
      let state = this._reincarnationState(true);
      const stale = this._reincarnationCheck(options, state);
      if (stale) return stale;
      if (!state.canStartTrial) return this._fail(state.reasons.start);
      if (state.phase === 'idle') {
        const opened = await this._reincarnationOpenPage();
        if (opened) return opened;
        const button = this._reincarnationControl('重生按钮', null, true);
        if (!button) return this._fail('原转世试练按钮暂不可用。');
        const tapped = await this._nativeTap(button, { blockers: ['遮挡底板上', '遮挡底板下', '筛选背景', '道具tips背景'] });
        if (!tapped?.ok) return tapped || this._fail('原试练按钮未响应。');
        await this._waitUntil(() => Boolean(this._reincarnationControl('对话选择框确定', '开启试练', true)), 2500);
        state = this._reincarnationState(true);
      }
      if (state.phase !== 'start-confirmation' || !state.canStartTrial) return this._fail('原开启试练确认已经变化，请查看当前状态。');
      const button = state.native.confirm;
      const tapped = await this._nativeTap(button, { allowModal: true, allowBlackUses: ['对话框', '转世'], blockers: [] });
      if (!tapped?.ok) return tapped || this._fail('原试练确认未响应。');
      await this._waitUntil(() => this._flag('转世开关') === true ||
        this._reincarnationState(true).phase === 'settlement', 9000);
      return this._result(true, '已由原游戏回满真气并开启转世试练；结束后可放弃或另外核对转世结算。');
    });
  };
  proto.abandonReincarnationTrial = function (options = {}) {
    return this._reincarnationRun(async () => {
      const state = this._reincarnationState(true), stale = this._reincarnationCheck(options, state);
      if (stale) return stale;
      if (!state.canAbandon) return this._fail(state.reasons.abandon);
      const button = ['暂不开启', '放弃转世'].includes(state.native.backFeature) ? state.native.back : state.native.confirm;
      const turns = state.current.turns, points = state.points, beforePhase = state.phase;
      const tapped = await this._nativeTap(button, { allowModal: true, allowBlackUses: ['对话框', '转世'], blockers: [] });
      if (!tapped?.ok) return tapped || this._fail('原放弃按钮未响应。');
      await this._waitUntil(() => !this._reincarnationControl('转世界面背景') &&
        !this._reincarnationControl('对话选择框确定') && this._flag('转世开关') === false &&
        (beforePhase === 'start-confirmation' || this._number('获得转世点') === 0), 4000);
      if (this._number('转世次数') !== turns || this._number('重生值') !== points)
        return this._fail('原角色数据发生了其他变化，请核对当前状态。');
      return this._result(true, beforePhase === 'start-confirmation' ? '已取消开启试练。' : '已放弃本次试练结果，没有执行转世。');
    });
  };
  proto.confirmReincarnation = function (options = {}) {
    return this._reincarnationRun(async () => {
      const review = this._reincarnationReview(true);
      if (options.confirmed !== true) return this._fail('请先核对本次收益与清空明细，再明确确认转世。', { requiresConfirmation: true, review });
      const stale = this._reincarnationCheck(options, review);
      if (stale) return stale;
      if (!review.canConfirm) return this._fail(review.reason);
      if (this._reincarnationUsedReviews?.has(review.token)) return this._fail('这份转世确认已提交，请查看当前原游戏结果。');
      const state = this._reincarnationState(true);
      const button = state.native.confirm;
      if (!button || !isEnabled(button) || (review.mode === 'normal' ? state.native.feature !== '确定转世' :
          !['强行转世', '确定重生'].includes(state.native.feature))) return this._fail('原结算按钮已经变化，请重新核对。');
      const turns = state.current.turns;
      const tapped = await this._nativeTap(button, { allowModal: true, allowBlackUses: ['对话框', '转世'], blockers: [] });
      if (!tapped?.ok) return tapped || this._fail('原转世确认没有接收。');
      (this._reincarnationUsedReviews ??= new Set()).add(review.token);
      await this._waitUntil(() => this._number('转世次数') === turns + 1 &&
        this._number('lv') === 1 && this._number('年龄') === 1, 12000);
      if(this._number('转世次数')!==turns+1||this._number('lv')!==1||this._number('年龄')!==1)return this._fail('转世结果尚未确认，请核对当前状态。');
      this.resetAdventureProgress?.();
      return this._result(true, '已按原游戏规则完成' + (review.mode === 'normal' ? '正常轮回' : '强制重生') + '。', {
        mode: review.mode, pointsGain: review.pointsGain, turns: this._number('转世次数'), snapshot: this.getReincarnationSnapshot()
      });
    });
  };
  proto.cycleAptitudeMultiplier = function (options = {}) {
    return this._reincarnationRun(async () => {
      let state = this._reincarnationState(true);
      const stale = this._reincarnationCheck(options, state);
      if (stale) return stale;
      if (!state.canCycleMultiplier) return this._fail(state.reasons.allocate);
      const opened = await this._reincarnationOpenPage();
      if (opened) return opened;
      const oldMultiplier = state.multiplier;
      state = this._reincarnationState(true);
      if (state.multiplier !== oldMultiplier) return this._fail('原页面已重设加点倍率，请按当前倍率重新确认。', { stale: true });
      const multiplier = state.multiplier, index = MULTIPLIERS.indexOf(multiplier);
      if (index < 0) return this._fail('原天资加点倍率尚未识别。');
      const button = this._reincarnationControl('转世加点倍率', null, true);
      if (!button) return this._fail('原加点倍率按钮暂不可用。');
      const tapped = await this._nativeTap(button, { blockers: ['数字输入背景', '操作屏蔽', '制造物tips背景'] });
      if (!tapped?.ok) return tapped || this._fail('原加点倍率按钮未响应。');
      const expected = MULTIPLIERS[(index + 1) % MULTIPLIERS.length];
      await this._waitUntil(() => num(this._local(116053250214340)) === expected, 2500);
      return this._result(true, '已切换原天资加点倍率。', { multiplier: expected });
    });
  };
  proto.allocateAptitude = function (name, options = {}) {
    return this._reincarnationRun(async () => {
      let state = this._reincarnationState(true);
      const stale = this._reincarnationCheck(options, state);
      if (stale) return stale;
      let aptitude = state.aptitudes.find(item => item.name === name);
      if (!aptitude?.canAllocate) return this._fail(aptitude?.reason || '请选择原五项基础天资。');
      const opened = await this._reincarnationOpenPage();
      if (opened) return opened;
      const oldCost = state.multiplier, oldPoints = state.points, oldValue = aptitude.value;
      state = this._reincarnationState(true);
      aptitude = state.aptitudes.find(item => item.name === name);
      if (state.multiplier !== oldCost || state.points !== oldPoints || aptitude?.value !== oldValue)
        return this._fail('原页面中的天资、转世点或倍率已变化，请重新确认。', { stale: true });
      if (!aptitude?.canAllocate) return this._fail(aptitude?.reason || '原天资状态已经变化。');
      const button = this._reincarnationCommitted('重生加号').find(instance =>
        this._visible(instance) && isEnabled(instance) && safe(() => instance.instVars.用途) === name);
      if (!button) return this._fail('原天资加点按钮暂不可用。');
      const beforePoints = state.points, beforeValue = aptitude.value, cost = state.multiplier;
      const tapped = await this._nativeTap(button, { blockers: ['遮挡底板上', '遮挡底板下', '筛选背景', '道具tips背景'] });
      if (!tapped?.ok) return tapped || this._fail('原天资加点按钮未响应。');
      await this._waitUntil(() => this._number('重生值') === beforePoints - cost &&
        Math.abs(this._number(name) - (beforeValue + 0.1 * cost)) < 1e-8, 3000);
      return this._result(true, '已按原游戏规则增加' + name + '。', { cost, gain: 0.1 * cost, value: this._number(name), points: this._number('重生值') });
    });
  };
})();
