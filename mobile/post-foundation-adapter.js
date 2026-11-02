/* Read-only journey through the shipped foundation -> core -> nascent-soul story.
 * 326..331 native predicates: data.json events 9180-9192.
 * rw[id,8] -> 事件触发器2 9248; X17/18/19/20/21/26 9331..9341.
 * In this release rw[328,8] is 20, so 329 is not a mandatory inserted step.
 * No original functions, timers, setters, quest completion or task dispatch run here.
 */
(() => {
  'use strict';
  if (!window.GameAdapter) throw new Error('Journey adapter requires GameAdapter.');
  const proto = window.GameAdapter.prototype;
  const num = value => {
    if (typeof value !== 'number' && !(typeof value === 'string' && value.trim())) return null;
    const number = Number(value); return Number.isFinite(number) ? number : null;
  };
  const plain = value => typeof value === 'string' ? value.replace(/\[\/?(?:color|size|b|i|u|s|font|outline|shadow|stroke|background)(?:=[^\]]*)?\]/gi, '') : null;
  const IDS = [326, 327, 328, 329, 330, 331];
  const ROOT = '/project/6/0/1/129/8/9/8/2/8/0/8/0/8/';
  const DISPATCH = {
    17: { functionName: 'X17首次转世', nextQuestIds: [327], completesQuestIds: [326], event: 9331,
      pointer: '/project/6/0/1/129/8/10/8/21/8/0', willUnlock: [{ id: 'reincarnation', name: '转世', saveRow: 16, value: 1 }] },
    18: { functionName: 'X18结成金丹', nextQuestIds: [328], completesQuestIds: [327], event: 9333,
      pointer: '/project/6/0/1/129/8/10/8/22/8/0', willUnlock: [] },
    19: { functionName: 'X19探索深渊', nextQuestIds: [329], completesQuestIds: [328], event: 9337,
      pointer: '/project/6/0/1/129/8/10/8/24/8/0', willUnlock: [{ id: 'abyss', name: '深渊', saveRow: 5, value: 1 }] },
    20: { functionName: 'X20修成元婴', nextQuestIds: [330], completesQuestIds: [328], event: 9339,
      pointer: '/project/6/0/1/129/8/10/8/25/8/0', willUnlock: [] },
    21: { functionName: 'X21创建宗门', nextQuestIds: [331], completesQuestIds: [330], event: 9341,
      pointer: '/project/6/0/1/129/8/10/8/26/8/0', willUnlock: [{ id: 'sect', name: '宗门', saveRow: 12, value: 2, inScope: false }] },
    26: { functionName: 'X26结成金丹2', nextQuestIds: [328], completesQuestIds: [327], event: 9335,
      pointer: '/project/6/0/1/129/8/10/8/23/8/0', willUnlock: [] }
  };
  const any = values => values.some(value => value === true) ? true : values.some(value => value === null) ? null : false;
  const all = values => values.some(value => value === false) ? false : values.some(value => value === null) ? null : true;
  const meets = (current, required) => current === null || required === null ? null : current >= required;

  proto.getJourneySnapshot = function () {
    const rw = this._array('rw'), svrw = this._array('svrw'), save = this._array('save'), dj = this._array('dj');
    const ready = Boolean(this._layout() === '主界面' && this._dataReady() && rw?.width > 331 && rw.height >= 12 && rw.depth >= 1 &&
      svrw && svrw.height >= 1 && svrw.depth >= 1 && save?.width >= 19 && save.height > 18 && save.depth >= 1 && dj?.width > 31 && dj.height > 1);
    const level = this._number('lv'), reincarnations = this._number('转世次数');
    const realmAt = value => value === null ? null : plain(this._at(dj, value, 1));
    const realm = realmAt(level);
    const currentQuestIds = [], activeRows = [];
    if (ready) for (let row = 0; row < svrw.width; row++) {
      const id = num(this._at(svrw, row, 0));
      if (Number.isInteger(id) && id > 0 && id < rw.width && this._at(rw, id, 2) === '主线任务') {
        currentQuestIds.push(id);activeRows.push({ id, inventoryIndex: row });
      }
    }
    const unlock = (id, name, row) => {
      const flag = ready ? num(this._at(save, row, 18)) : null;
      return { id, name, flag, unlocked: flag === null ? null : flag === 1, saveRow: row, saveColumn: 18 };
    };
    const unlocks = { reincarnation: unlock('reincarnation', '转世', 16), abyss: unlock('abyss', '深渊', 5) };
    const sectFlag = ready ? num(this._at(save, 12, 18)) : null;
    unlocks.sect = { id: 'sect', name: '宗门', flag: sectFlag, canCreate: sectFlag === null ? null : sectFlag === 2,
      created: sectFlag === null ? null : sectFlag === 1, saveRow: 12, saveColumn: 18, inScope: false };
    const branch = (dispatch, condition) => {
      const known = DISPATCH[dispatch];
      return { dispatch, known: Boolean(known), condition, functionName: known?.functionName ?? null,
        nextQuestIds: known ? known.nextQuestIds.slice() : [], completesQuestIds: known ? known.completesQuestIds.slice() : [],
        willUnlock: known ? known.willUnlock.map(item => ({ ...item, currentFlag: ready ? num(this._at(save, item.saveRow, 18)) : null })) : [],
        source: known ? { event: known.event, pointer: known.pointer } : null };
    };
    const stages = ready ? IDS.map(id => {
      const required = num(this._at(rw, id, 5)), dispatch = num(this._at(rw, id, 8));
      const requirements = [];
      let requirementMode = 'all', route = [326, 328, 330].includes(id) ? 'realm' : id === 327 ? 'reincarnation-preview' : null;
      if ([326, 328, 330].includes(id)) requirements.push({ key: 'level', label: '境界', current: level, required,
        comparison: '>=', met: meets(level, required), currentName: realm, requiredName: realmAt(required),
        text: `境界达到${realmAt(required) || '原任务指定境界'}` });
      if (id === 327) {
        requirementMode = 'any';
        requirements.push({ key: 'reincarnations', label: '转世次数', current: reincarnations, required: 1,
          comparison: '>=', met: meets(reincarnations, 1), text: '已进行至少1次转世' });
        requirements.push({ key: 'level', label: '继续修行', current: level, required: 20, comparison: '>=',
          met: meets(level, 20), currentName: realm, requiredName: realmAt(20), text: `或继续修行至${realmAt(20) || '筑基圆满'}，无需强制转世` });
      }
      if (id === 329) requirements.push({ key: 'abyssFloor', label: '深渊层数', current: this._number('深渊层数'), required: 5,
        comparison: '>=', met: meets(this._number('深渊层数'), 5), text: '深渊达到第5层；本次仅保留原界面入口' });
      const conditionMet = id === 331 ? null : (requirementMode === 'any' ? any : all)(requirements.map(item => item.met));
      const nextBranches = id === 331 ? [] : id === 327 ? [
        branch(dispatch, { key: 'reincarnations', current: reincarnations, required: 1, comparison: '>=', met: meets(reincarnations, 1) }),
        branch(26, { key: 'level', current: level, required: 20, comparison: '>=', met: meets(level, 20) })
      ] : [branch(dispatch, { met: conditionMet })];
      const progressText = id === 327 ? `转世${reincarnations ?? '未知'} / 1次，或${realm || '当前境界未知'} → ${realmAt(20) || '筑基圆满'}` :
        [326, 328, 330].includes(id) ? `${realm || '当前境界未知'} → ${realmAt(required) || '目标境界未知'}` :
        id === 329 ? `深渊${this._number('深渊层数') ?? '未知'} / 5层` : null;
      return { id, name: plain(this._at(rw, id, 1)), type: this._at(rw, id, 3),
        active: currentQuestIds.includes(id), activeRows: activeRows.filter(row => row.id === id).map(row => row.inventoryIndex),
        onIssuedPath: false, inScope: id !== 331, status: id === 331 ? 'boundary' : 'branch-not-selected',
        target: id === 331 ? '宗门本次不做；保留原任务与完整游戏。' : requirements.map(item => item.text).join(requirementMode === 'any' ? '；' : '，'),
        description: plain(this._at(rw, id, 6)), progressText, conditionMet, requirementMode, requirements, nextBranches, route,
        originalOnly: id === 329, rewards: { insight: num(this._at(rw, id, 10)), spiritStones: num(this._at(rw, id, 11)) },
        source: { task: `rw.json#/data/${id}`, rawDispatch: this._at(rw, id, 8),
          predicate: `${ROOT}${id - 311}`, predicateEvents: id === 327 ? [9183, 9184] : [id === 326 ? 9181 : id === 328 ? 9186 : id === 329 ? 9188 : id === 330 ? 9190 : 9192] } };
    }) : [];
    const issuedPathIds = [], visited = new Set();
    const follow = id => {
      if (visited.has(id)) return;visited.add(id);
      const stage = stages.find(item => item.id === id);if (!stage) return;
      issuedPathIds.push(id);stage.onIssuedPath = true;
      for (const next of stage.nextBranches.flatMap(item => item.nextQuestIds)) follow(next);
    };
    if (ready) follow(326);
    for (const stage of stages) stage.status = stage.id === 331 ? 'boundary' : stage.active ? 'active' : stage.onIssuedPath ? 'upcoming' : 'branch-not-selected';
    const activeStages = stages.filter(stage => stage.active);
    const currentStage = activeRows.map(row => stages.find(stage => stage.id === row.id)).find(Boolean) ?? null;
    const visibleStages = stages.filter(stage => stage.onIssuedPath || stage.active);
    const scopeBoundary = { questId: 331, name: '宗门分界', inScope: false,
      reached: currentQuestIds.includes(331), realmReached: meets(level, 31), originalSectFlag: sectFlag,
      note: '本次路线到元婴为止，宗门本次不做；不删除、跳过或结算原任务。' };
    return { ready, level, realm, reincarnations, currentQuestIds, currentStage, activeStages, stages, visibleStages, issuedPathIds, unlocks, scopeBoundary,
      foundationReached: meets(level, 11), paused: this._flag('游戏暂停'), blocked: this._blocked(),
      detectionInterval: { seconds: 1, clock: '原游戏时间', requiresUnpaused: true },
      note: '仅展示真实任务与原发行分支；条件达到后仍须原检测及剧情推进。未在任务列表中不表示已经完成，预览不会执行转世。' };
  };
})();
