/* A view/controller for the shipped Construct runtime; it owns no gameplay state.
 * Evidence: analysis/mechanics.json; source/scripts/c3runtime.js:1577 (callFunction),
 * 2674 (SID lookup), 4475 (IArrayInstance). All event pointers refer to data.json.
 */
(() => {
  'use strict';

  const TRAINING_PROGRESS_SID = 395257993791850;
  const MONTH_PROGRESS_SID = 333617793596099;
  const SLOT_LABELS = ['档位一', '档位二', '档位三', '档位四', '档位五'];
  const numeric = value => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  const attempt = (fn, fallback = null) => { try { return fn() ?? fallback; } catch { return fallback; } };

  class GameAdapter {
    constructor(runtime, engineWindow) {
      this.runtime = runtime;
      this.engineWindow = engineWindow;
      this.busy = false;
      this.lastError = null;
      this._landingAdvanced = false;
    }

    _engine() {
      const bridge = this.engineWindow?.c3_runtimeInterface;
      return attempt(() => bridge?._localRuntime ?? bridge?._GetLocalRuntime?.());
    }

    _global(name) { return attempt(() => this.runtime.globalVars[name]); }
    _number(name) { return numeric(this._global(name)); }
    _flag(name) {
      const value = this._global(name);
      return value === null ? null : Boolean(value);
    }
    _instances(name) { return attempt(() => this.runtime.objects[name].getAllInstances(), []); }
    _first(name) { return attempt(() => this.runtime.objects[name].getFirstInstance()); }
    _array(name) {
      const instance = this._first(name);
      return typeof instance?.getAt === 'function' ? instance : null;
    }
    _at(array, x, y = 0, z = 0) {
      if (!array || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
      // Construct returns 0 for out-of-range reads; do not turn an unloaded array into fake data.
      if (x < 0 || y < 0 || z < 0 || x >= array.width || y >= array.height || z >= array.depth) return null;
      return attempt(() => array.getAt(x, y, z));
    }
    _local(sid) {
      return attempt(() => this._engine().GetEventSheetManager().GetEventVariableBySID(sid).GetValue());
    }
    _call(name, ...params) { return this.runtime.callFunction(name, ...params); }
    _formula(name, ...params) { return numeric(attempt(() => this._call(name, ...params))); }
    _layout() { return attempt(() => this.runtime.layout.name); }

    _dataReady() {
      const required = this._number('需要载入文件数量');
      const completed = this._number('已完成载入文件数量');
      const xl = this._array('xl');
      const dj = this._array('dj');
      // 开始新游戏 resets loader globals after the already-loaded arrays are retained.
      const loadComplete = required !== null && required > 0 && completed === required;
      return (loadComplete || this._layout() === '主界面') &&
        Boolean(xl && xl.width >= 18 && xl.height >= 8 && dj && dj.width >= 152);
    }

    _advanceLanding() {
      // /project/6/2/1/5: exactly the original 43-files-complete + any-input transition.
      // The portrait iframe is hidden, so supply only that input-equivalent layout change.
      if (this._landingAdvanced || this._layout() !== '载入界面' || !this._dataReady()) return;
      if (typeof this.runtime.goToLayout !== 'function') return;
      try {
        this.runtime.goToLayout('开始界面');
        this._landingAdvanced = true;
      } catch (error) { this.lastError = error.message; }
    }

    _visible(instance) {
      if (!instance || attempt(() => instance.isVisible, false) !== true) return false;
      if (attempt(() => instance.layer.isSelfAndParentsVisible, true) === false) return false;
      const box = attempt(() => instance.getBoundingBox());
      const viewport = attempt(() => instance.layer.getViewport());
      if (!box || !viewport) return true;
      return box.right > viewport.left && box.left < viewport.right &&
        box.bottom > viewport.top && box.top < viewport.bottom;
    }

    _blocked() {
      // Original touch handlers exclude 黑幕; character tabs also exclude 数字输入背景.
      return ['黑幕', '数字输入背景'].some(name => this._instances(name).some(i => this._visible(i)));
    }

    _result(ok, message, extra = {}) {
      if (ok) this.lastError = null;
      return { ok, message, ...extra };
    }
    _fail(message, extra = {}) { this.lastError = message; return this._result(false, message, extra); }

    _guard(inGame = true) {
      if (!this.runtime || typeof this.runtime.callFunction !== 'function' || !this._layout()) return this._fail('游戏仍在载入。');
      if (this.busy) return this._fail('正在处理上一项操作。');
      if (inGame && this._layout() !== '主界面') return this._fail('请先进入游戏。');
      if (this._blocked()) return this._fail('请先完成或关闭原游戏中的对话框。');
      return null;
    }

    _realmUnlocked() {
      // Shipped story X5 writes save[2,18]=1, then 按钮显示判断 projects it
      // into menu animations. Menu visibility/debounce are not save permissions.
      if(this._layout()!=='主界面'||!this._dataReady())return null;
      const value=numeric(this._at(this._array('save'),2,18));
      return value===null?null:value===1;
    }

    _realmButton() {
      // /project/6/0/1/128/8/3/8/8: primary button must use animation 解锁.
      return this._instances('主界面渡劫按钮').find(instance =>
        this._visible(instance) && attempt(() => instance.animationName) === '解锁' &&
        attempt(() => instance.instVars.开关, true) !== false &&
        attempt(() => instance.instVars.开关, 1) !== 0) ?? null;
    }

    getSlots() {
      const info = this._array('存档信息');
      const cloud = this._array('存档信息云');
      return SLOT_LABELS.map((label, slot) => {
        const occupiedValue = this._at(info, slot, 0);
        const savedAt = numeric(this._at(info, slot, 7));
        const cloudSavedAt = numeric(this._at(cloud, slot, 7));
        return {
          slot, label,
          occupied: occupiedValue === null ? null : numeric(occupiedValue) === 1,
          realm: this._at(info, slot, 2), age: this._at(info, slot, 3),
          date: this._at(info, slot, 4), savedAtLabel: this._at(info, slot, 5),
          savedAt, cloudSavedAt,
          cloudIsNewer: savedAt !== null && cloudSavedAt !== null ? cloudSavedAt > savedAt : null
        };
      });
    }

    _inventorySnapshot() {
      const held = this._array('svwp');
      const definitions = this._array('wp');
      if (!held || !definitions || held.height < 2 || definitions.height < 9) return null;
      return attempt(() => {
        const inventory = [];
        // 纳戒物品刷新 event 1001:
        // /project/6/0/1/127/8/8/8/8/8/2/8/8/8/0 checks count > 0 and definition ID != 0.
        // 获得道具 events 1090-1091 write definition ID to svwp[row,0], count to [row,1].
        for (let inventoryIndex = 0; inventoryIndex < held.width; inventoryIndex++) {
          const id = numeric(this._at(held, inventoryIndex, 0));
          const count = numeric(this._at(held, inventoryIndex, 1));
          if (id === 0 || count === null || count <= 0) continue;
          const rawName = id === null ? null : this._at(definitions, id, 1);
          const rawCategory = id === null ? null : this._at(definitions, id, 2);
          const name = typeof rawName === 'string' ? rawName : null;
          const category = typeof rawCategory === 'string' ? rawCategory : null;
          const tier = id === null ? null : numeric(this._at(definitions, id, 3));
          const subtableId = id === null ? null : numeric(this._at(definitions, id, 4));
          const stackFlag = id === null ? null : numeric(this._at(definitions, id, 5));
          const rawText = id === null ? null : this._at(definitions, id, 8);
          // 道具tips建立 events 1198/1200 use wp[id,8] directly for these two categories.
          // For pills, equipment, beasts and most other categories this column is only an
          // effect label (or empty). Their actual tips depend on several other tables/qualities.
          const description = ['逆道果', '宝材'].includes(category) && typeof rawText === 'string' && rawText !== '' ? rawText : null;
          inventory.push({
            id, inventoryIndex, instanceId: inventoryIndex, name, count, category, tier,
            description, definitionKnown: name !== null && category !== null,
            effectLabel: typeof rawText === 'string' && rawText !== '' ? rawText : null,
            subtableId,
            // Item instances with one definition ID can have different qualities. Keep rows separate.
            qualityParameters: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13].map(column => this._at(held, inventoryIndex, column)),
            lockFlag: this._at(held, inventoryIndex, 7),
            stackable: stackFlag === null ? null : stackFlag === 1,
            artId: category === '功法' ? subtableId : null,
            // Special fruit/beast names can carry computed prefixes. name is the verified base name.
            nameKind: ['灵果', '灵兽'].includes(category) ? 'base' : 'definition',
            unknownFields: description === null ? ['description'] : []
          });
        }
        return inventory;
      });
    }

    _artsSnapshot() {
      const gf = this._array('gf');
      const save = this._array('save');
      if (!gf || !save || gf.height < 10 || save.height <= 2) return null;
      return attempt(() => {
        const arts = [];
        // 功法列表刷新 events 2363-2367:
        // /project/6/0/1/128/8/4/8/6/8/2/8/1 iterates gf, selecting save[id,2] > 0.
        // 领悟功法 event 1483 writes 1 to save[id,2] and 0 to save[id,19].
        for (let id = 1; id < gf.width; id++) {
          const level = numeric(this._at(save, id, 2));
          if (level === null || level <= 0) continue;
          const rawName = this._at(gf, id, 1);
          const name = typeof rawName === 'string' ? rawName : null;
          arts.push({
            id, name, level, tier: numeric(this._at(gf, id, 2)),
            // 功法详情显示 event 2371 reads this accumulated insight, not a percentage.
            insight: numeric(this._at(save, id, 19)),
            description: null, cap: null,
            // Source tip events 1204-1209 identify the units of gf columns 4..9.
            // These are per-level coefficients, not fabricated total character bonuses.
            effectsPerLevel: {
              qiPercent: numeric(this._at(gf, id, 4)),
              attackPercent: numeric(this._at(gf, id, 5)),
              defensePercent: numeric(this._at(gf, id, 6)),
              lifespan: numeric(this._at(gf, id, 7)),
              cultivationSpeedPercent: numeric(this._at(gf, id, 8)),
              detoxRaw: numeric(this._at(gf, id, 9))
            },
            definitionKnown: name !== null,
            unknownFields: ['description', 'cap']
          });
        }
        return arts;
      });
    }

    getSnapshot() {
      this._advanceLanding();
      const layout = this._layout();
      const isInGame = layout === '主界面';
      const ready = Boolean(layout && this.runtime?.globalVars && typeof this.runtime?.callFunction === 'function' && this._dataReady());
      const level = this._number('lv');
      const xl = this._array('xl');
      const save = this._array('save');
      const dj = this._array('dj');
      const cultivating = this._flag('修炼开关');
      const selectedMethod = this._number('修炼等级');
      const methods = [];
      if (xl && save && xl.width >= 18 && xl.height >= 8 && save.height > 1) {
        for (let id = 1; id <= 17; id++) {
          const name = this._at(xl, id, 1);
          const current = numeric(this._at(save, id, 1));
          const cap = numeric(this._at(xl, id, 7));
          const previous = numeric(this._at(save, id - 1, 1));
          const unlockLevel = numeric(this._at(xl, id - 1, 6));
          const unlocked = id === 1 || (previous !== null && unlockLevel !== null && previous >= unlockLevel);
          methods.push({
            id, name: typeof name === 'string' ? name : null, level: current, cap, unlocked,
            months: current === null ? null : this._formula('修炼时间', id, current),
            cost: current === null ? null : this._formula('修炼魂晶消耗', id, current),
            unlockLevel: id === 1 ? null : unlockLevel,
            previousName: id === 1 ? null : this._at(xl, id - 1, 1),
            unlockText: id === 1 ? null : `${this._at(xl, id - 1, 1) ?? '前一方法'}${unlockLevel ?? '—'}层解锁`,
            lockReason: id === 1 ? null : `需先将${this._at(xl, id - 1, 1) ?? '前一方法'}修至${unlockLevel ?? '—'}层`,
            costLabel: '注魂升级魂晶',
            active: cultivating === true && selectedMethod === id,
            // These are the original UI's total and next-step display functions, not a simulation.
            qiGain: current === null ? null : this._formula('修炼属性', current, this._at(xl, id, 3)),
            attackGain: current === null ? null : this._formula('修炼属性', current, this._at(xl, id, 4)),
            defenseGain: current === null ? null : this._formula('修炼属性', current, this._at(xl, id, 5)),

          });
        }
      }
      const shownMethod=methods.find(m=>m.id===selectedMethod)||methods.find(m=>m.unlocked)||methods[0];
      if(shownMethod&&shownMethod.level!==null){
        for(const [key,column] of [['Qi',3],['Attack',4],['Defense',5]]){
          const next=this._formula('修炼属性',shownMethod.level+1,this._at(xl,shownMethod.id,column));
          const total=shownMethod[key.toLowerCase()+'Gain'];
          shownMethod['next'+key+'Gain']=next===null||total===null?null:next-total;
        }
      }
      const blocked = this._blocked();
      return {
        ready, layout, isInGame,
        loadingProgress: layout === '初始界面' ? {
          completed: numeric(this._local(318415479244388)),
          required: numeric(this._local(526157833484153)),
          newGame: this._flag('新开游戏'),
          timeScale: attempt(() => this.runtime.timeScale),
          gameTime: attempt(() => this._engine().GetGameTime()),
          waits: attempt(() => this._engine().GetEventSheetManager().scheduledWaits().map(wait => ({
            type: wait._type, time: wait._time, event: attempt(() => wait._event.GetDisplayNumber()), action: wait._actIndex
          })), []),
          ajax: attempt(() => {
            const ajax = this._engine().GetObjectClassByIndex(604).GetSingleGlobalInstance().GetSdkInstance();
            return { tag: ajax._curTag, status: ajax._lastStatusCode, dataLength: ajax._lastData.length };
          }),
          text: this._instances('游戏载入进度文字').filter(i => this._visible(i)).map(i => String(i.text ?? '')).join(' ')
        } : null,
        realm: level === null ? null : this._at(dj, level, 1), level,
        playerName: window.MobilePlayerProfile?.getName(this._number('存档档位')) || '',
        stats: {
          attack: this._number('攻击'), defense: this._number('防御'),
          qi: this._number('真气'), maxQi: this._number('真气上限'),
          age: this._number('年龄'), lifespan: this._number('寿元'),
          soulCrystals: this._number('魂晶'), spiritStones: this._number('灵石'), year: this._number('年'), month: this._number('月')
        },
        cultivating, selectedMethod, progress: numeric(this._local(TRAINING_PROGRESS_SID)), methods,
        adventuring:this._flag('历练开关'),studying:this._flag('功法开关'),studyingArt:this._number('功法编号'),
        gatheringHerbs:this._flag('草木开关'),gatheringMinerals:this._flag('金石开关'),makingPills:this._flag('炼丹开关'),makingTreasures:this._flag('炼器开关'),
        searchingBeasts:this._flag('搜索开关'),capturingBeasts:this._flag('捕兽开关'),trainingBeasts:this._flag('驭兽开关'),challenging:this._flag('挑战开关'),upgradingCave:this._flag('洞府开关'),
        inventory: this._inventorySnapshot(), arts: this._artsSnapshot(),
        monthProgress: numeric(this._local(MONTH_PROGRESS_SID)),
        canBreakthrough: isInGame && !blocked && !this.busy && this._realmUnlocked()===true,
        breakthroughMode: level === null ? null : level >= 151 ? 'saint' : level % 10 === 0 ? 'major' : 'normal',
        slots: this.getSlots(), currentSlot: this._number('存档档位'),
        blocked, busy: this.busy, paused: this._flag('游戏暂停'), lastError: this.lastError
      };
    }

    async startCultivation(id) {
      const blocked = this._guard();
      if (blocked) return blocked;
      if (!Number.isInteger(id) || id < 1 || id > 17) return this._fail('请选择有效的修炼方法。');
      const engine = this._engine(), slot = this._number('存档档位');
      const contextGuard = () => {
        if (this._layout() !== '主界面' || this._engine() !== engine || this._number('存档档位') !== slot)
          return this._fail('当前修仙档位已经变化，请重新选择修炼。');
        if (!engine || attempt(() => engine.IsSuspended(), true)) return this._fail('请先继续游戏。');
        if (this._nativeInputBusy) return this._fail('正在处理上一项原游戏操作。');
        if (this._blocked()) return this._fail('请先完成或关闭原游戏中的对话框。');
        return null;
      };
      const methodGuard = method => !method || !Number.isFinite(method.level) || !Number.isFinite(method.cap) ? this._fail('修炼数据尚未载入。') :
        !method.unlocked ? this._fail(`需要先将${method.previousName ?? '前一方法'}修炼至${method.unlockLevel}层。`) :
        method.level >= method.cap ? this._fail('该项修炼已至满级。') : null;
      const readMethod = () => this.getSnapshot().methods?.find(item => item.id === id);
      let method;
      const context = contextGuard();
      if (context) return context;
      try { method = readMethod(); } catch (error) { return this._fail(error.message); }
      const unavailable = methodGuard(method);
      if (unavailable) return unavailable;
      // A stale second portrait press must not reset the already-running method's progress.
      if (this._flag('修炼开关') === true && this._number('修炼等级') === id)
        return this._result(true, `正在${method.name ?? '修炼'}。`, { alreadyActive: true });
      this.busy = true;
      try {
        const committed = instance => {
          if (!Number.isInteger(instance?.uid)) return false;
          const raw = attempt(() => engine.GetInstanceByUID(instance.uid));
          const objectClass = attempt(() => raw.GetObjectClass());
          return attempt(() => objectClass.GetName()) === '修炼按钮文字' &&
            attempt(() => objectClass.GetInstances().some(candidate => candidate.GetUID() === instance.uid), false);
        };
        const matchingButtons = () => this._instances('修炼按钮文字').filter(instance =>
          numeric(attempt(() => instance.instVars.修炼等级)) === id);
        const visibleButtons = () => matchingButtons().filter(instance =>
          attempt(() => instance.isVisible, false) === true &&
          attempt(() => instance.layer.isSelfAndParentsVisible, true) !== false);
        const readyButton = () => this._global('主页界面') === '修炼' && visibleButtons().find(instance =>
          committed(instance) && attempt(() => instance.layer.isSelfAndParentsInteractive, false) === true &&
          [true, 1].includes(attempt(() => instance.instVars.开关)));
        // Opening 功法 calls 关闭所有系统界面, which destroys the cultivation widgets
        // (events 2349/1957). A portrait tab change alone does not rebuild those widgets.
        // Event 1937 creates pending instances. getAllInstances() can expose them before
        // the original class GetInstances()/SOL can use them, so wait for a real commit.
        if (this._global('主页界面') !== '修炼' || visibleButtons().length === 0) {
          this._call('打开修炼系统', 1);
        }
        let interrupted = null;
        await this._waitUntil(() => {
          interrupted = contextGuard();
          return Boolean(interrupted || readyButton());
        }, 4000);
        if (interrupted) return interrupted;
        method = readMethod();
        const changed = methodGuard(method);
        if (changed) return changed;
        const lastGuard = contextGuard();
        if (lastGuard) return lastGuard;
        if (!readyButton()) return this._fail('原游戏中的修炼按钮暂不可用。');
        // Event 1961 calls 停止所有行为, resets progress, and selects the original method.
        // Unlock/cap and the original button switch are rechecked after the async opening.
        // The portrait list can select legitimate rows below the native scroll viewport;
        // no button/global/save value is written to manufacture their availability.
        this._call('开始修炼', id);
        let confirmed = false;
        await this._waitUntil(() => {
          interrupted = contextGuard();
          if (interrupted) return true;
          confirmed = this._flag('修炼开关') === true && this._number('修炼等级') === id;
          return confirmed;
        }, 4000);
        if (interrupted) return interrupted;
        if (!confirmed) return this._fail('原游戏尚未确认开始修炼。');
        return this._result(true, `开始${method.name ?? '修炼'}。`);
      } catch (error) { return this._fail(error.message); }
      finally { this.busy = false; }
    }

    async stopCultivation() {
      const blocked = this._guard();
      if (blocked) return blocked;
      const engine = this._engine(), slot = this._number('存档档位');
      const contextGuard = () => {
        if (this._layout() !== '主界面' || this._engine() !== engine || this._number('存档档位') !== slot)
          return this._fail('当前修仙档位已经变化，请重新查看。');
        if (!engine || attempt(() => engine.IsSuspended(), true)) return this._fail('请先继续游戏。');
        if (this._nativeInputBusy) return this._fail('正在处理上一项原游戏操作。');
        if (this._blocked()) return this._fail('请先完成或关闭原游戏中的对话框。');
        return null;
      };
      const context = contextGuard();
      if (context) return context;
      if (this._flag('修炼开关') === null || this._number('修炼等级') === null) return this._fail('修炼状态尚未载入。');
      if (this._flag('修炼开关') === false && this._number('修炼等级') === 0)
        return this._result(true, '修炼已停止。', { alreadyStopped: true });
      this.busy = true;
      try {
        // Event 1963 has no widget parameter and remains valid after another page opens.
        this._call('停止修炼');
        let confirmed = false, interrupted = null;
        await this._waitUntil(() => {
          interrupted = contextGuard();
          if (interrupted) return true;
          confirmed = this._flag('修炼开关') === false && this._number('修炼等级') === 0;
          return confirmed;
        }, 4000);
        if (interrupted) return interrupted;
        return confirmed ? this._result(true, '已停止修炼。') : this._fail('原游戏尚未确认停止修炼。');
      }
      catch (error) { return this._fail(error.message); }
      finally { this.busy = false; }
    }

    openOriginal(route = 'character') {
      const blocked = this._guard();
      if (blocked) return blocked;
      try {
        if (route === 'realm') {
          if (this._realmUnlocked()!==true) return this._fail('请先完成主线“参悟功法”的教学对话，解锁渡劫。');
          this._call('打开渡劫系统', 1, 0);
        } else if (route === 'cultivation') this._call('打开修炼系统', 1);
        else if (route === 'arts') this._call('打开功法系统', 1, 0, 0, true, 0);
        else if (route === 'character' || route === 'inventory') {
          if (!this._first('系统菜单背景')) return this._fail('原人物界面尚未载入。');
          if (this._instances('神国菜单背景').some(i => this._visible(i))) return this._fail('请先关闭神国界面。');
          if (route === 'character') this._call('打开人物分页', '', 0, 0);
          else this._call('打开纳戒分页', 0, 0, '全部');
        } else return this._fail('未知的原版界面。');
        return this._result(true, '已打开原版界面。', { route });
      } catch (error) { return this._fail(error.message); }
    }

    async prepareSlots() {
      const blocked = this._guard(false);
      if (blocked) return blocked;
      if (this._layout() !== '开始界面' || !this._dataReady()) return this._fail('请等待原游戏完成载入。');
      this.busy = true;
      try {
        // /project/6/3/1/17: the second any-input ends the title animation.
        // Event 249 开场效果 sets 载入判定 itself, then calls DLC标识显示.
        // Do not write either its local switch or the global loading flag here.
        if (this._flag('载入判定') !== true) {
          await this._waitUntil(() => this._flag('载入判定') === true ||
            Boolean(this._local(115033090622781)), 12000);
          if (this._flag('载入判定') !== true && this._local(115033090622781)) this._call('开场效果');
          await this._waitUntil(() => this._flag('载入判定') === true, 12000);
        }
        const plugin = attempt(() => this._engine().GetObjectClassByIndex(607).GetSingleGlobalInstance().GetSdkInstance());
        if (plugin) await this._waitUntil(() => plugin._pendingGets === 0, 12000);
        // /project/6/3/1/8/8/1 builds the original five normal slots (0..4).
        this._call('打开档位界面');
        await this._waitUntil(() => this.getSlots().every(slot => slot.occupied !== null) &&
          this._instances('系统菜单存档位').some(i => attempt(() => i.instVars.用途) === '正常'), 12000);
        return this._result(true, '存档档位已载入。', { slots: this.getSlots() });
      } catch (error) { return this._fail(error.message); }
      finally { this.busy = false; }
    }

    async _startSlot(slot, options, load) {
      const blocked = this._guard(false);
      if (blocked) return blocked;
      if (this._layout() !== '开始界面') return this._fail('请在原游戏开始界面选择存档。');
      if (!Number.isInteger(slot) || slot < 0 || slot > 4) return this._fail('请选择有效存档。');
      if (this._flag('载入判定') !== true) return this._fail('存档信息仍在载入。');
      const info = this.getSlots()[slot];
      let recovered=false;
      if(load&&options?.recoverLocal===true){
        const raw=await this.runtime.storage.getItem(`${slot}save`);
        let data;try{data=typeof raw==='string'?JSON.parse(raw):raw;}catch{}
        if(!data?.c2array||!Array.isArray(data.size)||data.size.length!==3||!data.size.every(n=>Number.isInteger(n)&&n>0)||!Array.isArray(data.data)||data.data.length!==data.size[0]||data.data.some(row=>!Array.isArray(row)||row.length!==data.size[1]||row.some(cell=>!Array.isArray(cell)||cell.length!==data.size[2])))return this._fail('已有存档数据不完整，已保留原记录。');
        recovered=true;
      }
      if (info.occupied === null) return this._fail('存档信息尚未载入。');
      if (load && !info.occupied&&!recovered) return this._fail('该档位没有普通存档。', { slot: info });
      if (!load && info.occupied && options?.confirmOverwrite !== true) return this._fail('该档位已有存档，请确认是否覆盖。', { requiresConfirmation: true, slot: info });
      if (load && info.cloudIsNewer && options?.confirmOlderSave !== true) return this._fail('云存档比普通存档更新，载入会影响后续云存档，请确认。', { requiresConfirmation: true, slot: info });
      const button = this._instances('系统菜单存档位').find(i =>
        numeric(attempt(() => i.instVars.存档编号)) === slot && attempt(() => i.instVars.用途) === '正常');
      if (!recovered&&button && (attempt(() => button.isVisible, false) !== true || !iSwitch(button))) return this._fail('原存档按钮暂不可用。');
      this.busy = true;
      try {
        // Original start-screen function signatures: 开始新游戏(slot); 读取进度(slot,"正常").
        if (load) this._call('读取进度', slot, '正常');
        else {
          if(info.occupied)await window.MobilePlayerProfile?.reset(this,slot);
          this._call('开始新游戏', slot);
        }
        await this._waitUntil(() => this._layout() !== '开始界面', 12000);
        return this._result(true, load ? '已交由原游戏载入存档。' : '已进入原游戏的新建流程。', { slot });
      } catch (error) { return this._fail(error.message); }
      finally { this.busy = false; }
    }

    startNewGame(slot, options = {}) { return this._startSlot(slot, options, false); }
    loadSlot(slot, options = {}) { return this._startSlot(slot, options, true); }

    async save() {
      const blocked = this._guard();
      if (blocked) return blocked;
      const slot = this._number('存档档位');
      if (!Number.isInteger(slot) || slot < 0 || slot > 4) return this._fail('当前存档档位不可用。');
      this.busy = true;
      try {
        // Event 474 writes all original arrays to the project's IndexedDB via LocalStorage.
        this._call('自动存档');
        const expectedTime = numeric(this._at(this._array('存档信息'), slot, 7));
        const plugin = attempt(() => this._engine().GetObjectClassByIndex(607).GetSingleGlobalInstance().GetSdkInstance());
        if (plugin) await this._waitUntil(() => plugin._pendingSets === 0, 12000);
        const storage = this.runtime.storage;
        if (typeof storage?.getItem !== 'function') return this._result(true, '已提交原游戏存档操作。', { pending: true, slot });
        const [metadataText, saveText] = await Promise.all([storage.getItem('存档信息'), storage.getItem(`${slot}save`)]);
        const metadata = typeof metadataText === 'string' ? JSON.parse(metadataText) : metadataText;
        const persistedTime = numeric(metadata?.data?.[slot]?.[7]?.[0]);
        if (!saveText || expectedTime === null || persistedTime !== expectedTime) return this._fail('原游戏尚未确认存档完成，请稍后重试。');
        return this._result(true, '已保存到原游戏存档。', { slot });
      } catch (error) { return this._fail(error.message); }
      finally { this.busy = false; }
    }

    async _waitUntil(predicate, timeout) {
      const deadline = Date.now() + timeout;
      while (!predicate()) {
        if (Date.now() >= deadline) throw new Error('原游戏操作尚未完成，请稍后查看。');
        await new Promise(resolve => setTimeout(resolve, 16));
      }
    }
  }

  function iSwitch(instance) {
    const value = attempt(() => instance.instVars.开关);
    return value === null || Boolean(value);
  }

  window.GameAdapter = GameAdapter;
})();
