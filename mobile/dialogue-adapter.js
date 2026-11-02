(function () {
  "use strict";

  class MobileDialogue {
    constructor(runtime, engineWindow) {
      this.runtime = runtime;
      this.engineWindow = engineWindow;
      this._sentUid = null;
      this._observedInstance = null;
    }

    _getLocalRuntime() {
      try {
        return this.engineWindow.c3_runtimeInterface?._GetLocalRuntime() || null;
      } catch (_) {
        return null;
      }
    }

    _isVisible(instance, localRuntime) {
      try {
        if (!instance || instance.isVisible === false || instance.layer?.isVisible === false) return false;
        const nativeInstance = localRuntime?.GetInstanceByUID(instance.uid);
        const worldInfo = nativeInstance?.GetWorldInfo();
        if (worldInfo && !worldInfo.IsInViewport2()) return false;
        return true;
      } catch (_) {
        return false;
      }
    }

    _getVisibleInstance(typeName, localRuntime) {
      const objectType = this.runtime?.objects?.[typeName];
      if (!objectType?.getAllInstances) return null;
      const instances = objectType.getAllInstances();
      for (let index = instances.length - 1; index >= 0; index--) {
        if (this._isVisible(instances[index], localRuntime)) return instances[index];
      }
      return null;
    }

    _isWaiting(localRuntime) {
      if (!localRuntime) return false;
      const waits = localRuntime.GetEventSheetManager().scheduledWaits();
      return waits.some(wait => wait.IsSignal() && !wait.IsSignalled() && wait.GetSignalTag() === "继续对话");
    }

    getSnapshot() {
      try {
        const localRuntime = this._getLocalRuntime();
        const background = this._getVisibleInstance("对话背景", localRuntime);
        const body = this._getVisibleInstance("对话文字", localRuntime);
        if (!background || !body) return null;

        if (body !== this._observedInstance) {
          this._observedInstance = body;
          this._sentUid = null;
        }

        const speaker = this._getVisibleInstance("对话角色名", localRuntime);
        return {
          uid: body.uid,
          name: speaker ? String(speaker.text ?? "") : "",
          text: String(body.text ?? ""),
          canContinue: this._sentUid !== body.uid && this._isWaiting(localRuntime)
        };
      } catch (_) {
        return null;
      }
    }

    continue() {
      const snapshot = this.getSnapshot();
      if (!snapshot) return { ok: false, message: "当前没有待继续的对话。" };
      if (this._sentUid === snapshot.uid) return { ok: false, message: "正在进入下一段对话。" };
      if (!snapshot.canContinue) return { ok: false, message: "请稍候，对话正在继续。" };

      const localRuntime = this._getLocalRuntime();
      const signal = this.engineWindow.C3?.Plugins?.System?.Acts?.Signal;
      if (!localRuntime || typeof signal !== "function") {
        return { ok: false, message: "暂时无法继续，请在原界面操作。" };
      }

      // Keep the original click/Space signal and duplicate guard. The generated
      // mobile project removes only its presentation waits, preserving order.
      this._sentUid = snapshot.uid;
      this.engineWindow.parent?.MobilePerf?.dialogueClick(snapshot.uid);
      try {
        signal.call(localRuntime.GetSystemPlugin(), "继续对话");
        return { ok: true, message: "" };
      } catch (_) {
        // Retain the guard after an uncertain delivery; never double-advance.
        return { ok: false, message: "对话未能确认继续，请在原界面查看。" };
      }
    }
  }

  window.MobileDialogue = MobileDialogue;
})();
