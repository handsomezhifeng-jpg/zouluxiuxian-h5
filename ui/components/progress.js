(() => {
  const UI=window.SilkUI=window.SilkUI||{};
  UI.progress=amount=>{
    const value=Math.max(0,Math.min(100,Number(amount)||0));
    return `<div class="silk-progress-row" data-ui-component="progress-meter"><span>修炼进度</span><div class="moon-meter" role="progressbar" aria-label="本层修炼进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><div class="cultivation-fill-clip"><div class="progress-fill" data-moon-progress style="width:${value}%"></div></div></div><b class="moon-progress-label" data-moon-progress-label>${Math.floor(value)}%</b></div>`;
  };
})();
