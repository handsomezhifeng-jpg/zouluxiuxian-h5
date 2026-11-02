/* Forward a portrait control press through the shipped DOM input pipeline.
 * main.js:93-110 -> original Touch pointer handlers c3runtime.js:4195-4206.
 * This sends input only. Callers must validate the native page, commit state,
 * exact control and result; it does not set globals, arrays or run event actions.
 */
(() => {
  'use strict';
  const proto = window.GameAdapter.prototype;
  const safe = (read, fallback = null) => { try { return read() ?? fallback; } catch { return fallback; } };
  let nextPointer = 1800000000;

  proto._nativeControlCommitted = function (instance) {
    const uid = instance?.uid;
    if (!Number.isInteger(uid)) return false;
    const raw = safe(() => this._engine().GetInstanceByUID(uid));
    return Boolean(raw && safe(() => raw.GetObjectClass().GetInstances()
      .some(candidate => candidate.GetUID() === uid), false));
  };

  proto._nativeTap = async function (instance, options = {}) {
    if (this._nativeInputBusy) return this._fail('正在处理上一项设置。');
    const frameWindow = this.engineWindow;
    const engine = this._engine();
    if (this._layout() !== '主界面' || !engine) return this._fail('请先进入游戏。');
    if (safe(() => engine.IsSuspended(), true)) return this._fail('请先继续游戏。');
    if (!this._nativeControlCommitted(instance) || !this._visible(instance) ||
        safe(() => instance.layer.isSelfAndParentsInteractive, false) !== true)
      return this._fail('原控件尚未就绪，请重新打开当前页面。');
    if (!options.allowModal && ['数字输入背景', '筛选背景'].some(name => this._instances(name).some(i => this._visible(i))))
      return this._fail('请先关闭原游戏中的输入或筛选窗口。');
    const point = safe(() => instance.layer.layerToCssPx(instance.x, instance.y));
    const canvas = safe(() => frameWindow.document.querySelector('canvas'));
    if (!point || !point.every(Number.isFinite) || !canvas || typeof frameWindow.PointerEvent !== 'function')
      return this._fail('当前环境无法接收原游戏输入。', { requiresOriginal: true });
    const bounds = safe(() => canvas.getBoundingClientRect());
    if (!bounds || point[0] < bounds.left || point[0] >= bounds.right || point[1] < bounds.top || point[1] >= bounds.bottom)
      return this._fail('原控件当前不在可操作区域。');
    const blockers = new Set(['黑幕', ...(options.blockers ?? ['遮挡底板上', '遮挡底板下'])]);
    // Original confirmation controls are deliberately inside their own modal
    // backdrop. Only those exact native classes can opt into the two audited
    // backdrop purposes; unrelated blockers and every other control still block.
    const nativeClass = safe(() => engine.GetInstanceByUID(instance.uid).GetObjectClass().GetName());
    const confirmationControl = ['对话选择框确定', '对话选择框返回'].includes(nativeClass);
    const allowedBlackUses = new Set(confirmationControl && Array.isArray(options.allowBlackUses) ?
      options.allowBlackUses.filter(use => ['对话框', '转世'].includes(use)) : []);
    // Original IsTouchingObject ignores visibility but checks interactive layers
    // and viewport. Match that geometry across each object's own layer.
    const covered = [...blockers].some(name => this._instances(name).some(blocker => {
      if (!this._nativeControlCommitted(blocker) || safe(() => blocker.layer.isSelfAndParentsInteractive, false) !== true) return false;
      if (name === '黑幕' && allowedBlackUses.has(safe(() => blocker.instVars.用途))) return false;
      const box = safe(() => blocker.getBoundingBox()), viewport = safe(() => blocker.layer.getViewport());
      if (!box || !viewport || box.right <= viewport.left || box.left >= viewport.right || box.bottom <= viewport.top || box.top >= viewport.bottom) return false;
      const local = safe(() => blocker.layer.cssPxToLayer(...point));
      return local && local[0] >= box.left && local[0] <= box.right && local[1] >= box.top && local[1] <= box.bottom;
    }));
    if (covered) return this._fail('原控件被提示或边缘遮罩挡住，请先关闭提示。');
    const restoreFocus = safe(() => frameWindow.parent.document.activeElement);
    const pointerId = nextPointer++;
    const dispatch = (type, buttons) => canvas.dispatchEvent(new frameWindow.PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId, pointerType: 'touch', isPrimary: true,
      clientX: point[0], clientY: point[1], button: 0, buttons,
      width: 1, height: 1, pressure: buttons ? 0.5 : 0
    }));
    this._nativeInputBusy = true;
    let pressed = false;
    try {
      pressed = true;
      dispatch('pointerdown', 1);
      await new Promise(resolve => setTimeout(resolve, 60));
      return this._result(true, '', { inputSent: true });
    } catch (error) {
      return this._fail('原控件操作未完成：' + error.message, { inputSent: pressed });
    } finally {
      if (pressed) safe(() => dispatch('pointerup', 0));
      this._nativeInputBusy = false;
      if (restoreFocus?.isConnected && typeof restoreFocus.focus === 'function') safe(() => restoreFocus.focus({ preventScroll: true }));
    }
  };
})();
