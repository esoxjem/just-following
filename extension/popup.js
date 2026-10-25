(async () => {
  'use strict';
  const { defaults, normalize, watch } = globalThis.JFSettings;
  const inputs = [...document.querySelectorAll('input[name]')];
  const options = document.querySelector('#options');
  const reset = document.querySelector('#reset');
  const status = document.querySelector('#status');
  let settings;
  let saving = false;
  let loaded = false;
  function render() {
    for (const input of inputs) { input.checked = settings[input.name]; input.disabled = saving; }
    options.disabled = false;
    reset.disabled = saving;
  }
  async function save(patch) {
    saving = true;
    render();
    status.textContent = 'Saving…';
    try {
      await browser.storage.local.set(patch);
      settings = normalize({ ...settings, ...patch });
      status.textContent = 'Settings saved automatically. Only on this browser.';
    } catch {
      status.textContent = 'Could not save. Please try again.';
    }
    saving = false;
    render();
  }
  reset.addEventListener('click', () => save({ ...defaults }));
  for (const input of inputs) input.addEventListener('change', () => save({ [input.name]: input.checked }));
  try {
    await watch(browser.storage, next => {
      settings = next;
      if (loaded) render();
    });
    loaded = true;
    render();
    status.textContent = 'Settings saved automatically. Only on this browser.';
  } catch {
    status.textContent = 'Could not load settings. Close and reopen to try again.';
  }
})();
