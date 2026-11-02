/* Pure equivalent of source/data.json /project/6/1/1/129/8/73, events 161-180.
 * Original 道具单价 writes global 道具出售折扣 (162: 0.1, 163: 1).
 * This query uses that branch constant locally and never calls native functions.
 * Expressions 6599-6611 supply category prices; 品质框转换 356-362 supplies
 * quality ranks; 灵物品质计算 3399 / expression 2519 supplies mean quality.
 * Preserve Construct's strict arithmetic helpers (c3runtime.js:11528-11580):
 * some real wp[:,6] prices are strings, whose original multiplication keeps
 * the left operand. Coercing those strings early would change native prices.
 */
(() => {
  'use strict';
  const Adapter = window.GameAdapter;
  if (!Adapter) throw new Error('GameAdapter must load before price-adapter.js');
  const both = (a, b) => typeof a === 'number' && typeof b === 'number';
  const multiply = (a, b) => both(a, b) ? a * b : a;
  const divide = (a, b) => both(a, b) ? a / b : a;
  const subtract = (a, b) => both(a, b) ? a - b : a;
  const pow = (a, b) => both(a, b) ? Math.pow(a, b) : a;
  const knownNumber = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value));
  const qualityRank = quality => quality >= 90 ? 6 : quality >= 70 ? 5 : quality >= 50 ? 4 : quality >= 30 ? 3 : quality >= 10 ? 2 : 1;
  const basic = new Set(['妖核', '草木', '金石', '逆道果', '命石', '符纸']);

  Adapter.prototype.queryItemPrice = function (row, table = 'svwp', selling = true) {
    if (!Number.isInteger(row) || row < 1 || !['svwp', 'svgw'].includes(table) || typeof selling !== 'boolean') return null;
    const held = this._array(table);
    const wp = this._array('wp');
    if (!held || !wp || held.height < 7 || wp.height < 9 || row >= held.width) return null;
    const id = this._at(held, row, 0);
    if (!Number.isInteger(id) || id < 1 || id >= wp.width) return null;
    const category = this._at(wp, id, 2);
    const base = this._at(wp, id, 6);
    const tier = this._at(wp, id, 3);
    if (!knownNumber(base) || !knownNumber(tier)) return null;
    const instance = column => this._at(held, row, column);
    const discount = selling ? 0.1 : 1;
    const tierFactor = pow(1.53, subtract(tier, 1));
    let value;
    let minimum = null;
    if (category === '法宝' || category === '宝材' || category === '丹药') {
      const quality = instance(2);
      if (!knownNumber(quality)) return null;
      const factor = category === '丹药' ? table === 'svwp' ? divide(pow(quality, 2), 10) : pow(quality, 2) : divide(quality, 100);
      value = multiply(multiply(multiply(multiply(base, factor), discount), qualityRank(quality)), tierFactor);
      if (table === 'svwp') minimum = 10;
    } else if (category === '灵物') {
      const attributes = [2, 3, 4, 5, 6].map(instance);
      if (!attributes.every(knownNumber)) return null;
      // Original expression 2519 uses JS addition, followed by division and rounding.
      const quality = Math.round(attributes.reduce((sum, value) => sum + value) / 5);
      value = multiply(multiply(multiply(base, quality / 100), discount), tierFactor);
      if (table === 'svwp') minimum = 10;
    } else if (category === '灵兽') {
      const level = instance(3);
      if (!knownNumber(level)) return null;
      value = multiply(multiply(multiply(multiply(base, divide(level, 100)), 20), discount), tierFactor);
      if (table === 'svwp') minimum = 10;
    } else if (category === '灵果' && table === 'svwp') {
      const years = instance(3);
      if (!knownNumber(years)) return null;
      // Original 170 ignores 道具出售折扣 and wp base price for fruit.
      value = divide(pow(years, 6.5), 4000000);
      minimum = 1;
    } else if (category === '配方' || category === '功法') {
      value = multiply(multiply(base, discount), tierFactor);
      if (table === 'svwp') minimum = 10;
    } else if (basic.has(category)) {
      value = multiply(base, discount);
      if (table === 'svwp') minimum = 2;
    } else return null; // No native pricing branch; do not invent a price.
    const rounded = Math.round(value);
    if (!Number.isFinite(rounded)) return null;
    return minimum === null ? rounded : Math.max(minimum, rounded);
  };
})();
