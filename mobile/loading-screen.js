(() => {
  'use strict';
  const titleSrc = new URL('assets/loading-title-ink-v1.png', document.currentScript.src).href;
  const figureSrc = new URL('../ui/assets/cultivation-scene.png', document.currentScript.src).href;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(snapshot = {}, error = '') {
    const progress = snapshot.loadingProgress;
    const known = Number.isFinite(progress?.completed) && Number.isFinite(progress?.required) && progress.required > 0;
    const value = known ? Math.max(0, Math.min(100, Math.floor(progress.completed / progress.required * 100))) : 0;
    return `<section class="xian-loading" aria-label="仙途载入">
      <div class="xian-loading-art" aria-hidden="true"></div>
      <img class="xian-loading-figure" src="${figureSrc}" alt="" aria-hidden="true" width="941" height="814" fetchpriority="high">
      <header class="xian-loading-brand"><h1><img class="xian-loading-title" src="${titleSrc}" alt="修真家族" width="2172" height="724"></h1></header>
      <div class="xian-loading-footer">
        <div class="xian-loading-heading" role="status">${error ? `<button class="xian-loading-retry" type="button" data-action="retry-entry" title="${escape(error)}">重试载入</button>` : `<small>${known ? value + '%' : '载入中…'}</small>`}</div>
        <div class="xian-loading-track ${known ? '' : 'is-indeterminate'}" role="progressbar" aria-label="仙途载入进度" aria-valuemin="0" aria-valuemax="100" ${known ? `aria-valuenow="${value}"` : 'aria-valuetext="正在载入"'}><i style="width:${value}%"></i></div>
      </div>
    </section>`;
  }
  window.MobileLoading = { render };
})();
