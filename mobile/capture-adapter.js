/* Original Construct manual beast search/capture. Load after game-adapter.js.
 * data.json /project/6/0/1/128/8/12: open 3251; touch guards 3262-3268,
 * 3308-3315; actions 3270/3276/3317/3321; native search 3278-3299;
 * native capture success/failure 3323-3327. Entry unlock: 8995 save[4,18].
 * All results, random rolls, combat and inventory awards belong to that engine.
 * Snapshot is read-only, including labels/skill checks; no gameplay setters or RNG calls.
 */
(() => {
  'use strict';
  if (!window.GameAdapter) throw new Error('Capture adapter requires GameAdapter.');
  const proto = window.GameAdapter.prototype;
  const PROGRESS_SID = 931763614376518;
  const OBJECTS = { 二级菜单按钮文字: 27, 捕兽按钮文字: 1048, 捕兽搜索按钮文字: 1050,
    筛选按钮2: 336, 筛选按钮文字2: 339, 筛选选项文字2: 338, 筛选背景2: 340,
    遮挡底板上: 510, 遮挡底板下: 512, 黑幕: 509, 道具tips背景: 52, 筛选背景3: 346 };
  // Exact return labels of original 稀有计算 / 大阶转换 / 历练兽等级转换.
  const RARITY = [null, '普通', '强壮', '稀有', '变异', '通灵', '圣体'];
  const GRADE = [null, '凡', '灵', '玄', '仙', '神'];
  const EVOLUTION = ['普', '恶', '邪', '魔', '幻', '灭'];
  // Original options 4095 and assignments 3333-3338; no 普通(1) option.
  const CAPTURE_CHOICES = [
    { value: 0, label: '未开启', rawText: '未开启' },
    { value: 2, label: '强壮', rawText: '[color=lightgreen]强壮' },
    { value: 3, label: '稀有', rawText: '[color=lightblue]稀有' },
    { value: 4, label: '变异', rawText: '[color=Fuchsia]变异' },
    { value: 5, label: '通灵', rawText: '[color=orange]通灵' },
    { value: 6, label: '圣体', rawText: '[color=red]圣体' }
  ];
  const safe = (fn, fallback = null) => { try { return fn() ?? fallback; } catch { return fallback; } };
  const num = value => {
    if (typeof value !== 'number' && !(typeof value === 'string' && value.trim() !== '')) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const plain = value => typeof value === 'string' ? value.replace(/\[\/?(?:color|size|b|i|u|s|font|outline|shadow|stroke|background)(?:=[^\]]*)?\]/gi, '') : null;
  const skillRequired = id => Number.isInteger(id) && id >= 0 ? Math.max(1, Math.round(id * 0.75)) : null;
  // Source global function 184 (/project/6/1/1/129/8/77) is exactly clamp(round(id*.75),1,Infinity).
  const percent = value => value === null ? null : Math.max(0, Math.min(100, value));
  const enabled = instance => {
    const flag = safe(() => instance.instVars.开关);
    return flag !== null && Boolean(flag);
  };

  proto._captureData = function () {
    const ll = this._array('ll'), save = this._array('save');
    const ready = Boolean(this._layout() === '主界面' && this._dataReady() &&
      ll && ll.width > 1 && ll.height >= 12 && ll.depth >= 1 &&
      save && save.width >= ll.width && save.height >= 29 && save.depth >= 1);
    return { ll, save, ready };
  };

  proto._captureCommitted = function (name) {
    // getAllInstances also exposes pending-create objects (runtime:1610), whereas
    // source event expressions operate on committed instances (2610/2841/3230).
    const objectClass = safe(() => this._engine().GetObjectClassByIndex(OBJECTS[name]));
    if (safe(() => objectClass.GetName()) === name) {
      return safe(() => objectClass.GetInstances().map(instance => instance.GetInterfaceClass()), []);
    }
    return safe(() => this.runtime.objects[name].getPickedInstances(), []);
  };

  proto._captureModal = function () {
    return this._blocked() || this._instances('筛选背景').some(instance => this._visible(instance));
  };

  proto._captureGuard = function (ownOperation = false) {
    if (!ownOperation) {
      const guarded = this._guard();
      if (guarded) return guarded;
      if (this._captureBusy) return this._fail('正在处理上一项捕兽操作。');
    } else if (this._layout() !== '主界面') return this._fail('请先进入游戏。');
    if (this._captureModal()) return this._fail('请先关闭原游戏中的对话框或筛选窗口。');
    const { ready, save } = this._captureData();
    if (!ready) return this._fail('原捕兽数据尚未载入。');
    if (num(this._at(save, 4, 18)) !== 1) return this._fail('完成原主线首次渡劫教学后才能捕兽。');
    const strategy = this._global('捕兽策略');
    if (strategy === null) return this._fail('原捕兽策略尚未载入。');
    if (!CAPTURE_CHOICES.some(choice => choice.rawText === strategy)) return this._fail('原捕兽策略尚未识别，请在原界面检查。',
      { requiresOriginal: true, feature: 'capture-strategy' });
    return null;
  };

  proto._captureButton = function (name, expectedText) {
    return this._captureCommitted(name).find(instance => this._visible(instance) && enabled(instance) &&
      safe(() => instance.text) === expectedText) ?? null;
  };

  proto._captureCovered = function (button, blockers = ['黑幕', '遮挡底板上', '遮挡底板下']) {
    const x = num(safe(() => button.x)), y = num(safe(() => button.y));
    if (x === null || y === null) return true;
    const cssPoint = safe(() => button.layer.layerToCssPx(x, y));
    // Source Touch handlers reject touches on upper/lower blockers, not every
    // page that contains those permanent objects. Touch.IsTouchingObject (4206)
    // checks viewport/interactivity, not object visibility. Convert the button
    // centre across layers (ILayer layerToCssPx/cssPxToLayer, 1640-1641).
    return blockers.some(name => this._captureCommitted(name).some(instance => {
      if (safe(() => instance.layer.isSelfAndParentsInteractive, true) === false) return false;
      const box = safe(() => instance.getBoundingBox());
      const viewport = safe(() => instance.layer.getViewport());
      if (!box || viewport && (box.right <= viewport.left || box.left >= viewport.right ||
          box.bottom <= viewport.top || box.top >= viewport.bottom)) return false;
      const point = cssPoint ? safe(() => instance.layer.cssPxToLayer(...cssPoint)) : null;
      const [px, py] = point ?? [x, y];
      return px >= box.left && px <= box.right && py >= box.top && py <= box.bottom;
    }));
  };

  proto._captureCandidates = function (ll, save, level) {
    if (!ll || !save || level === null) return null;
    let maximum = 0;
    const observed = [];
    for (let id = 0; id < ll.width; id++) {
      const rawWins = num(this._at(save, id, 4));
      if (rawWins === null) return null;
      if (rawWins >= 1) { maximum = id; observed.push(id); }
    }
    // 3283-3286: same candidate range as native 最大搜兽编号(0), including
    // its strict requirement(max(maximum-20,1)) < skill comparison. No weights/RNG.
    const recentOnly = skillRequired(Math.max(maximum - 20, 1)) < level;
    return observed.filter(id => skillRequired(id) <= level && (!recentOnly || id >= maximum - 20));
  };

  proto._captureEnsurePage = async function () {
    const onPage = this._global('主页界面') === '捕兽';
    if (onPage && this._captureCommitted('捕兽搜索按钮文字').some(i => this._visible(i)) &&
        this._captureCommitted('捕兽按钮文字').some(i => this._visible(i))) return null;
    const findEntry = () => this._captureCommitted('二级菜单按钮文字').find(instance =>
      this._visible(instance) && safe(() => instance.text) === '捕兽' &&
      safe(() => instance.instVars.功能) === '捕兽');
    let entry = findEntry();
    if (!entry) {
      this._call('打开历练二级菜单');
      await this._waitUntil(() => Boolean(findEntry()), 1500);
      entry = findEntry();
    }
    if (!entry || !enabled(entry)) return this._fail('原捕兽入口按钮暂不可用。');
    if (this._captureCovered(entry, ['黑幕'])) return this._fail('原捕兽入口被黑幕遮挡。');
    if (this._captureModal()) return this._fail('请先关闭原游戏中的对话框或筛选窗口。');
    this._call('打开捕兽系统', 1); // One mandatory original parameter.
    const names = ['捕兽搜索按钮文字', '捕兽按钮文字'];
    const created = names.map(name => this._instances(name).at(-1));
    if (created.some(instance => !instance)) return this._fail('原捕兽界面尚未建立。');
    await this._waitUntil(() => names.every((name, index) => this._captureCommitted(name).some(instance =>
      safe(() => instance.uid) === safe(() => created[index].uid) && this._visible(instance))), 1500);
    return null;
  };

  proto.getCaptureSnapshot = function () {
    const { ll, save, ready } = this._captureData();
    const unlockFlag = ready ? num(this._at(save, 4, 18)) : null;
    const unlocked = unlockFlag === null ? null : unlockFlag === 1;
    const searching = this._flag('搜索开关'), capturing = this._flag('捕兽开关');
    const rawProgress = num(this._local(PROGRESS_SID));
    const skill = this._number('驭兽等级');
    const targetId = this._number('捕兽结果编号');
    const strategy = this._global('捕兽策略');
    const manualMode = strategy === null ? null : strategy === '未开启';
    const blocked = this._captureModal(), busy = Boolean(this.busy || this._captureBusy);
    const candidates = ready ? this._captureCandidates(ll, save, skill) : null;
    let target = null;
    if (ready && Number.isInteger(targetId) && targetId > 0 && targetId < ll.width) {
      const name = plain(this._at(ll, targetId, 1));
      const speciesId = num(this._at(ll, targetId, 2));
      const world = num(this._at(ll, targetId, 3));
      const realmTier = num(this._at(ll, targetId, 11));
      const realmName = realmTier === null ? null : plain(this._at(this._array('dj'), realmTier * 10, 1));
      const rarity = this._number('捕兽结果稀有');
      const evolutionLevel = num(this._at(save, targetId, 28));
      const evolutionLabel = EVOLUTION[evolutionLevel] ?? null;
      const requiredSkill = skillRequired(targetId);
      target = {
        id: targetId, name, displayName: name && evolutionLabel ? `${evolutionLabel}·${name}` : name,
        realm: realmName === null ? null : `${realmName.slice(0, 2)}境`, realmTier,
        grade: GRADE[world] ? `${GRADE[world]}兽` : null,
        species: speciesId === null ? null : plain(this._at(this._array('xm'), speciesId, 1)), speciesId,
        rarity, rarityLabel: RARITY[rarity] ?? null, evolutionLevel, evolutionLabel,
        qi: this._number('捕兽敌人真气'), maxQi: this._number('捕兽敌人真气上限'),
        attack: this._number('捕兽敌人攻击'), defense: this._number('捕兽敌人防御'),
        aptitudes: { qi: this._number('捕兽敌人真气资质'), attack: this._number('捕兽敌人攻击资质'),
          defense: this._number('捕兽敌人防御资质') },
        requiredSkill, skillReady: skill === null || requiredSkill === null ? null : skill >= requiredSkill
      };
    }
    const unlockReason = !ready ? '原捕兽数据尚未载入。' : unlocked === true ? null :
      '先完成原主线首次渡劫教学，并继续剧情解锁捕兽。';
    const common = unlockReason || (manualMode === null ? '原捕兽策略尚未载入。' :
      !CAPTURE_CHOICES.some(choice => choice.rawText === strategy) ? '原捕兽策略尚未识别，请在原界面检查。' :
      blocked ? '请先关闭原游戏中的对话框或筛选窗口。' : busy ? '正在处理上一项操作。' : null);
    const searchReason = common || (searching === null || capturing === null ? '原行为状态尚未载入。' :
      searching ? '正在搜索灵兽。' : capturing ? '请先停止当前捕兽。' :
      manualMode === false && !target ? '请先关闭自动策略，手动搜索目标灵兽。' :
      candidates === null ? '原搜索候选尚未确定。' : candidates.length === 0 ?
      '当前没有满足原历练记录和驭兽技艺的搜索候选。' : null);
    const captureReason = common || (searching === null || capturing === null ? '原行为状态尚未载入。' :
      searching ? '请等待搜索完成。' : capturing ? '正在捕捉灵兽。' : !target ? '请先搜索发现灵兽。' :
      target.skillReady !== true ? `需要驭兽技艺${target.requiredSkill ?? '相应'}级。` :
      target.qi === null || target.maxQi === null || target.maxQi <= 0 ? '原目标战斗状态尚未准备完成。' : null);
    const stopReason = common || (searching === null || capturing === null ? '原行为状态尚未载入。' :
      searching !== true && capturing !== true ? '当前没有进行搜索或捕兽。' : null);
    const messages = this._instances('记录文字').map(instance => ({
      id: safe(() => instance.uid), rawText: safe(() => instance.text), y: num(safe(() => instance.y))
    })).filter(entry => typeof entry.rawText === 'string' && /捕兽|捕捉|成功搜捕|发现/.test(entry.rawText))
      .sort((a, b) => (b.y ?? 0) - (a.y ?? 0)).slice(0, 12)
      .map(({ id, rawText }) => ({ id, rawText, text: plain(rawText) }));
    return {
      ready, unlocked, unlockFlag, unlockReason, searching, capturing,
      progress: percent(rawProgress), rawProgress, target,
      skill: { level: skill, required: target?.requiredSkill ?? null },
      battle: { active: capturing, enemyQi: target?.qi ?? null, maxEnemyQi: target?.maxQi ?? null,
        attack: target?.attack ?? null, defense: target?.defense ?? null,
        playerQi: this._number('真气'), maxPlayerQi: this._number('真气上限'),
        playerAttack: this._number('攻击'), playerDefense: this._number('防御') },
      canSearch: searchReason === null, canCapture: captureReason === null, canStop: stopReason === null,
      canStopSearch: stopReason === null && searching === true, canStopCapture: stopReason === null && capturing === true,
      blocked, busy, paused: this._flag('游戏暂停'), searchStrategy: strategy, manualMode,
      candidateCount: candidates?.length ?? null, searchReason, captureReason, stopReason,
      messages, logs: messages.map(entry => entry.text),
      originalControls: []
    };
  };

  proto._captureSettings = function (ownOperation = false) {
    const { ready, save, ll } = this._captureData();
    const unlocked = ready ? num(this._at(save, 4, 18)) === 1 : null;
    const strategy = this._global('捕兽策略');
    const minimumRarity = this._number('捕兽目标品质');
    const targetId = this._number('捕兽目标编号');
    const resultId = this._number('捕兽结果编号');
    const searching = this._flag('搜索开关'), capturing = this._flag('捕兽开关');
    const selected = CAPTURE_CHOICES.find(choice => choice.rawText === strategy);
    const automatic = selected ? selected.value !== 0 : null;
    // A re-searched beast of the same species can have different aptitudes.
    // Include its real result values in the confirmation token, not just its ID.
    const resultFingerprint = JSON.stringify([resultId, this._number('捕兽结果稀有'),
      this._number('捕兽敌人真气上限'), this._number('捕兽敌人攻击'), this._number('捕兽敌人防御'),
      this._number('捕兽敌人真气资质'), this._number('捕兽敌人攻击资质'), this._number('捕兽敌人防御资质')]);
    const token = ready ? JSON.stringify([this._number('存档档位'), unlocked, strategy,
      minimumRarity, targetId, searching, capturing, resultFingerprint]) : null;
    const reason = !ready ? '原捕兽数据尚未载入。' : !unlocked ? '请先完成主线教学，解锁捕兽。' :
      !selected || minimumRarity === null || targetId === null ? '原捕兽策略尚未载入或未识别。' :
      this._captureModal() ? '请先关闭原游戏中的对话框或筛选窗口。' :
      !ownOperation && (this.busy || this._captureBusy || this._nativeInputBusy) ? '正在处理上一项操作。' :
      searching === null || capturing === null ? '原捕兽行为状态尚未载入。' :
      searching || capturing ? '请先停止搜索或捕兽，再调整自动搜索品质。' :
      !Number.isInteger(resultId) || resultId <= 0 || resultId >= ll.width ?
        '请先手动搜索出目标灵兽，再设置自动搜索品质。' :
      typeof this._nativeTap !== 'function' ? '原控件输入尚未准备完成。' : null;
    return {
      ready, unlocked, strategy, strategyLabel: plain(strategy), selectedValue: selected?.value ?? null,
      minimumRarity, automatic, targetId,
      targetName: ready && targetId > 0 ? plain(this._at(ll, targetId, 1)) : null,
      resultId, resultName: ready && resultId > 0 ? plain(this._at(ll, resultId, 1)) : null,
      resultFingerprint, searching, capturing, canConfigure: reason === null, reason, token,
      choices: CAPTURE_CHOICES.map(choice => ({ ...choice, enabled: reason === null,
        selected: selected?.value === choice.value, reason })),
      semantics: '再次搜索会锁定当前已发现的同种灵兽；稀有度达到所选档位即停止，之后须手动捕捉。',
      // Original 自动存档 has no writes of these transient capture globals; do
      // not promise persistence, cache them in DOM storage, or reapply on load.
      persistence: 'original-runtime',
      persistenceNote: '策略和搜索目标按原游戏当前运行状态保留；读档后读取原值，不自动重设或继续搜索。',
      diagnostics: {
        last: this._captureSettingsDiagnostics ?? null,
        buttons: this._captureCommitted('筛选按钮2').filter(instance =>
          safe(() => instance.instVars.用途) === '捕兽策略').map(instance => ({
            uid: instance.uid, enabled: enabled(instance), expanded: safe(() => instance.instVars.展开标识),
            visible: this._visible(instance) })),
        options: this._captureCommitted('筛选选项文字2').filter(instance =>
          safe(() => instance.instVars.用途) === '捕兽策略').map(instance => ({
            uid: instance.uid, text: safe(() => instance.text), enabled: enabled(instance), visible: this._visible(instance) }))
      }
    };
  };
  proto.getCaptureSettingsSnapshot = function () { return this._captureSettings(); };

  proto.configureCaptureSettings = async function (settings = {}) {
    if (!settings || typeof settings !== 'object') return this._fail('请选择原游戏支持的自动搜索品质。');
    const guarded = this._captureGuard();
    if (guarded) return guarded;
    const before = this._captureSettings();
    const choice = CAPTURE_CHOICES.find(item => item.value === settings.minimumRarity);
    if (!choice) return this._fail('请选择原游戏支持的自动搜索品质。');
    if (settings.expectedToken !== undefined && settings.expectedToken !== before.token)
      return this._fail('捕兽目标或策略已经变化，请刷新后重新确认。', { stale: true });
    // Idempotent no-op is allowed even without a discovered beast. It sends no
    // input and never pretends to have changed an unavailable original control.
    if (before.strategy === choice.rawText && before.minimumRarity === choice.value)
      return this._result(true, '自动搜索设置已经是该选项。', { changed: false, settings: before });
    if (!before.canConfigure) return this._fail(before.reason);
    this._captureBusy = true;
    this.busy = true;
    let openedByUs = false, selectionSent = false;
    try {
      const opened = await this._captureEnsurePage();
      if (opened) return opened;
      const current = this._captureSettings(true);
      if (!current.canConfigure) return this._fail(current.reason);
      if (current.token !== before.token) return this._fail('捕兽目标或策略已经变化，请重新确认。', { stale: true });
      const getButton = () => this._captureCommitted('筛选按钮2').find(instance =>
        this._visible(instance) && safe(() => instance.instVars.用途) === '捕兽策略');
      const getOption = () => this._captureCommitted('筛选选项文字2').find(instance =>
        this._visible(instance) && enabled(instance) && safe(() => instance.instVars.用途) === '捕兽策略' &&
        safe(() => instance.text) === choice.rawText);
      const button = getButton();
      if (!button) return this._fail('原自动搜索设置按钮尚未就绪。');
      if (safe(() => button.instVars.展开标识) !== true && safe(() => button.instVars.展开标识) !== 1) {
        if (!enabled(button)) return this._fail('原自动搜索设置按钮暂不可用。');
        // 4089 checks idle state; using the actual control also preserves its
        // native open switch and any source permissions/outer event conditions.
        const tapped = await this._nativeTap(button, { allowModal: false,
          blockers: ['遮挡底板上', '遮挡底板下', '筛选背景3'] });
        if (!tapped?.ok) return tapped || this._fail('原自动搜索设置未打开。');
        openedByUs = true;
      }
      await this._waitUntil(() => Boolean(getOption()), 2200);
      const recheck = this._captureSettings(true);
      if (!recheck.canConfigure) return this._fail(recheck.reason);
      if (recheck.token !== before.token) return this._fail('捕兽目标或策略已经变化，请重新确认。', { stale: true });
      const option = getOption();
      const currentButton = getButton();
      this._captureSettingsDiagnostics = { stage: 'option-ready', buttonUid: button.uid,
        currentButtonUid: currentButton?.uid ?? null, parentEnabled: currentButton ? enabled(currentButton) : null,
        expanded: safe(() => currentButton.instVars.展开标识), optionUid: option?.uid ?? null };
      // 4089 locks the expand button until its WaitForPreviousActions completes.
      // Selection 3329-3331 checks ONLY the option's own switch/usage/blockers;
      // an expanded parent's temporary switch=0 must not disable valid options.
      if (!option || currentButton?.uid !== button.uid) return this._fail('原自动搜索选项已经变化，请重试。');
      // No named setter exists: event 3331 reads this real option's Text after
      // its native wait, sets both strategy/threshold, then closes the popup.
      const tapped = await this._nativeTap(option, { allowModal: true,
        blockers: ['遮挡底板上', '遮挡底板下', '筛选背景3', '道具tips背景'] });
      if (!tapped?.ok) return tapped || this._fail('原自动搜索设置未接收。');
      selectionSent = true;
      this._captureSettingsDiagnostics = { ...this._captureSettingsDiagnostics, stage: 'option-input' };
      await this._waitUntil(() => this._global('捕兽策略') === choice.rawText &&
        this._number('捕兽目标品质') === choice.value &&
        !this._captureCommitted('筛选选项文字2').some(instance =>
          safe(() => instance.instVars.用途) === '捕兽策略'), 2400);
      const after = this._captureSettings(true);
      if (after.resultFingerprint !== before.resultFingerprint || after.searching !== false || after.capturing !== false)
        return this._fail('设置期间原捕兽目标或行为发生变化，请检查当前状态。', { settings: after });
      this._captureSettingsDiagnostics = { ...this._captureSettingsDiagnostics, stage: 'confirmed' };
      return this._result(true, choice.value === 0 ? '已关闭原游戏自动搜索策略。' :
        '已设置自动搜索' + choice.label + '及以上；再次搜索后由原游戏筛选同种目标。',
        { changed: true, settings: after });
    } catch (error) {
      return this._fail(error?.message || '原自动搜索设置尚未完成，请稍后查看。');
    } finally {
      // Do not destroy an option while its original delayed selection event is
      // still pending; that event owns normal close/reset after a sent selection.
      if (openedByUs && !selectionSent) safe(() => this._call('筛选选项关闭2'));
      this._captureBusy = false;
      this.busy = false;
    }
  };

  proto._runCaptureAction = async function (action) {
    const guarded = this._captureGuard();
    if (guarded) return guarded;
    const before = this.getCaptureSnapshot();
    if (before.searching === null || before.capturing === null) return this._fail('原捕兽行为状态尚未载入。');
    if (action === 'search' && !before.canSearch) return this._fail(before.searchReason);
    if (action === 'capture' && !before.canCapture) return this._fail(before.captureReason);
    if (action === 'stop-search' && before.searching !== true) return this._result(true, '当前没有进行搜索。');
    if (action === 'stop-capture' && before.capturing !== true) return this._result(true, '当前没有进行捕兽。');
    this._captureBusy = true;
    this.busy = true;
    try {
      const opened = await this._captureEnsurePage();
      if (opened) return opened;
      const recheck = this._captureGuard(true);
      if (recheck) return recheck;
      if (action === 'open') return this._result(true, '已打开原游戏捕兽界面。');
      const searchingAction = action === 'search' || action === 'stop-search';
      const buttonName = searchingAction ? '捕兽搜索按钮文字' : '捕兽按钮文字';
      const expected = action.startsWith('stop-') ? '停止' : searchingAction ? '搜索' : '捕兽';
      // Page creation uses initial button text. A native tick restores 停止 for active
      // search/capture (3278/3323). Never fake that text/instance switch here.
      const stopping = action.startsWith('stop-');
      const activeFlag = searchingAction ? '搜索开关' : '捕兽开关';
      await this._waitUntil(() => Boolean(this._captureButton(buttonName, expected)) ||
        stopping && this._flag(activeFlag) === false, 1500);
      const finalGuard = this._captureGuard(true);
      if (finalGuard) return finalGuard;
      if (stopping && this._flag(activeFlag) === false) return this._result(true,
        searchingAction ? '搜索已由原游戏结束。' : '捕兽已由原游戏结束。');
      const button = this._captureButton(buttonName, expected);
      if (!button || this._captureCovered(button)) return this._fail('原捕兽按钮当前被遮挡或不可用。');
      if (action === 'search') {
        const state = this.getCaptureSnapshot();
        if (state.searching === true || state.capturing === true || !state.candidateCount ||
            state.manualMode === false && !state.target) return this._fail('原搜索条件或自动搜索目标已经改变，请刷新后重试。');
        this._call('开始搜索');
        return this._flag('搜索开关') === true ? this._result(true,
          state.manualMode ? '已开始原游戏手动搜索。' : '已开始原游戏自动搜索；达到同种目标品质后会停止，仍须手动捕捉。') : this._fail('原游戏未开始搜索。');
      }
      if (action === 'stop-search') {
        if (this._global('捕兽策略') !== '未开启') {
          if (typeof this._nativeTap !== 'function') return this._fail('原控件输入尚未准备完成，暂不能停止自动搜索。');
          // 3267 resets strategy/target in the outer button event, not inside
          // the named 停止搜索 function. Send native input for that whole flow.
          const tapped = await this._nativeTap(button, { allowModal: false,
            blockers: ['遮挡底板上', '遮挡底板下'] });
          if (!tapped?.ok) return tapped || this._fail('原停止搜索按钮尚未响应。');
          await this._waitUntil(() => this._flag('搜索开关') === false &&
            this._global('捕兽策略') === '未开启' && this._number('捕兽目标品质') === 0 &&
            this._number('捕兽目标编号') === 0, 2400);
          return this._result(true, '已停止原游戏自动搜索并关闭本次策略。');
        }
        this._call('停止搜索');
        return this._flag('搜索开关') === false ? this._result(true, '已停止搜索。') : this._fail('原游戏尚未停止搜索。');
      }
      if (action === 'capture') {
        const state = this.getCaptureSnapshot();
        if (!state.target || state.searching === true || state.capturing === true || state.target.skillReady !== true ||
            state.target.maxQi === null || state.target.maxQi <= 0) return this._fail('原捕兽目标或技艺条件已经改变。');
        this._call('开始捕兽');
        return this._flag('捕兽开关') === true ? this._result(true, '已开始原游戏捕兽战斗。') : this._fail('原游戏未开始捕兽。');
      }
      this._call('停止捕兽');
      return this._flag('捕兽开关') === false ? this._result(true, '已停止捕兽。') : this._fail('原游戏尚未停止捕兽。');
    } catch (error) { return this._fail(error.message || '原捕兽操作尚未完成。'); }
    finally { this._captureBusy = false; this.busy = false; }
  };
  proto.openCapture = function () { return this._runCaptureAction('open'); };
  proto.startBeastSearch = function () { return this._runCaptureAction('search'); };
  proto.stopBeastSearch = function () { return this._runCaptureAction('stop-search'); };
  proto.startBeastCapture = function () { return this._runCaptureAction('capture'); };
  proto.stopBeastCapture = function () { return this._runCaptureAction('stop-capture'); };
})();
