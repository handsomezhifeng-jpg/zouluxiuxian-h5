/* Temporary playtest rule. Set unlimited to false to restore lifespan expiry. */
(() => {
  self.MobileLifespan = {
    unlimited: true,
    remainingForRules(remaining) { return this.unlimited ? Math.max(11, remaining) : remaining; },
    expired(remaining) { return remaining == null ? null : !this.unlimited && remaining < 0; }
  };
})();
