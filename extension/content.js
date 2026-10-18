(() => {
  'use strict';

  // One Instagram media decision, shared with routing, playback, and CSS.
  function markStandaloneVideo(article) {
    if (!article) return false;
    const standalone = !!article.querySelector('video') &&
      !article.querySelector('[aria-label^="Go to slide "]');
    article.toggleAttribute('data-jf-standalone-video', standalone);
    return standalone;
  }

  function start(win, navigate = href => win.location.replace(href)) {
    const doc = win.document;
    const allowedPosts = new Set();
    let redirectFrom;
    let searchFocused = false;
    const api = globalThis.browser?.storage;
    let settings = globalThis.JFSettings.normalize();
    let ready = !api;
    const changedBeforeLoad = {};
    function sync() {
      if (!ready) return;
      for (const node of doc.querySelectorAll('[data-jf-hidden]')) node.removeAttribute('data-jf-hidden');
      for (const article of doc.querySelectorAll('article')) markStandaloneVideo(article);
      doc.documentElement.setAttribute('data-jf-ready', '');
      const url = new URL(win.location.href);
      const following = url.pathname === '/' &&
        url.searchParams.getAll('variant').length === 1 &&
        url.searchParams.get('variant') === 'following';
      const stories = url.pathname.startsWith('/stories/');
      const profile = url.pathname.match(/^\/([^/]+)\/(?:(?:reels|reposts|tagged)\/)?$/)?.[1].toLowerCase();
      const profilePage = !!profile && !['accounts', 'direct', 'explore', 'reel', 'reels', 'stories'].includes(profile);
      const post = url.pathname.match(/^\/(?:[^/]+\/)?(?:p|reel)\/([^/]+)\/?$/)?.[1];
      const allowedPost = !!post && allowedPosts.has(post);
      doc.documentElement.toggleAttribute('data-jf-reels', !settings.blockReels || following || profilePage || allowedPost);
      doc.documentElement.toggleAttribute('data-jf-block-reels', settings.blockReels);
      doc.documentElement.toggleAttribute('data-jf-hide-suggestions', settings.hideSuggestions);
      doc.documentElement.toggleAttribute('data-jf-hide-stories', settings.hideStories);
      const blocked = (settings.hideStories && stories) || (settings.blockReels && /^\/p\/[^/]+\/?$/.test(url.pathname) && !allowedPost && !!doc.querySelector('article[data-jf-standalone-video]')) ||
        (url.pathname === '/' && !following) ||
        (settings.blockReels && /^\/reels?(?:\/|$)/.test(url.pathname) && !allowedPost) ||
        (settings.blockReels && /^\/[^/]+\/reels?(?:\/|$)/.test(url.pathname) && !profilePage && !allowedPost) ||
        (settings.hideExplore && url.pathname.startsWith('/explore/') && !['/explore/', '/explore/search/'].includes(url.pathname));
      const searchPage = settings.hideExplore && ['/explore/', '/explore/search/'].includes(url.pathname);
      doc.documentElement.dataset.jfRoute = blocked ? 'redirecting'
        : following ? 'following' : profilePage ? 'profile' : stories ? 'stories' : searchPage ? 'search' : 'other';
      if (blocked && redirectFrom !== url.href) {
        redirectFrom = url.href;
        navigate(`${url.origin}/?variant=following`);
      }
      if (!blocked) redirectFrom = undefined;
      for (const link of doc.querySelectorAll('[data-jf-wordmark]')) {
        // The URL can change before Instagram removes the outgoing feed header.
        if (link.textContent.replace(/\s/g, '') === 'BackFollowing' &&
            link.querySelector('svg[aria-label="Back"]')) continue;
        link.removeAttribute('data-jf-wordmark');
        link.removeAttribute('aria-label');
      }
      if (following) {
        for (const back of doc.querySelectorAll('a[href] svg[aria-label="Back"]')) {
          const link = back.closest('a');
          if (link.pathname !== '/' || link.hasAttribute('data-jf-wordmark') || link.hasAttribute('aria-label') ||
            link.textContent.replace(/\s/g, '') !== 'BackFollowing') continue;
          // CSS paints the wordmark without adding children to React's tree.
          link.setAttribute('data-jf-wordmark', '');
          link.setAttribute('aria-label', 'Instagram');
        }
      }
      if (!searchPage) searchFocused = false;
      if (searchPage) {
        const input = doc.querySelector('main input[aria-label="Search input"]');
        if (input && !searchFocused) {
          searchFocused = true;
          input.focus();
        }
        for (const tile of doc.querySelectorAll('main a[href^="/p/"]')) {
          let branch = tile;
          while (branch.parentElement && !branch.parentElement.matches('main') && !branch.parentElement.querySelector('input, [role="search"]')) branch = branch.parentElement;
          branch.setAttribute('data-jf-hidden', '');
        }
      }
      if (following && settings.hideSuggestions) {
        for (const article of doc.querySelectorAll('main article')) {
          const headers = [...article.querySelectorAll('header')];
          // Instagram also uses divs for metadata. The first ancestor shared by
          // the options menu and author links stays above media and captions.
          for (const menu of article.querySelectorAll('[aria-label="More options"]')) {
            let header = menu.parentElement;
            while (header && header !== article && !header.querySelector('a[href]')) header = header.parentElement;
            if (header && header !== article && !header.querySelector('video, [aria-label="Like"], [aria-label="Comment"]')) headers.push(header);
          }
          if (headers.some(header => [...header.querySelectorAll('span, div, a')]
            .some(marker => ['Suggested for you', 'Sponsored', 'Paid partnership'].includes(marker.textContent.trim())))) {
            article.setAttribute('data-jf-hidden', '');
            for (const video of article.querySelectorAll('video')) if (!video.paused) video.pause();
          }
        }
        for (const link of doc.querySelectorAll(`main a[href="/explore/people/"], main a[href="${url.origin}/explore/people/"]`)) {
          if (link.closest('article')) continue;
          let sidebar = link.parentElement;
          while (sidebar && !sidebar.matches('main') &&
            !sidebar.querySelector('article, input, nav, [role="search"], [role="tablist"], a[href*="/p/"], a[href*="/reel/"]')) {
            if (sidebar.querySelector('button, [role="button"]')) {
              sidebar.setAttribute('data-jf-hidden', '');
              break;
            }
            sidebar = sidebar.parentElement;
          }
        }
      }
      for (const marker of !settings.hideSuggestions || following || profilePage ? [] : doc.querySelectorAll('main h4')) {
        if (!['Suggested for you', 'Suggested posts', 'Suggested reels', 'Discover people', 'Sponsored'].includes(marker.textContent.trim())) continue;
        const article = marker.closest('article');
        if (article && !marker.closest('header')) continue;
        let branch = article || marker.closest('aside') || marker;
        if (!article) {
          while (branch.parentElement && !branch.parentElement.matches('main, header') && !branch.parentElement.querySelector('article, input, nav, [role="search"], [role="tablist"], a[href*="/p/"], a[href*="/reel/"]')) branch = branch.parentElement;
        }
        branch.setAttribute('data-jf-hidden', '');
      }
      if (following || profilePage) {
        for (const link of doc.querySelectorAll('main a[href]')) {
          if (link.closest('[data-jf-hidden]')) continue;
          const id = link.pathname?.match(/^\/(?:[^/]+\/)?(?:p|reel)\/([^/]+)\/?$/)?.[1];
          if (link.origin === url.origin && id) allowedPosts.add(id);
        }
      }
      for (const link of doc.querySelectorAll('a[href]')) {
        const href = link.getAttribute('href');
        if (href.includes('#')) continue;
        let target;
        try { target = new URL(href, url); } catch { continue; }
        if (target.origin === url.origin && target.pathname === '/' && target.searchParams.get('variant') !== 'following') {
          link.setAttribute('href', `${url.origin}/?variant=following`);
        }
      }
    }
    // Instagram changes history without a full page load. The timer only checks the URL.
    let lastHref = win.location.href;
    win.setInterval(() => {
      if (win.location.href !== lastHref) {
        lastHref = win.location.href;
        sync();
      }
    }, 500);
    doc.addEventListener('play', event => {
      if (!ready) return;
      if (event.target.closest('[data-jf-hidden]') ||
        (!doc.documentElement.hasAttribute('data-jf-reels') && !win.location.pathname.startsWith('/stories/') &&
          event.target.matches('video') && markStandaloneVideo(event.target.closest('article')))) event.target.pause();
    }, true);
    doc.addEventListener('click', event => {
      if (!ready) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.('a[href]');
      if (!link || link.getAttribute('href').includes('#')) return;
      let target;
      try { target = new URL(link.href); } catch { return; }
      if (target.origin === win.location.origin && target.pathname === '/') {
        event.preventDefault();
        event.stopImmediatePropagation();
        navigate(`${win.location.origin}/?variant=following`);
      }
    }, true);
    win.addEventListener('popstate', sync);
    if (api) {
      api.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        const patch = Object.fromEntries(Object.keys(globalThis.JFSettings.defaults)
          .filter(key => Object.hasOwn(changes, key))
          .map(key => [key, changes[key].newValue ?? globalThis.JFSettings.defaults[key]]));
        if (!ready) Object.assign(changedBeforeLoad, patch);
        settings = globalThis.JFSettings.normalize({ ...settings, ...patch });
        sync();
      });
      api.local.get().then(saved => {
        settings = globalThis.JFSettings.normalize({ ...saved, ...changedBeforeLoad });
        ready = true;
        sync();
      }).catch(error => {
        console.error('Just Following: could not load preferences', error);
        ready = true;
        sync();
      });
    } else sync();
    const observer = new win.MutationObserver(sync);
    observer.observe(doc, { childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['aria-label'] });
  }

  if (typeof module === 'object' && module.exports) module.exports = { start };
  else start(window);
})();
