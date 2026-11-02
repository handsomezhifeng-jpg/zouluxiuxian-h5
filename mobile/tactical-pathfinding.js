/* Read-only source port: Console.dll AStar.AStarUtils 0x0600695b–0x0600695e.
 * Original coordinates grow upward. This game grows downward, so FourDirs
 * Down, Left, Up, Right becomes [0,+1],[-1,0],[0,-1],[+1,0].
 * Callbacks provide terrain, actor occupancy, and directional edge blocking.
 * This module neither mutates units nor reads/writes game storage.
 */
(function (root) {
  'use strict';
  const DIRS = Object.freeze([[0, 1], [-1, 0], [0, -1], [1, 0]].map(Object.freeze));
  const point = p => ({ x: Number(p.x), y: Number(p.y) });
  const key = p => `${p.x},${p.y}`;
  const same = (a, b) => a.x === b.x && a.y === b.y;
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  function findRaw(options) {
    const start = point(options.start), end = point(options.end);
    if (same(start, end)) return [];
    const body = options.bodyRanges && options.bodyRanges.length ? options.bodyRanges.map(point) : [{ x: 0, y: 0 }];
    const precise = options.preciseTarget !== false;
    const prefer = Number.isFinite(options.preferDistance) ? options.preferDistance : 0;
    const max = Number.isFinite(options.maxStep) ? options.maxStep : 0;
    const canStand = typeof options.canStand === 'function' ? options.canStand : () => true;
    const crossBlocked = typeof options.isPosCrossBlocked === 'function' ? options.isPosCrossBlocked : () => false;
    const customEnd = typeof options.checkEnd === 'function' ? options.checkEnd : null;
    const predict = p => precise ? distance(p, end) : Math.min(...body.map(offset => distance(add(p, offset), end)));
    const node = (p, value, step, previous) => ({ pos: point(p), value, predict: predict(p), step, previous });
    let current = node(start, 0, 0, null);
    const all = [current], open = [], visited = new Set([key(start)]);
    const ownStart = new Set(body.map(offset => key(add(start, offset))));
    // InsertLeaf uses strict '<', preserving insertion order for equal f.
    const insert = n => {
      let at = 0;
      while (at < open.length && n.value + n.predict >= open[at].value + open[at].predict) at++;
      open.splice(at, 0, n);
    };
    // These positions are trusted prevalidated input in the original method.
    for (const pos of options.firstStepPositions || []) {
      const n = node(pos, current.value + 1, current.step + 1, current);
      all.push(n); insert(n);
    }
    while (true) {
      for (const delta of DIRS) {
        const next = add(current.pos, { x: delta[0], y: delta[1] });
        if (visited.has(key(next)) || crossBlocked(current.pos, next)) continue;
        // The source marks a checked anchor before testing its full footprint.
        visited.add(key(next));
        if (!body.every(offset => {
          const cell = add(next, offset);
          return ownStart.has(key(cell)) || canStand(cell, options.customContext);
        })) continue;
        const n = node(next, current.value + 1, current.step + 1, current);
        all.push(n);
        // Literal source branch: only expand nodes when Step + 1 < MaxStep.
        // MaxStep therefore counts the path's starting position as well.
        if (max <= 0 || n.step + 1 < max) insert(n);
      }
      if (!open.length) {
        // Source fallback is closest heuristic, not cheapest total f.
        let closest = null, best = Infinity;
        for (const n of all) if (n.predict < best) { closest = n; best = n.predict; }
        current = closest;
        break;
      }
      current = open.shift();
      if (current.predict <= prefer || customEnd && customEnd(current.pos)) break;
    }
    if (!current) return null;
    const path = [];
    for (let n = current; n; n = n.previous) path.push(point(n.pos));
    // Original FindPath maps a start-only result to an empty path.
    return path.length === 1 ? [] : path.reverse();
  }

  function findPath(options) {
    const raw = findRaw(options);
    return raw && raw.length ? raw.slice(1) : raw;
  }
  const api = Object.freeze({ findPath, findRaw, distance, directions: DIRS, source: 'Console.dll:0600695b-0600695e' });
  root.MobileTacticalPathfinding = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
