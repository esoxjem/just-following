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

  function postId(path) {
    return path?.match(/^\/(?:[^/]+\/)?(?:p|reel)\/([^/]+)\/?$/)?.[1];
  }

  function onlyChild(node, name) {
    const parent = node?.parentElement;
    return parent?.localName === name && parent.children.length === 1 ? parent : null;
  }

  function hide(node) {
    node?.setAttribute('data-jf-hidden', '');
  }

  function hideAncestors(node, selector) {
    for (let ancestor = node.parentElement?.closest(selector); ancestor; ancestor = ancestor.parentElement?.closest(selector)) hide(ancestor);
  }

  // Translates Instagram's links, icons, and layout into data-jf-hidden; content.css never reads Instagram's markup.
  function hideEntryPoints(doc, origin, { blockReels, reelsAllowed, hideSimilar, hideStories, searchPage }) {
    const at = path => [path, `${origin}${path}`];
    for (const link of doc.querySelectorAll('a[href]')) {
      const href = link.getAttribute('href');
      if (blockReels && at('/reels/').includes(href)) {
        hide(link);
        // Collapse the mobile item's empty slot in Instagram's space-evenly bar.
        hide(onlyChild(onlyChild(onlyChild(link, 'div'), 'span'), 'div'));
      }
      if (!reelsAllowed && ([...at('/reel/'), ...at('/reels/')].some(prefix => href.startsWith(prefix)) ||
        href.endsWith('/reels/') || (href.includes('/reel/') && link.closest('main')))) hide(link);
      if (hideStories && at('/stories/').some(prefix => href.startsWith(prefix))) {
        hide(link);
        hideAncestors(link, '[role="menu"]');
      }
    }
    for (const icon of doc.querySelectorAll('svg[aria-label="Reel"], svg[aria-label="Reels"], svg[aria-label="Clip"]')) {
      if (!reelsAllowed) hideAncestors(icon, 'a');
    }
    for (const icon of doc.querySelectorAll('svg[aria-label="Similar accounts"]')) {
      if (hideSimilar) hideAncestors(icon, 'button, [role="button"]');
    }
    if (hideStories) {
      for (const rail of doc.querySelectorAll('[aria-label="Stories"]')) hide(rail);
      for (const story of doc.querySelectorAll('[role="button"][aria-label^="Story by "]')) {
        hideAncestors(story, 'ul');
        const list = story.closest('ul');
        if (list) hideAncestors(list, '[role="presentation"]');
      }
    }
    // Explore loads beside the native search widget, before any post links exist.
    for (const loader of searchPage ? doc.querySelectorAll('main [role="progressbar"]') : []) {
      for (let column = loader.parentElement; column; column = column.parentElement) {
        if (column.matches('main > div > div') && !column.querySelector('input, [role="search"]')) {
          hide(loader);
          break;
        }
      }
    }
  }

  function classify(url, settings, allowedPosts, doc) {
    const path = url.pathname;
    const following = path === '/' &&
      url.searchParams.getAll('variant').length === 1 &&
      url.searchParams.get('variant') === 'following';
    const stories = path.startsWith('/stories/');
    const profile = path.match(/^\/([^/]+)\/(?:(?:reels|reposts|tagged)\/)?$/)?.[1].toLowerCase();
    const profilePage = !!profile && !['accounts', 'direct', 'explore', 'reel', 'reels', 'stories'].includes(profile);
    const post = postId(path);
    const allowedPost = !!post && allowedPosts.has(post);
    const reelsAllowed = !settings.blockReels || following || profilePage || allowedPost;
    const searchPage = settings.hideExplore && ['/explore/', '/explore/search/'].includes(path);
    const blocked = (settings.hideStories && stories) || (settings.blockReels && /^\/p\/[^/]+\/?$/.test(path) && !allowedPost && !!doc.querySelector('article[data-jf-standalone-video]')) ||
      (path === '/' && !following) ||
      (settings.blockReels && /^\/reels?(?:\/|$)/.test(path) && !allowedPost) ||
      (settings.blockReels && /^\/[^/]+\/reels?(?:\/|$)/.test(path) && !profilePage && !allowedPost) ||
      (settings.hideExplore && path.startsWith('/explore/') && !searchPage);
    const name = blocked ? 'redirecting'
      : following ? 'following' : profilePage ? 'profile' : stories ? 'stories' : searchPage ? 'search' : 'other';
    return { name, following, profilePage, reelsAllowed, searchPage, blocked };
  }

  function updateWordmark(doc, following) {
    for (const link of doc.querySelectorAll('[data-jf-wordmark]')) {
      // The URL can change before Instagram removes the outgoing feed header.
      if (link.textContent.replace(/\s/g, '') === 'BackFollowing' &&
          link.querySelector('svg[aria-label="Back"]')) continue;
      link.removeAttribute('data-jf-wordmark');
      link.removeAttribute('aria-label');
    }
    for (const back of following ? doc.querySelectorAll('a[href] svg[aria-label="Back"]') : []) {
      const link = back.closest('a');
      if (link.pathname !== '/' || link.hasAttribute('data-jf-wordmark') || link.hasAttribute('aria-label') ||
        link.textContent.replace(/\s/g, '') !== 'BackFollowing') continue;
      // CSS paints the wordmark without adding children to React's tree.
      link.setAttribute('data-jf-wordmark', '');
      link.setAttribute('aria-label', 'Instagram');
    }
  }

  function hideExplorePosts(doc) {
    for (const tile of doc.querySelectorAll('main a[href^="/p/"]')) {
      let branch = tile;
      while (branch.parentElement && !branch.parentElement.matches('main') && !branch.parentElement.querySelector('input, [role="search"]')) branch = branch.parentElement;
      hide(branch);
    }
  }

  function hideSuggestions(doc, origin, { following, profilePage }) {
    if (following) {
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
          hide(article);
          for (const video of article.querySelectorAll('video')) if (!video.paused) video.pause();
        }
      }
      for (const link of doc.querySelectorAll(`main a[href="/explore/people/"], main a[href="${origin}/explore/people/"]`)) {
        if (link.closest('article')) continue;
        let sidebar = link.parentElement;
        while (sidebar && !sidebar.matches('main') &&
          !sidebar.querySelector('article, input, nav, [role="search"], [role="tablist"], a[href*="/p/"], a[href*="/reel/"]')) {
          if (sidebar.querySelector('button, [role="button"]')) {
            hide(sidebar);
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
      hide(branch);
    }
  }

  function rememberAllowedPosts(doc, origin, allowedPosts) {
    for (const link of doc.querySelectorAll('main a[href]')) {
      if (link.closest('[data-jf-hidden]')) continue;
      const id = postId(link.pathname);
      if (link.origin === origin && id) allowedPosts.add(id);
    }
  }

  function rewriteHomeLinks(doc, url) {
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
      const route = classify(url, settings, allowedPosts, doc);
      doc.documentElement.toggleAttribute('data-jf-reels', route.reelsAllowed);
      doc.documentElement.dataset.jfRoute = route.name;
      // Story playback is native; elsewhere a standalone video is the Reels feed in disguise.
      doc.documentElement.toggleAttribute('data-jf-hide-standalone-videos', !route.reelsAllowed && route.name !== 'stories');
      if (route.blocked && redirectFrom !== url.href) {
        redirectFrom = url.href;
        navigate(`${url.origin}/?variant=following`);
      }
      if (!route.blocked) redirectFrom = undefined;
      updateWordmark(doc, route.following);
      if (!route.searchPage) searchFocused = false;
      if (route.searchPage) {
        const input = doc.querySelector('main input[aria-label="Search input"]');
        if (input && !searchFocused) {
          searchFocused = true;
          input.focus();
        }
        hideExplorePosts(doc);
      }
      if (settings.hideSuggestions) hideSuggestions(doc, url.origin, route);
      // After hiding: a suggested post must not authorize opening its Reel.
      if (route.following || route.profilePage) rememberAllowedPosts(doc, url.origin, allowedPosts);
      hideEntryPoints(doc, url.origin, { blockReels: settings.blockReels, reelsAllowed: route.reelsAllowed, searchPage: route.searchPage,
        hideSimilar: settings.hideSuggestions && !route.following && !route.profilePage, hideStories: settings.hideStories });
      rewriteHomeLinks(doc, url);
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
        (doc.documentElement.hasAttribute('data-jf-hide-standalone-videos') &&
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
      attributes: true, attributeFilter: ['aria-label', 'href'] });
  }

  if (typeof module === 'object' && module.exports) module.exports = { start };
  else start(window);
})();
