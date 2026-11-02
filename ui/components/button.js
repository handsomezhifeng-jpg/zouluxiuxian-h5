(() => {
  const UI=window.SilkUI=window.SilkUI||{};
  // Attributes are supplied only by the game's renderers; labels are escaped here.
  UI.button=({label,attributes='',secondary=false})=>{
    const text=String(label).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return `<button type="button" class="${secondary?'moon-secondary':'moon-primary'}" ${attributes}>${text}</button>`;
  };
})();
