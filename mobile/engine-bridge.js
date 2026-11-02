// Platform bridge for the unmodified gameplay event engine, running in its own viewport.
(() => {
  // A generated copy contains audited presentation waits and the authorized core-drop economy patch. Original data.json
  // and the shipped game/source remain intact.
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,options)=>{
    const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href);
    for(const name of ['xl','gf'])if(url.origin===location.origin&&url.pathname===new URL(name+'.json',location.href).pathname){
      return Promise.resolve(new Response(JSON.stringify(self.MobileCultivationTable.tables[name]),{headers:{'Content-Type':'application/json'}}));
    }
    if(url.origin===location.origin&&url.pathname===new URL('data.json',location.href).pathname){
      return nativeFetch(new URL('mobile/project-fast.json',location.href).href,options);
    }
    if(url.origin===location.origin&&url.pathname===new URL('rw.json',location.href).pathname)return nativeFetch(new URL('mobile/rw-economy.json',location.href).href,options);
    return nativeFetch(input,options);
  };
  // The fixed logical game viewport does not need a multi-megapixel DPR on phones.
  try { Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true }); } catch {}
  const report = (kind, message, detail) => {
    const record = { kind, message: String(message), detail: detail ? String(detail) : '', time: Date.now() };
    if (parent !== window && parent.MobilePort?.report) parent.MobilePort.report(record);
  };
  addEventListener('error', event => report('error', event.message, event.error?.stack));
  addEventListener('unhandledrejection', event => report('rejection', event.reason?.message ?? event.reason, event.reason?.stack));
  addEventListener('pagehide', () => { if (parent !== window) parent.MobilePort?.handlePause?.(); });
})();
