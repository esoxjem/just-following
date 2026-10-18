(() => {
  'use strict';

  function start(win, navigate = href => win.location.replace(href)) {
    const doc = win.document;
    const allowedPosts = new Set();
    let redirectFrom;
    function sync() {
      const url = new URL(win.location.href);
      const following = url.pathname === '/' &&
        url.searchParams.getAll('variant').length === 1 &&
        url.searchParams.get('variant') === 'following';
      const stories = url.pathname.startsWith('/stories/');
      const profile = url.pathname.match(/^\/([^/]+)\/(?:(?:reels|reposts|tagged)\/)?$/)?.[1].toLowerCase();
      const profilePage = !!profile && !['accounts', 'direct', 'explore', 'reel', 'reels', 'stories'].includes(profile);
      const post = url.pathname.match(/^\/(?:[^/]+\/)?(?:p|reel)\/([^/]+)\/?$/)?.[1];
      const allowedPost = !!post && allowedPosts.has(post);
      doc.documentElement.toggleAttribute('data-jf-reels', following || profilePage || allowedPost);
      const blocked = (/^\/p\/[^/]+\/?$/.test(url.pathname) && !allowedPost && !!doc.querySelector('article:has(video):not(:has([aria-label^="Go to slide "]))')) ||
        (url.pathname === '/' && !following) ||
        (/^\/reels?(?:\/|$)/.test(url.pathname) && !allowedPost) ||
        (/^\/[^/]+\/reels?(?:\/|$)/.test(url.pathname) && !profilePage && !allowedPost) ||
        (url.pathname.startsWith('/explore/') && !['/explore/', '/explore/search/'].includes(url.pathname));
      const searchPage = ['/explore/', '/explore/search/'].includes(url.pathname);
      doc.documentElement.dataset.jfRoute = blocked ? 'redirecting'
        : following ? 'following' : profilePage ? 'profile' : stories ? 'stories' : searchPage ? 'search' : 'other';
      if (blocked && redirectFrom !== url.href) {
        redirectFrom = url.href;
        navigate(`${url.origin}/?variant=following`);
      }
      if (!blocked) redirectFrom = undefined;
      for (const node of doc.querySelectorAll('[data-jf-hidden]')) node.removeAttribute('data-jf-hidden');
      if (searchPage) {
        for (const tile of doc.querySelectorAll('main a[href^="/p/"]')) {
          let branch = tile;
          while (branch.parentElement && !branch.parentElement.matches('main') && !branch.parentElement.querySelector('input, [role="search"]')) branch = branch.parentElement;
          branch.setAttribute('data-jf-hidden', '');
        }
      }
      if (following) {
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
      for (const marker of following || profilePage ? [] : doc.querySelectorAll('main h4')) {
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
      if (event.target.closest('[data-jf-hidden]') ||
        (!doc.documentElement.hasAttribute('data-jf-reels') && !win.location.pathname.startsWith('/stories/') &&
          event.target.matches('article:not(:has([aria-label^="Go to slide "])) video'))) event.target.pause();
    }, true);
    doc.addEventListener('click', event => {
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
    sync();
    const observer = new win.MutationObserver(sync);
    observer.observe(doc, { childList: true, subtree: true, characterData: true });
  }

  if (typeof module === 'object' && module.exports) module.exports = { start };
  else start(window);
})();
