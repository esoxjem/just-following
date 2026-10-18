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
  return { defaults, normalize };
})();
