/* Real Construct alchemy/smithing controls. Load after game-adapter.js.
 * Evidence: data.json /project/6/0/1/128/8/8 (events 2723-2830, alchemy),
 * /project/6/0/1/128/8/9 (2831-2921, smithing),
 * /project/6/0/1/129/8/5/8/0 (9019/9021: save[9/10,18] entry unlock).
 * The engine owns timers, quality rolls, ingredients, experience and products.
 * This bridge never assigns globalVars, instance variables, or array cells.
 */
(() => {
  'use strict';
  if (!window.GameAdapter) throw new Error('Crafting adapter requires GameAdapter.');
  const proto = window.GameAdapter.prototype;
  const CONFIG = {
    alchemy: {
      kind: 'alchemy', name: '炼丹', array: 'ld', height: 14, unlock: 9, learned: 13, mastery: 14,
      tierColumn: 11, monthsColumn: 12, experienceColumn: 13, skillStep: 15,
      card: '炼丹丹方背景', button: '炼丹按钮文字', preview: '炼丹预计药效',
      progressSid: 296577065437233, categorySid: 524407073341850, qualitySid: 237298430529705,
      categorySpan: 1, recipeType: '丹方'
    },
    smithing: {
      kind: 'smithing', name: '炼器', array: 'lq', height: 9, unlock: 10, learned: 15, mastery: 16,
      tierColumn: 3, monthsColumn: 5, experienceColumn: 6, skillStep: 5,
      card: '炼器丹方背景2', button: '炼器按钮文字2', preview: '炼器预计药效2',
      progressSid: 525801625096457, categorySid: 887711505792967, qualitySid: 448207369156832,
      categorySpan: 3, recipeType: '器方'
    }
  };
  const safe = (fn, fallback = null) => { try { return fn() ?? fallback; } catch { return fallback; } };
  const num = value => {
    if (typeof value !== 'number' && !(typeof value === 'string' && value.trim() !== '')) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const config = kind => CONFIG[kind] ?? null;
  const visible = instance => Boolean(instance && safe(() => instance.isVisible, false) === true &&
    safe(() => instance.layer.isSelfAndParentsVisible, true) !== false);
  const enabled = instance => {
    const flag = safe(() => instance.instVars.开关);
    return flag !== null && Boolean(flag);
  };
  const plain = value => typeof value === 'string' ? value.replace(/\[\/?(?:color|size|b|i|u)(?:=[^\]]*)?\]/gi, '') : null;

  proto._craftingData = function (cfg) {
    const definitions = cfg && this._array(cfg.array);
    const save = this._array('save');
    const resources = this._array('zy');
    const ready = Boolean(cfg && this._layout() === '主界面' && this._dataReady() &&
      definitions && definitions.width > 1 && definitions.height >= cfg.height &&
      save && save.height >= 19 && resources && resources.height >= 4);
    return { definitions, save, resources, ready };
  };

  proto._craftingButton = function (cfg) {
    return this._instances(cfg.button).find(visible) ?? null;
  };

  proto._craftingCard = function (cfg, id) {
    // Recipe cards are only created for learned recipes in the original selected tier group.
    // All cards may be scrolled into view; viewport position is not a recipe unlock.
    return this._instances(cfg.card).find(instance => visible(instance) &&
      num(safe(() => instance.instVars.丹药编号)) === id) ?? null;
  };

  proto._craftingGuard = function (cfg) {
    const guard = this._guard();
    if (guard) return guard;
    if (!cfg) return this._fail('请选择炼丹或炼器。');
    const { ready, save } = this._craftingData(cfg);
    if (!ready) return this._fail('炼制数据尚未载入。');
    if (num(this._at(save, cfg.unlock, 18)) !== 1) return this._fail(`${cfg.name}尚未在原游戏主线中解锁。`);
    return null;
  };

  proto._craftingEnsurePage = function (cfg, force = false) {
    if (!force && this._global('主页界面') === cfg.name && this._craftingButton(cfg)) return null;
    let entry = this._instances('二级菜单按钮文字').find(instance => visible(instance) &&
      safe(() => instance.instVars.功能) === cfg.name);
    if (!entry) {
      this._call('打开技艺二级菜单');
      entry = this._instances('二级菜单按钮文字').find(instance => visible(instance) &&
        safe(() => instance.instVars.功能) === cfg.name);
    }
    if (!entry || !enabled(entry)) return this._fail(`原游戏中的${cfg.name}入口暂不可用。`);
    // Both formal parameters are required by the public Construct callFunction API.
    this._call(`打开${cfg.name}系统`, 1, 0);
    if (!this._craftingButton(cfg)) return this._fail(`原游戏${cfg.name}界面尚未准备完成。`);
    return null;
  };

  proto._craftingRecipe = function (cfg, id) {
    const { definitions, save, resources } = this._craftingData(cfg);
    if (!Number.isInteger(id) || !definitions || id < 1 || id >= definitions.width) return null;
    const name = this._at(definitions, id, 1);
    if (typeof name !== 'string' || !name) return null;
    const tier = num(this._at(definitions, id, cfg.tierColumn));
    const learnedFlag = num(this._at(save, id, cfg.learned));
    const learned = learnedFlag === null ? null : learnedFlag === 1;
    const multiplier = this._number(`${cfg.name}材料倍率`);
    const level = this._number(`${cfg.name}等级`);
    const requiredSkill = tier === null ? null : (tier - 1) * cfg.skillStep;
    const mastery = num(this._at(save, id, cfg.mastery));
    const selectedCategory = num(this._local(cfg.categorySid));
    const materials = [];
    const material = (resourceId, resourceColumn, countColumn) => {
      const materialName = this._at(resources, resourceId, resourceColumn);
      const baseCount = num(this._at(definitions, id, countColumn));
      const count = baseCount === null || multiplier === null ? null : baseCount * multiplier;
      // Same inventory query as original start and completion checks, not a guessed stack sum.
      const owned = typeof materialName === 'string' && materialName ? this._formula('道具数量', materialName) : null;
      materials.push({ name: typeof materialName === 'string' ? materialName : null,
        resourceId, baseCount, count, owned, enough: count === null || owned === null ? null : owned >= count });
    };
    if (cfg.kind === 'alchemy') {
      // Events 2750-2752/2768-2770: ld[5,7,9] herb references, quantities [6,8,10].
      for (const column of [5, 7, 9]) {
        const resourceId = num(this._at(definitions, id, column));
        if (resourceId !== null && resourceId !== 0) material(resourceId, 1, column + 1);
      }
    } else if (tier !== null) {
      // Events 2857/2876-2877: zy[tier,2] metal and zy[tier,3] nucleus.
      material(tier, 2, 7);
      material(tier, 3, 8);
    }
    const skillReady = requiredSkill === null || level === null ? null : level >= requiredSkill;
    const materialsReady = materials.length === 0 || materials.some(item => item.enough === null) ? null :
      materials.every(item => item.enough);
    const inCurrentCategory = tier === null || selectedCategory === null ? null :
      tier >= selectedCategory && tier < selectedCategory + cfg.categorySpan;
    const active = this._flag(`${cfg.name}开关`);
    const unlocked = num(this._at(save, cfg.unlock, 18)) === 1;
    return {
      id, name, tier, category: this._at(definitions, id, 2), learned, learnedFlag,
      mastery, masteryLevel: mastery === null ? null : this._formula('熟练等级', mastery),
      months: num(this._at(definitions, id, cfg.monthsColumn)),
      baseExperience: num(this._at(definitions, id, cfg.experienceColumn)),
      requiredSkill, skillReady, materials, materialsReady, inCurrentCategory,
      selectable: Boolean(unlocked && learned && inCurrentCategory && active === false && !this._blocked() && !this.busy),
      canStart: Boolean(unlocked && learned && inCurrentCategory && active === false && skillReady &&
        materialsReady && !this._blocked() && !this.busy)
    };
  };

  proto.getCraftingSnapshot = function (kind = 'alchemy') {
    const cfg = config(kind);
    if (!cfg) return { ready: false, kind, recipes: [], message: '请选择炼丹或炼器。' };
    const { definitions, save, ready } = this._craftingData(cfg);
    const active = this._flag(`${cfg.name}开关`);
    const activeId = this._number(`${cfg.name}编号`);
    const button = this._craftingButton(cfg);
    const currentId = num(safe(() => button.instVars.修炼等级));
    const hintedId = this._craftingSelection?.[kind];
    const recipes = [];
    if (ready) for (let id = 1; id < definitions.width; id++) {
      const recipe = this._craftingRecipe(cfg, id);
      if (recipe) recipes.push(recipe);
    }
    const activeRecipe = recipes.find(recipe => recipe.id === activeId) ?? null;
    const selectedId = active === true ? activeId : currentId ?? hintedId ??
      recipes.find(recipe => recipe.learned && recipe.inCurrentCategory)?.id ?? null;
    const selectedRecipe = recipes.find(recipe => recipe.id === selectedId) ?? null;
    const rawProgress = num(this._local(cfg.progressSid));
    const progress = rawProgress === null ? null : Math.max(0, Math.min(100, rawProgress));
    const months = activeRecipe?.months;
    const messages = this._instances('记录文字')
      .map(instance => ({ id: safe(() => instance.uid), rawText: safe(() => instance.text), y: num(safe(() => instance.y)) }))
      .filter(entry => typeof entry.rawText === 'string' && /炼出|炼丹|炼器|所需材料不足/.test(entry.rawText))
      .sort((a, b) => (b.y ?? 0) - (a.y ?? 0)).slice(0, 10)
      .map(({ id, rawText }) => ({ id, text: plain(rawText), rawText }));
    return {
      ready, kind, name: cfg.name,
      unlocked: ready ? num(this._at(save, cfg.unlock, 18)) === 1 : null,
      unlockFlag: ready ? num(this._at(save, cfg.unlock, 18)) : null,
      skill: { level: this._number(`${cfg.name}等级`), experience: this._number(`${cfg.name}经验`) },
      materialMultiplier: this._number(`${cfg.name}材料倍率`), category: num(this._local(cfg.categorySid)),
      recipes, selectedRecipe, active, activeRecipe, progress, rawProgress,
      // Original display events 2792/2896 round remaining in-game months to one decimal.
      remainingMonths: active === true && months !== null && months !== undefined && rawProgress !== null ?
        Math.max(0, Math.round((100 - rawProgress) / 100 * months * 10) / 10) : null,
      continuous: this._flag(`连续${cfg.name}`), autoUse: kind === 'alchemy' ? this._flag('自动服用') : null,
      preview: button ? plain(safe(() => this._first(cfg.preview).text)) : null,
      qualityMaximum: button ? num(this._local(cfg.qualitySid)) : null,
      canStart: Boolean(ready && selectedRecipe?.canStart),
      blocked: this._blocked(), busy: Boolean(this.busy), paused: this._flag('游戏暂停'),
      messages, logs: messages.map(entry => entry.text),
      originalControls: ['品类切换', '材料倍率', '连续炼制', ...(kind === 'alchemy' ? ['自动服用'] : [])]
    };
  };

  proto.openCrafting = function (kind = 'alchemy') {
    const cfg = config(kind);
    const guard = this._craftingGuard(cfg);
    if (guard) return guard;
    try {
      const result = this._craftingEnsurePage(cfg, true);
      return result ?? this._result(true, `已打开原游戏${cfg.name}界面。`, { kind });
    } catch (error) { return this._fail(error.message); }
  };

  proto.selectRecipe = function (kind, id) {
    const cfg = config(kind);
    const guard = this._craftingGuard(cfg);
    if (guard) return guard;
    try {
      const recipe = this._craftingRecipe(cfg, id);
      if (!recipe) return this._fail('请选择有效配方。');
      if (recipe.learned !== true) return this._fail('请先在原游戏中学习该配方。');
      if (this._flag(`${cfg.name}开关`) !== false) return this._fail(`请先停止当前${cfg.name}。`);
      const page = this._craftingEnsurePage(cfg);
      if (page) return page;
      // Original selection events 2738/2848 reject the busy shield and only act on existing cards.
      if (this._instances('操作屏蔽').some(visible)) return this._fail('原游戏炼制列表正忙碌。');
      if (!this._craftingCard(cfg, id)) return this._fail('请先在原界面切换到该配方品类。');
      this._call(`刷新${cfg.name}详情`, id);
      this._craftingSelection ??= {};
      this._craftingSelection[kind] = id; // DOM selection cache only.
      return this._result(true, `已选择${recipe.name}。`, { kind, recipeId: id });
    } catch (error) { return this._fail(error.message); }
  };

  proto.startCrafting = function (kind, id) {
    const cfg = config(kind);
    const guard = this._craftingGuard(cfg);
    if (guard) return guard;
    try {
      const snapshot = this.getCraftingSnapshot(kind);
      const recipeId = id ?? snapshot.selectedRecipe?.id;
      const selected = this.selectRecipe(kind, recipeId);
      if (!selected.ok) return selected;
      const button = this._craftingButton(cfg);
      // Original click events 2782-2783/2886-2887 require visible, enabled, and text 炼丹/炼器.
      if (!button || !enabled(button) || safe(() => button.text) !== cfg.name ||
          num(safe(() => button.instVars.修炼等级)) !== recipeId) return this._fail('原游戏炼制按钮暂不可用。');
      this._call(`开始${cfg.name}`, recipeId, true, true);
      // The original function independently checks both materials and skill and may reject.
      if (this._flag(`${cfg.name}开关`) !== true || this._number(`${cfg.name}编号`) !== recipeId) {
        const recipe = this._craftingRecipe(cfg, recipeId);
        return this._fail(recipe?.skillReady === false ? `${cfg.name}等级不足，需要${recipe.requiredSkill}级。` :
          recipe?.materialsReady === false ? '所需材料不足。' : '原游戏未开始本次炼制。');
      }
      return this._result(true, `已开始${cfg.name}，成品由原游戏结算。`, { kind, recipeId });
    } catch (error) { return this._fail(error.message); }
  };

  proto.stopCrafting = async function (kind) {
    const cfg = config(kind);
    const guard = this._craftingGuard(cfg);
    if (guard) return guard;
    try {
      if (this._flag(`${cfg.name}开关`) !== true) return this._result(true, `当前没有进行${cfg.name}。`, { kind });
      const page = this._craftingEnsurePage(cfg);
      if (page) return page;
      // Opening an active page first creates a 炼丹/炼器 button. Original 0.02-second display
      // events 2793/2897 restore text 停止. Wait for that original update, never set it here.
      for (let tries = 0; tries < 12 && safe(() => this._craftingButton(cfg).text) !== '停止'; tries++) {
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      const recheck = this._craftingGuard(cfg);
      if (recheck) return recheck;
      if (this._flag(`${cfg.name}开关`) !== true) return this._result(true, `${cfg.name}已由原游戏结束。`, { kind });
      const button = this._craftingButton(cfg);
      if (!button || !enabled(button) || safe(() => button.text) !== '停止') return this._fail('原游戏停止按钮暂不可用。');
      const recipeId = num(safe(() => button.instVars.修炼等级));
      this._call(`停止${cfg.name}`);
      if (recipeId !== null) this._call(`刷新${cfg.name}详情`, recipeId);
      return this._flag(`${cfg.name}开关`) === false ? this._result(true, `已停止${cfg.name}。`, { kind }) :
        this._fail('原游戏尚未停止炼制。');
    } catch (error) { return this._fail(error.message); }
  };

  proto.getRecipeBookAction = function (inventoryIndex) {
    // Source 1493-1499 uses wp[7] for the recipe type and wp[4] for its recipe row.
    // Row zero is not an inventory item: 学习配方 deliberately does not consume row zero.
    if (!Number.isInteger(inventoryIndex) || inventoryIndex < 1) return null;
    const held = this._array('svwp');
    const wp = this._array('wp');
    const itemId = num(this._at(held, inventoryIndex, 0));
    if (itemId === null || itemId < 1 || this._at(wp, itemId, 2) !== '配方') return null;
    const type = this._at(wp, itemId, 7);
    const cfg = type === '丹方' ? CONFIG.alchemy : type === '器方' ? CONFIG.smithing : null;
    if (!cfg) return null;
    const recipeId = num(this._at(wp, itemId, 4));
    const tier = num(this._at(wp, itemId, 3));
    const count = num(this._at(held, inventoryIndex, 1));
    const learnedFlag = recipeId === null ? null : num(this._at(this._array('save'), recipeId, cfg.learned));
    const recipe = this._craftingRecipe(cfg, recipeId);
    // Learning requirements differ from the alchemy start requirement. Call the original helper.
    const requiredSkill = tier === null ? null : this._formula(`${cfg.name}技艺要求`, tier);
    const skillLevel = this._number(`${cfg.name}等级`);
    const reason = this._layout() !== '主界面' ? '请先进入游戏。' :
      this.busy || this._collectionBusy || this._craftingBusy ? '正在处理上一项操作。' :
      this._blocked() ? '请先完成或关闭原游戏中的对话框。' :
      this._instances('筛选背景').some(instance => this._visible(instance)) ? '请先关闭原界面的筛选窗口。' :
      !this._craftingData(cfg).ready || !recipe || count === null || requiredSkill === null || skillLevel === null ?
        '配方数据尚未完整载入。' : count < 1 ? '纳戒中没有可学习的配方。' :
      learnedFlag === 1 ? '已学会该配方，无法重复学习。' :
      learnedFlag !== 0 ? '原游戏的配方学习状态尚未确认。' :
      skillLevel < requiredSkill ? `需要${cfg.name}等级达到${requiredSkill}级。` : null;
    return { id: 'learn-recipe', label: `学习${type}`, enabled: reason === null, reason,
      kind: cfg.kind, recipeId, itemId, inventoryIndex, count, name: this._at(wp, itemId, 1),
      recipeName: recipe?.name ?? null, learned: learnedFlag === null ? null : learnedFlag === 1,
      requiredSkill, skillLevel };
  };

  proto.learnRecipeBook = async function (inventoryIndex) {
    const guarded = this._guard();
    if (guarded) return guarded;
    const action = this.getRecipeBookAction(inventoryIndex);
    if (!action?.enabled) return this._fail(action?.reason || '该物品不是已验证的丹方或器方。');
    const cfg = CONFIG[action.kind];
    const held = this._array('svwp');
    // Public getAllInstances includes pending-create objects (runtime:1610). Native
    // var0 expressions use committed SOL instances only (2610/2841/3230). Reading
    // committed instances is essential; flushing/altering the SOL here would change state.
    const committedTips = () => {
      const objectClass = safe(() => this._engine().GetObjectClassByIndex(555));
      if (safe(() => objectClass.GetName()) === '道具tips按钮文字') {
        return safe(() => objectClass.GetInstances().map(instance => instance.GetInterfaceClass()));
      }
      return safe(() => this.runtime.objects.道具tips按钮文字.getPickedInstances());
    };
    const countBooks = () => {
      if (!held || held.height < 2 || held.depth < 1) return null;
      let total = 0;
      for (let row = 1; row < held.width; row++) {
        const item = num(this._at(held, row, 0));
        if (item === null) return null;
        if (item !== action.itemId) continue;
        const count = num(this._at(held, row, 1));
        if (count === null || count < 0) return null;
        total += count;
      }
      return Number.isFinite(total) ? total : null;
    };
    const describeTips = buttons => buttons === null ? null : buttons.map(instance => ({
      uid: safe(() => instance.uid), text: safe(() => instance.text),
      visible: visible(instance), row: num(safe(() => instance.instVars.道具序号)),
      enabled: enabled(instance)
    }));
    const diagnose = (stage, extra = {}) => {
      this.recipeLearningDiagnostics = {
        stage, kind: action.kind, inventoryIndex, itemId: action.itemId, recipeId: action.recipeId,
        originalCount: action.count, inventoryWidth: num(safe(() => held.width)),
        currentId: num(this._at(held, inventoryIndex, 0)), currentCount: num(this._at(held, inventoryIndex, 1)),
        learnedFlag: num(this._at(this._array('save'), action.recipeId, cfg.learned)),
        skillLevel: this._number(`${cfg.name}等级`), requiredSkill: action.requiredSkill,
        itemType: this._at(this._array('wp'), action.itemId, 7),
        totalBookCount: countBooks(), allTips: describeTips(this._instances('道具tips按钮文字')),
        committedTips: describeTips(committedTips()),
        paused: this._flag('游戏暂停'), timeScale: num(safe(() => this.runtime.timeScale)),
        functionEnabled: safe(() => this._engine().GetEventSheetManager().GetFunctionBlockByName('学习配方').IsEnabled()),
        ...extra
      };
    };
    this._craftingBusy = true;
    this.busy = true;
    let createdTips = false;
    let booksBefore = null;
    try {
      // 学习配方's conditions (1505/1512) read 道具tips按钮文字.道具序号 rather
      // than the formal inventory parameter. Build the original tips so that context is real.
      this._call('关闭物品tips');
      diagnose('waiting-old-tips-removal');
      // Original Destroy/creation commits at an engine tick, not a fixed wall-clock delay.
      await this._waitUntil(() => committedTips()?.length === 0, 1500);
      if (this._blocked() || this._layout() !== '主界面') return this._fail('请先完成原游戏中的对话框。');
      if (num(this._at(held, inventoryIndex, 0)) !== action.itemId ||
          num(this._at(held, inventoryIndex, 1)) < 1) return this._fail('该配方已不在原纳戒行中。');
      if (num(this._at(this._array('save'), action.recipeId, cfg.learned)) !== 0) return this._fail('该配方的学习状态已经改变。');
      const params = [200, 200, inventoryIndex, '纳戒', 0, 0,
        ...[2, 3, 4, 5, 6].map(column => this._at(held, inventoryIndex, column)),
        this._at(held, inventoryIndex, 1), action.itemId, 5,
        ...[8, 9, 10, 11, 12, 13].map(column => this._at(held, inventoryIndex, column)), 0];
      if (params.some(value => value === null)) return this._fail('原物品实例参数尚未完整载入。');
      // Source 1114, function 1139: full 21-parameter original tips construction.
      this._call('道具tips建立', ...params);
      createdTips = true;
      diagnose('waiting-new-tips-commit');
      await this._waitUntil(() => {
        const committed = committedTips();
        return committed !== null && committed.length > 0 && committed.every(instance =>
          num(safe(() => instance.instVars.道具序号)) === inventoryIndex) &&
          committed.some(instance => visible(instance) && safe(() => instance.text) === '学习');
      }, 1500);
      const buttons = committedTips() ?? [];
      const button = buttons.find(instance => safe(() => instance.text) === '学习' &&
        num(safe(() => instance.instVars.道具序号)) === inventoryIndex);
      if (!button || !enabled(button) || buttons.some(instance =>
        num(safe(() => instance.instVars.道具序号)) !== inventoryIndex)) return this._fail('原游戏配方学习按钮尚未准备完成。');
      // Recheck source click-level conditions; the learning function only rechecks duplicates.
      const skill = this._number(`${cfg.name}等级`);
      if (skill === null || skill < action.requiredSkill) return this._fail('未达到原游戏的配方学习技艺要求。');
      booksBefore = countBooks();
      if (booksBefore === null || booksBefore < 1) return this._fail('原配方书数量尚未确认。');
      diagnose('calling-native-learn', { booksBefore });
      this._call('学习配方', action.recipeId, inventoryIndex, true);
      diagnose('native-learn-returned', { booksBefore });
      await this._waitUntil(() => {
        const learned = num(this._at(this._array('save'), action.recipeId, cfg.learned));
        // Original 失去道具 may delete the final array row. Its now-out-of-range
        // null alone is not proof: verify BOTH learned flag and total exact book loss.
        const booksAfter = countBooks();
        return learned === 1 && booksAfter !== null && booksAfter === booksBefore - 1;
      }, 3000);
      diagnose('completed', { booksBefore });
      return this._result(true, `已学习${action.recipeName}配方。`,
        { kind: action.kind, recipeId: action.recipeId, inventoryIndex });
    } catch (error) {
      diagnose('failed', { booksBefore, error: error.message });
      return this._fail(error.message || '原游戏未确认完成配方学习。');
    }
    finally {
      if (createdTips) safe(() => this._call('关闭物品tips'));
      this._craftingBusy = false;
      this.busy = false;
    }
  };
})();
