/* Shared by the popup and Instagram content script; preferences never leave this browser. */
globalThis.JFSettings = (() => {
  const defaults = Object.freeze({
    hideExplore: true,
    blockReels: true,
    hideSuggestions: true,
    hideStories: false
  });
  function normalize(saved = {}) {
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) =>
      [key, typeof saved[key] === 'boolean' ? saved[key] : value]));
  }
  // Reports the saved preferences, then every change. A change made while
  // reading wins over the read; a failed read falls back to defaults and rejects.
  async function watch(storage, update) {
    let settings;
    const early = {};
    storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const patch = Object.fromEntries(Object.keys(defaults)
        .filter(key => Object.hasOwn(changes, key))
        .map(key => [key, changes[key].newValue]));
      if (!settings) return void Object.assign(early, patch);
      settings = normalize({ ...settings, ...patch });
      update(settings);
    });
    let saved = {};
    try {
      saved = await storage.local.get();
    } finally {
      settings = normalize({ ...saved, ...early });
      update(settings);
    }
  }
  return { defaults, normalize, watch };
})();
