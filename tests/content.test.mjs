import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const openPages = new Set();
const pageErrors = [];
afterEach(() => {
  for (const win of openPages) win.close();
  openPages.clear();
  assert.deepEqual(pageErrors.splice(0), [], 'Browser fixtures should not emit hidden errors');
});

const sourcePath = new URL('../extension/content.js', import.meta.url);
const cssPath = new URL('../extension/content.css', import.meta.url);
function page(html = '', path = '/?variant=following', storage, isolated = false) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => { errors.push(error); pageErrors.push(error.message); });
  const dom = new JSDOM(html, { url: `https://www.instagram.com${path}`, runScripts: 'outside-only', virtualConsole });
  openPages.add(dom.window);
  const redirects = [];
  let changeListener;
  if (storage) dom.window.browser = { storage: {
    local: { get: async () => storage },
    onChanged: { addListener: listener => { changeListener = listener; } }
  } };
  dom.window.eval(readFileSync(new URL('../extension/settings.js', import.meta.url), 'utf8'));
  if (existsSync(cssPath)) {
    const style = dom.window.document.createElement('style');
    style.textContent = readFileSync(cssPath, 'utf8');
    dom.window.document.head.append(style);
  }
  if (existsSync(sourcePath)) {
    dom.window.module = { exports: {} };
    dom.window.eval(readFileSync(sourcePath, 'utf8'));
    const target = isolated ? new Proxy(dom.window, {
      get: (win, key) => ['JFSettings', 'browser'].includes(key) ? undefined
        : ['addEventListener', 'setInterval'].includes(key) ? win[key].bind(win) : Reflect.get(win, key)
    }) : dom.window;
    dom.window.module.exports.start(target, href => redirects.push(href));
  }
  return { dom, window: dom.window, document: dom.window.document, redirects, errors, change: changes => changeListener(changes, "local") };
}

// Real DOM and events. Only the full-page navigation boundary is replaced in jsdom.
test('opening Home replaces the recommended feed with native Following', () => {
  const p = page('<main><article>Recommended post</article></main>', '/');
  assert.deepEqual(p.redirects, ['https://www.instagram.com/?variant=following']);
  p.window.close();
});

test('Following is marked as the safe feed without redirecting', () => {
  const p = page('<main><article>A followed photo</article></main>');
  assert.equal(p.document.documentElement.dataset.jfRoute, 'following');
  assert.deepEqual(p.redirects, []);
  p.window.close();
});

for (const path of ['/reels/', '/reel/ABC/', '/explore/people/', '/explore/tags/photography/', '/explore/locations/12/', '/?variant=favorites', '/?variant=following&variant=home']) {
  test(`distraction route ${path} returns to Following with its content concealed`, () => {
    const p = page('<main><header><h2>person</h2><button>Follow</button></header>Distraction</main>', path);
    assert.equal(p.document.documentElement.dataset.jfRoute, 'redirecting');
    assert.deepEqual(p.redirects, ['https://www.instagram.com/?variant=following']);
    p.window.close();
  });
}

for (const path of ['/stories/person/123/', '/stories/highlights/123/']) {
  test(`Story viewer ${path} keeps native visibility and video playback`, () => {
    const p = page('<main><article><video></video></article></main>', path);
    assert.deepEqual(p.redirects, []);
    assert.notEqual(p.window.getComputedStyle(p.document.querySelector('main')).visibility, 'hidden');
    assert.notEqual(p.window.getComputedStyle(p.document.querySelector('article')).display, 'none');
    let pauses = 0;
    const video = p.document.querySelector('video');
    video.pause = () => { pauses += 1; };
    video.dispatchEvent(new p.window.Event('play'));
    assert.equal(pauses, 0);
    p.window.close();
  });
}

test('the outgoing recommended feed is invisible while Following loads', () => {
  const p = page('<main><article>Recommended</article></main>', '/');
  assert.equal(p.window.getComputedStyle(p.document.querySelector('main')).visibility, 'hidden');
  p.window.close();
});

test('client-side navigation is guarded after Instagram replaces its content', async () => {
  const p = page('<main>Profile</main>', '/person/');
  p.window.history.pushState({}, '', '/reels/');
  p.document.querySelector('main').textContent = 'Reels loaded by React';
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(p.redirects, ['https://www.instagram.com/?variant=following']);
  assert.equal(p.document.documentElement.dataset.jfRoute, 'redirecting');
  p.window.close();
});

test('Back navigation to Home is guarded even without a DOM mutation', () => {
  const p = page('<main>Profile</main>', '/person/');
  p.window.history.replaceState({}, '', '/');
  p.window.dispatchEvent(new p.window.PopStateEvent('popstate'));
  assert.deepEqual(p.redirects, ['https://www.instagram.com/?variant=following']);
  p.window.close();
});

test('a silent history update cannot leave the recommended feed open', async () => {
  const p = page('<main>Profile</main>', '/person/');
  await new Promise(resolve => setTimeout(resolve, 10));
  p.window.history.pushState({}, '', '/');
  await new Promise(resolve => setTimeout(resolve, 550));
  assert.deepEqual(p.redirects, ['https://www.instagram.com/?variant=following']);
  p.window.close();
});

test('Reels entry points are hidden while Stories and native interactions remain', () => {
  const p = page(`<nav><a id="reels" href="/reels/"><svg aria-label="Reels"></svg></a>
    <a id="search" href="/explore/"><svg aria-label="Search"></svg></a>
    <a id="dm" href="/direct/inbox/">Messages</a><a id="profile" href="/friend/">Profile</a></nav>
    <main><a id="story" href="/stories/friend/123/">Story</a>
    <a id="absolute-story" href="https://www.instagram.com/stories/friend/123/">Story</a>
    <article id="post"><a href="/p/PHOTO/">Photo</a><button>Like</button></article></main>`);
  assert.equal(p.window.getComputedStyle(p.document.getElementById('reels')).display, 'none');
  for (const id of ['story', 'absolute-story', 'search', 'dm', 'profile', 'post']) assert.notEqual(p.window.getComputedStyle(p.document.getElementById(id)).display, 'none', id);
  p.window.close();
});

test('Following keeps Stories, Reel posts, and photo carousels', () => {
  const p = page(`<main><div aria-label="Stories" id="stories"><div role="menu"><button>Friend's story</button></div></div>
    <article id="video"><video></video><a id="reel" href="/friend/reel/ABC/"><svg aria-label="Clip"></svg></a><button>Like</button></article>
    <article id="carousel"><img alt="Photo"><button>Next</button><button>Like</button></article></main>`);
  for (const id of ['video', 'reel']) assert.notEqual(p.window.getComputedStyle(p.document.getElementById(id)).display, 'none');
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('stories')).display, 'none');
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('[role="menu"]')).display, 'none');
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('carousel')).display, 'none');
  p.window.close();
});

for (const path of ['/kodak/', '/kodak/reels/', '/kodak/reposts/', '/kodak/tagged/']) {
  test(`the profile page ${path} hides sidebar Reels and preserves profile content`, () => {
    const p = page(`<nav><a id="reels" href="/reels/">Reels</a>
      <a id="absolute-reels" href="https://www.instagram.com/reels/">Reels</a></nav>
      <main><header><h2>Kodak</h2><button id="similar"><svg aria-label="Similar accounts"></svg></button>
        <div id="similar-div" role="button"><svg aria-label="Similar accounts"></svg></div>
        <section id="suggestions"><h4>Suggested for you</h4><a href="/explore/people/">See all</a><button>Follow</button></section>
        <div role="menu"><a id="highlight" href="/stories/highlights/123/">Highlight</a></div></header>
        <a id="tab" href="/kodak/reels/">Reels</a>
        <a id="post" href="/kodak/reel/ABC/"><img></a></main>`, path);
    assert.deepEqual(p.redirects, []);
    for (const id of ['reels', 'absolute-reels']) {
      assert.equal(p.window.getComputedStyle(p.document.getElementById(id)).display, 'none', id);
    }
    for (const id of ['similar', 'similar-div', 'suggestions', 'highlight', 'tab', 'post']) {
      for (let node = p.document.getElementById(id); node && node !== p.document.body; node = node.parentElement) {
        assert.notEqual(p.window.getComputedStyle(node).display, 'none', id);
        assert.notEqual(p.window.getComputedStyle(node).visibility, 'hidden', id);
      }
    }
    assert.equal(p.document.querySelectorAll('[data-jf-hidden]').length, 0);
    p.window.close();
  });
}

test('profile grids preserve Reel tiles without following the account', () => {
  const p = page(`<nav><a id="global-reels" href="/reels/">Reels</a></nav>
    <main><header><h2>kodakfilm.reto</h2><button>Follow</button></header>
    <div class="grid"><div class="cell"><a id="reel" href="/p/VIDEO/"><img><svg aria-label="Reel"></svg></a></div>
      <div class="cell"><a id="collaboration" href="/haakim_jsn/reel/ABC/"><img><svg aria-label="Clip"></svg></a></div>
      <div class="cell"><a id="photo" href="/kodakfilm.reto/p/PHOTO/"><img alt="Photo"></a></div></div>
    <a id="tab" href="/kodakfilm.reto/reels/">Reels</a></main>`, '/kodakfilm.reto/');
  for (const id of ['reel', 'collaboration', 'photo', 'tab']) {
    for (let node = p.document.getElementById(id); node && node !== p.document.body; node = node.parentElement) {
      assert.notEqual(p.window.getComputedStyle(node).display, 'none', id);
    }
  }
  assert.equal(p.window.getComputedStyle(p.document.getElementById('global-reels')).display, 'none');
  p.window.close();
});

for (const tab of ['tagged', 'reposts']) {
  test(`the profile ${tab} grid preserves Reel tiles`, () => {
    const p = page('<main><a id="reel" href="/another/reel/ABC/"><img><svg aria-label="Clip"></svg></a></main>', `/kodakfilm.reto/${tab}/`);
    assert.deepEqual(p.redirects, []);
    assert.notEqual(p.window.getComputedStyle(p.document.getElementById('reel')).display, 'none');
    p.window.close();
  });
}

for (const path of ['/explore/', '/direct/', '/accounts/', '/reel/', '/reels/', '/stories/']) {
  test(`the app route ${path} does not enable profile Reels`, () => {
    const p = page('<main><a href="/friend/reel/ABC/">Reel</a></main>', path);
    assert.equal(p.document.documentElement.hasAttribute('data-jf-reels'), false);
    p.window.close();
  });
}

test('a followed profile keeps its Reel tiles and profile Reels tab', () => {
  const p = page(`<nav><a id="global-reels" href="/reels/"><svg aria-label="Reels"></svg></a></nav>
    <main><header><h2>friend</h2><button><div>Following</div><svg><title>Down chevron icon</title></svg></button></header>
    <a id="reel" href="/friend/reel/ABC/"><img><svg aria-label="Clip"></svg></a>
    <a id="video" href="/p/VIDEO/"><img><svg aria-label="Reel"></svg></a>
    <a id="tab" href="/friend/reels/">Reels</a></main>`, '/friend/');
  for (const id of ['reel', 'video', 'tab']) assert.notEqual(p.window.getComputedStyle(p.document.getElementById(id)).display, 'none', id);
  assert.equal(p.window.getComputedStyle(p.document.getElementById('global-reels')).display, 'none');
  p.window.close();
});

test('an unfollowed profile’s Reels tab stays on that account', () => {
  const p = page('<main><header><h2>friend</h2><button>Follow</button></header><a id="reel" href="/friend/reel/ABC/">Reel</a></main>', '/friend/reels/');
  assert.deepEqual(p.redirects, []);
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('reel')).display, 'none');
  p.window.close();
});

test('a profile Reels tab remains visible while its header loads', async () => {
  const p = page('<main><a id="reel" href="/friend/reel/ABC/">Reel</a></main>', '/friend/reels/');
  assert.deepEqual(p.redirects, []);
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('main')).visibility, 'hidden');
  p.document.querySelector('main').insertAdjacentHTML('afterbegin', '<header><h2>friend</h2><button>Follow</button></header>');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(p.redirects, []);
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('main')).visibility, 'hidden');
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('reel')).display, 'none');
  p.window.close();
});

test('opening a collaboration Reel from an unfollowed profile keeps native playback', () => {
  const p = page('<main><header><h2>kodakfilm.reto</h2><button>Follow</button></header><a href="/haakim_jsn/reel/ABC/">Reel</a></main>', '/kodakfilm.reto/');
  p.window.history.pushState({}, '', '/haakim_jsn/reel/ABC/');
  p.document.querySelector('main').innerHTML = '<article><video></video><button>Like</button></article>';
  p.window.dispatchEvent(new p.window.PopStateEvent('popstate'));
  assert.deepEqual(p.redirects, []);
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('article')).display, 'none');
  let pauses = 0;
  const video = p.document.querySelector('video');
  video.pause = () => { pauses += 1; };
  video.dispatchEvent(new p.window.Event('play'));
  assert.equal(pauses, 0);
  p.window.close();
});

test('hidden suggested posts do not authorize a Reel viewer from Following', () => {
  const p = page('<main><article><header><span>Suggested for you</span></header><a href="/stranger/reel/SUGGESTED/">Reel</a></article></main>');
  p.window.history.pushState({}, '', '/stranger/reel/SUGGESTED/');
  p.document.querySelector('main').innerHTML = '<article><video></video></article>';
  p.window.dispatchEvent(new p.window.PopStateEvent('popstate'));
  assert.deepEqual(p.redirects, ['https://www.instagram.com/?variant=following']);
  p.window.close();
});

test('changing follow status keeps the profile’s Reel playback available', async () => {
  const p = page('<main><header><h2>friend</h2><button id="relationship">Following</button></header><a href="/friend/reel/ABC/">Reel</a></main>', '/friend/');
  p.document.getElementById('relationship').textContent = 'Follow';
  await new Promise(resolve => setTimeout(resolve, 10));
  p.window.history.pushState({}, '', '/friend/reel/ABC/');
  p.document.querySelector('main').innerHTML = '<article><video></video></article>';
  p.window.dispatchEvent(new p.window.PopStateEvent('popstate'));
  assert.deepEqual(p.redirects, []);
  p.window.close();
});

test('Home links point at Following, including opening in a new tab', () => {
  const p = page(`<nav><a id="logo" href="/"><svg aria-label="Instagram"></svg></a>
    <a id="home" href="https://www.instagram.com/"><svg aria-label="Home"></svg></a>
    <a id="hash" href="/#">Notifications</a></nav>`);
  for (const id of ['home', 'logo']) assert.equal(p.document.getElementById(id).href, 'https://www.instagram.com/?variant=following');
  assert.equal(p.document.getElementById('hash').getAttribute('href'), '/#');
  p.window.close();
});

test('Home clicks bypass Instagram’s original recommended-feed handler', () => {
  const p = page('<a id="home" href="/"><svg aria-label="Home"><path></path></svg></a>', '/friend/');
  let nativeHandled = false;
  p.document.getElementById('home').addEventListener('click', () => { nativeHandled = true; });
  const click = new p.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  p.document.querySelector('path').dispatchEvent(click);
  assert.deepEqual(p.redirects, ['https://www.instagram.com/?variant=following']);
  assert.equal(nativeHandled, false);
  assert.equal(click.defaultPrevented, true);
  p.window.close();
});

test('Search focuses the native input when it opens', () => {
  const p = page('<main><input aria-label="Search input"></main>', '/explore/');
  assert.equal(p.document.activeElement, p.document.querySelector('input'));
});

test('Search hides the Explore loader before tiles arrive and keeps its own loading state', () => {
  const p = page(`<main><div>
    <div><input aria-label="Search input"><div id="search-loading" role="progressbar"></div></div>
    <div><div id="explore-loading" role="progressbar"><svg aria-label="Loading..."></svg></div></div>
  </div></main><aside><div id="messages-loading" role="progressbar"></div></aside>`, '/explore/');
  assert.equal(p.window.getComputedStyle(p.document.getElementById('explore-loading')).display, 'none');
  for (const id of ['search-loading', 'messages-loading']) {
    assert.notEqual(p.window.getComputedStyle(p.document.getElementById(id)).display, 'none', id);
  }
});

test('Search focuses an input rendered later without reclaiming focus after updates', async () => {
  const p = page('<main></main><textarea aria-label="Message"></textarea>', '/explore/search/');
  p.document.querySelector('main').innerHTML = '<input aria-label="Search input"><div id="results"></div>';
  await new Promise(resolve => setTimeout(resolve, 0));
  const input = p.document.querySelector('input');
  assert.equal(p.document.activeElement, input);
  input.value = 'kodak';
  const message = p.document.querySelector('textarea');
  message.focus();
  p.document.getElementById('results').textContent = 'Account results';
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(p.document.activeElement, message);
  assert.equal(input.value, 'kodak');

  p.window.history.pushState({}, '', '/friend/');
  p.window.dispatchEvent(new p.window.PopStateEvent('popstate'));
  p.window.history.pushState({}, '', '/explore/search/');
  p.window.dispatchEvent(new p.window.PopStateEvent('popstate'));
  assert.equal(p.document.activeElement, input);
  assert.equal(input.value, 'kodak');
});

test('disabling Explore hiding restores its loader and leaves focus native', async () => {
  const p = page(`<main><div><div><input aria-label="Search input"></div>
    <div><div id="loader" role="progressbar"></div></div></div></main>`, '/explore/', { hideExplore: false });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.notEqual(p.document.activeElement, p.document.querySelector('input'));
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('loader')).display, 'none');
  p.change({ hideExplore: { newValue: true } });
  assert.equal(p.document.activeElement, p.document.querySelector('input'));
  assert.equal(p.window.getComputedStyle(p.document.getElementById('loader')).display, 'none');
  p.change({ hideExplore: { newValue: false } });
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('loader')).display, 'none');
});

test('Search retains its input and account results while Explore posts disappear', () => {
  const p = page(`<main><div><div id="search"><input aria-label="Search input"></div>
    <div id="results"><a href="/friend/">Friend</a></div>
    <div id="grid"><div><a id="tile" href="/p/ABC/"><img alt="Recommended photo"></a></div></div></div></main>`, '/explore/');
  assert.equal(p.document.documentElement.dataset.jfRoute, 'search');
  assert.equal(p.window.getComputedStyle(p.document.getElementById('grid')).display, 'none');
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('search')).display, 'none');
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('results')).display, 'none');
  assert.deepEqual(p.redirects, []);
  p.window.close();
});

test('Following preserves Instagram’s native empty state and Stories rail', () => {
  const nativeContent = `<div><div id="stories" role="menu"><a href="/stories/friend/123/">Friend's story</a></div>
    <div id="empty"><span>Get fresh updates here when you follow accounts</span>
      <input placeholder="Search for a friend or creator..."><button>Follow</button></div></div>`;
  const p = page(`<main>${nativeContent}</main>`);
  assert.equal(p.document.querySelector('main').innerHTML, nativeContent);
  assert.equal(p.document.getElementById('jf-empty'), null);
  for (const id of ['empty', 'stories']) {
    for (let node = p.document.getElementById(id); node && node !== p.document.body; node = node.parentElement) {
      assert.notEqual(p.window.getComputedStyle(node).display, 'none', id);
    }
  }
  p.window.close();
});

test('a native photo arriving after the empty state becomes visible', async () => {
  const p = page('<main><div><span>Get fresh updates here when you follow accounts</span></div></main>');
  p.document.querySelector('main > div').remove();
  p.document.querySelector('main').insertAdjacentHTML('afterbegin', '<article id="arrived">New followed photo</article>');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(p.document.getElementById('jf-empty'), null);
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('arrived')).display, 'none');
  p.window.close();
});

test('filtered feed posts retain a tiny measurable slot for Instagram’s virtual scrolling', () => {
  const p = page('<main><div style="padding-bottom: 18000px"><article id="ad"><header><span>Sponsored</span></header><img></article><article id="friend"><img></article></div></main>');
  const ad = p.document.getElementById('ad');
  const style = p.window.getComputedStyle(ad);
  assert.notEqual(style.display, 'none', 'Instagram must still be able to measure the article');
  assert.equal(style.visibility, 'hidden');
  assert.ok(parseFloat(style.minHeight) > 0, 'A zero-height item can stall the native virtual list');
  assert.ok(parseFloat(style.maxHeight) <= 1, 'The filtered content should not leave a post-sized gap');
  assert.equal(style.overflow, 'hidden');
  assert.equal(ad.parentElement.style.paddingBottom, '18000px', 'Instagram owns its virtualization offsets');
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('friend')).visibility, 'hidden');
});

test('Following filters labeled posts and account suggestions while preserving captions', () => {
  const p = page(`<nav><a id="reels" href="/reels/">Reels</a></nav><main><div>
    <article id="suggested"><header><span>Suggested for you</span><button>Follow</button></header><img></article>
    <article id="sponsored"><header><span>Sponsored</span></header><img></article>
    <article id="friend"><header>Friend</header><img><div>Suggested for you</div><button>Like</button>
      <a href="/explore/people/">A link in a caption</a></article>
    <section id="suggested-posts"><h2>Suggested posts</h2></section>
    <section id="suggested-reels"><h3>Suggested reels</h3></section>
    <section id="discover"><h4>Discover people</h4></section>
    <aside><div id="account"><a href="/me/">My profile</a><button>Switch</button></div>
      <div id="suggested-accounts"><div><span>Suggested for you</span><a href="/explore/people/">See all</a></div>
        <div><a href="/stranger/">Stranger</a><button>Follow</button></div></div>
      <footer id="footer">About Instagram</footer></aside></div></main>`);
  for (const id of ['reels', 'suggested-accounts']) assert.equal(p.window.getComputedStyle(p.document.getElementById(id)).display, 'none', id);
  for (const id of ['suggested', 'sponsored']) assert.equal(p.window.getComputedStyle(p.document.getElementById(id)).visibility, 'hidden', id);
  for (const id of ['friend', 'suggested-posts', 'suggested-reels', 'discover', 'account', 'footer']) {
    for (let node = p.document.getElementById(id); node && node !== p.document.body; node = node.parentElement) {
      assert.notEqual(p.window.getComputedStyle(node).display, 'none', id);
    }
  }
  p.window.close();
});

for (const label of ['Sponsored', 'Paid partnership', 'Suggested for you']) {
  test(`Following hides a div-based post with the ${label} metadata label`, () => {
    const p = page(`<main><article id="filtered"><div><div>
      <div><div><a href="/creator/">Creator</a><a href="/p/ABC/">1h</a><div><span>${label}</span></div></div>
        <button><svg aria-label="More options"></svg></button></div>
      <div><img alt="Photo"></div></div><div><button><svg aria-label="Like"></svg></button><div>Caption</div></div></div></article>
      <article id="native"><div><div><a href="/friend/">Friend</a><button><svg aria-label="More options"></svg></button></div>
        <img alt="Photo"><div><span>${label}</span></div><button>Like</button></div></article></main>`);
    assert.equal(p.window.getComputedStyle(p.document.getElementById('filtered')).visibility, 'hidden');
    assert.notEqual(p.window.getComputedStyle(p.document.getElementById('native')).visibility, 'hidden');
    assert.deepEqual(p.redirects, []);
  });
}

test('a sponsored label arriving during playback hides the post and pauses its video', async () => {
  const p = page('<main><article><header><span id="label"></span></header><video></video></article></main>');
  const video = p.document.querySelector('video');
  let pauses = 0;
  Object.defineProperty(video, 'paused', { get: () => pauses > 0 });
  video.pause = () => pauses++;
  p.document.getElementById('label').textContent = 'Sponsored';
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(p.window.getComputedStyle(p.document.querySelector('article')).visibility, 'hidden');
  assert.equal(pauses, 1);
  p.document.getElementById('label').textContent = 'Friend';
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('article')).visibility, 'hidden');
});

test('the suggestion preference restores filtered posts live and hides later arrivals', async () => {
  const p = page('<main><article><header><span>Sponsored</span></header><img></article></main>', '/?variant=following', { hideSuggestions: false });
  await new Promise(resolve => setTimeout(resolve, 0));
  const post = p.document.querySelector('article');
  assert.notEqual(p.window.getComputedStyle(post).visibility, 'hidden');
  p.change({ hideSuggestions: { newValue: true } });
  assert.equal(p.window.getComputedStyle(post).visibility, 'hidden');
  p.document.querySelector('main').insertAdjacentHTML('beforeend', '<article id="later"><header><span>Suggested for you</span></header><img></article>');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(p.window.getComputedStyle(p.document.getElementById('later')).visibility, 'hidden');
  p.change({ hideSuggestions: { newValue: false } });
  for (const article of p.document.querySelectorAll('article')) assert.notEqual(p.window.getComputedStyle(article).visibility, 'hidden');
});

test('labeled posts remain native on intentionally opened profiles and photo viewers', () => {
  for (const path of ['/creator/', '/p/PHOTO/']) {
    const p = page('<main><article><header><span>Sponsored</span><span>Suggested for you</span></header><img></article></main>', path);
    assert.notEqual(p.window.getComputedStyle(p.document.querySelector('article')).display, 'none');
    assert.deepEqual(p.redirects, []);
  }
});

test('Following leaves inline Similar accounts controls untouched', () => {
  const p = page(`<main><article><button id="button"><svg aria-label="Similar accounts"></svg></button>
    <div id="role-button" role="button"><svg aria-label="Similar accounts"></svg></div></article></main>`);
  for (const id of ['button', 'role-button']) assert.notEqual(p.window.getComputedStyle(p.document.getElementById(id)).display, 'none', id);
  p.window.close();
});

test('Following feed videos keep native playback', () => {
  const p = page('<main><article><video></video></article></main>');
  const video = p.document.querySelector('video');
  let pauses = 0;
  video.pause = () => { pauses += 1; }; // jsdom has no media playback engine.
  video.dispatchEvent(new p.window.Event('play'));
  assert.equal(pauses, 0);
  p.window.close();
});

test('hidden suggested videos cannot start playing', () => {
  const p = page('<main><article><header><span>Suggested for you</span></header><video></video></article></main>');
  const video = p.document.querySelector('video');
  let pauses = 0;
  video.pause = () => { pauses += 1; };
  video.dispatchEvent(new p.window.Event('play'));
  assert.equal(pauses, 1);
  p.window.close();
});

test('a video permalink using /p/ returns to Following instead of a blank post', async () => {
  const p = page('<main><article><video></video></article></main>', '/p/VIDEO/');
  assert.deepEqual(p.redirects, ['https://www.instagram.com/?variant=following']);
  p.window.close();
});

test('the media presentation contract identifies only standalone videos', () => {
  const p = page(`<main>
    <article id="video"><video></video></article>
    <article id="carousel"><video></video><button aria-label="Go to slide 1"></button></article>
    <article id="photo"><img alt="Photo"></article>
  </main>`, '/direct/inbox/');
  for (const id of ['video', 'carousel', 'photo']) {
    const article = p.document.getElementById(id);
    assert.equal(article.hasAttribute('data-jf-standalone-video'), id === 'video', id);
    assert.equal(p.window.getComputedStyle(article).display === 'none', id === 'video', id);
  }
});

test('media classification follows relabeled carousel controls', async () => {
  const p = page('<main><article><video></video><button aria-label="Next"></button></article></main>', '/direct/inbox/');
  const article = p.document.querySelector('article');
  const control = p.document.querySelector('button');
  control.setAttribute('aria-label', 'Go to slide 1');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(article.hasAttribute('data-jf-standalone-video'), false);
  assert.notEqual(p.window.getComputedStyle(article).display, 'none');
  control.setAttribute('aria-label', 'Next');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(article.hasAttribute('data-jf-standalone-video'), true);
  assert.equal(p.window.getComputedStyle(article).display, 'none');
});

test('profile Story highlights and native suggestion controls remain visible', () => {
  const p = page(`<main><header><img alt="Friend's profile picture"><button id="similar"><svg aria-label="Similar accounts"></svg></button></header>
    <div role="menu" id="highlights"><ul><li><button>Travel highlight</button></li></ul></div>
    <article id="photo"><img alt="Photo"></article></main>`, '/friend/');
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('similar')).display, 'none');
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('highlights')).display, 'none');
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('header > img')).display, 'none');
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('photo')).display, 'none');
  p.window.close();
});

test('profile grids preserve Instagram’s account-prefixed Reel permalinks', () => {
  const p = page('<main><a id="missed" href="/friend/reel/ABC/"><svg aria-label="Clip"></svg></a><a id="photo" href="/friend/p/PHOTO/">Photo</a></main>', '/friend/');
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('missed')).display, 'none');
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('photo')).display, 'none');
  p.window.close();
});

test('account-prefixed Reel URLs are blocked when opened directly', () => {
  const p = page('<main>Reel player</main>', '/friend/reel/ABC/');
  assert.deepEqual(p.redirects, ['https://www.instagram.com/?variant=following']);
  p.window.close();
});

test('recommendation words in a profile bio do not erase its header', () => {
  const p = page('<main><header id="bio"><span>Suggested for you</span><img alt="Profile picture"></header><div><a href="/friend/p/PHOTO/">Photo</a></div></main>', '/friend/');
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('bio')).display, 'none');
  p.window.close();
});

test('Instagram’s div-based Similar accounts control stays visible on profiles', () => {
  const p = page('<main><div id="suggest" role="button"><div><svg aria-label="Similar accounts"></svg></div></div></main>', '/friend/');
  assert.notEqual(p.window.getComputedStyle(p.document.getElementById('suggest')).display, 'none');
  p.window.close();
});

test('native suggestions inserted inside the profile header stay visible with its details and highlights', async () => {
  const p = page(`<main><div><header id="profile"><div id="avatar"><img alt="Profile picture"></div>
    <section id="details"><h2>kodak</h2><button id="relationship">Follow</button></section>
    <section id="recommendations"></section>
    <section id="highlights"><div role="menu"><a href="/stories/highlights/123/">Story highlight</a></div></section></header>
    <div id="tabs" role="tablist"><a href="/kodak/">Posts</a></div>
    <div id="photos"><a href="/kodak/p/PHOTO/">Photo</a></div></div></main>`, '/kodak/');
  p.document.getElementById('relationship').textContent = 'Following';
  p.document.getElementById('recommendations').innerHTML = '<div><div><h4>Suggested for you</h4></div><a href="/explore/people/">See all</a></div><div><a href="/stranger/">Stranger</a><button>Follow</button></div>';
  await new Promise(resolve => setTimeout(resolve, 10));
  for (const id of ['profile', 'avatar', 'details', 'recommendations', 'highlights', 'tabs', 'photos']) {
    for (let node = p.document.getElementById(id); node && node !== p.document.body; node = node.parentElement) {
      assert.notEqual(p.window.getComputedStyle(node).display, 'none', id);
    }
  }
  assert.equal(p.document.querySelectorAll('[data-jf-hidden]').length, 0);
  p.window.close();
});

test('a carousel remains visible when Instagram preloads a video slide', async () => {
  const p = page('<main><article id="carousel"><img alt="Photo"><button aria-label="Next">Next</button><button aria-label="Go to slide 1"></button><button aria-label="Go to slide 2"></button></article></main>');
  const carousel = p.document.getElementById('carousel');
  carousel.insertAdjacentHTML('beforeend', '<video></video>');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.notEqual(p.window.getComputedStyle(carousel).display, 'none');
  assert.equal(p.document.getElementById('jf-empty'), null);
  p.window.close();
});

test('opening a mixed carousel keeps its native post instead of redirecting to Following', () => {
  const p = page('<main><article><img alt="Photo"><video></video><button aria-label="Go to slide 1"></button><button aria-label="Go to slide 2"></button></article></main>', '/p/CAROUSEL/');
  assert.deepEqual(p.redirects, []);
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('article')).display, 'none');
  p.window.close();
});

test('video slides inside a followed carousel keep native playback', () => {
  const p = page('<main><article><video></video><button aria-label="Go to slide 1"></button><button aria-label="Go to slide 2"></button></article></main>');
  const video = p.document.querySelector('video');
  let pauses = 0;
  video.pause = () => { pauses += 1; };
  video.dispatchEvent(new p.window.Event('play'));
  assert.equal(pauses, 0);
  p.window.close();
});


test('Home always opens Following even if removed preferences were previously saved', async () => {
  const p = page('<main>Home</main>', '/', { enabled: false, alwaysFollowing: false });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(p.redirects, ['https://www.instagram.com/?variant=following']);
});

test('Reels preference restores dedicated navigation and native video playback', async () => {
  const p = page('<nav><a id="reels" href="/reels/">Reels</a></nav><main><article><video></video></article></main>', '/reel/ABC/', { blockReels: false });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(p.redirects, []);
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('#reels')).display, 'none');
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('article')).display, 'none');
  let pauses = 0;
  p.document.querySelector('video').pause = () => pauses++;
  p.document.querySelector('video').dispatchEvent(new p.window.Event('play'));
  assert.equal(pauses, 0);
});

test('Explore preference restores discovery without changing Reels blocking', async () => {
  const p = page('<main><input aria-label="Search"><a id="tile" href="/p/ABC/">Discovery post</a></main>', '/explore/', { hideExplore: false });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('#tile')).display, 'none');
  p.window.history.pushState({}, '', '/explore/tags/photo/');
  p.window.dispatchEvent(new p.window.PopStateEvent('popstate'));
  assert.deepEqual(p.redirects, []);
});

test('suggestion preference restores the Following sidebar in place', async () => {
  const p = page('<main><section id="suggestions"><h4>Suggested for you</h4><a href="/explore/people/">See all</a><button>Follow</button></section><article>A native post</article></main>', '/?variant=following', {});
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(p.window.getComputedStyle(p.document.querySelector('#suggestions')).display, 'none');
  p.change({ hideSuggestions: { newValue: false } });
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('#suggestions')).display, 'none');
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('article')).display, 'none');
});

test('Stories can be hidden without hiding native posts and restored live', async () => {
  const p = page('<main><div aria-label="Stories" id="rail"><a href="/stories/friend/12/">Friend</a></div><article id="post">Photo</article></main>', '/?variant=following', { hideStories: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(p.window.getComputedStyle(p.document.querySelector('#rail')).display, 'none');
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('#post')).display, 'none');
  p.change({ hideStories: { newValue: false } });
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('#rail')).display, 'none');
  p.change({ hideStories: { newValue: true } });
  p.window.history.pushState({}, '', '/stories/friend/12/');
  p.window.dispatchEvent(new p.window.PopStateEvent('popstate'));
  assert.equal(p.redirects.length, 1);
});


test('Firefox isolated globals load saved preferences without accessing page globals', async () => {
  const p = page('<main>Explore</main>', '/explore/tags/photo/', { hideExplore: false }, true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(p.redirects, []);
  assert.equal(p.document.documentElement.dataset.jfRoute, 'other');
});

test('Story hiding collapses the native menu rail including its paging control', async () => {
  const p = page('<main><div role="menu" id="rail"><ul><li><a href="/stories/highlights/123/">Highlight</a></li></ul><button>Next</button></div><div role="menu" id="other">Account menu</div><article>Photo</article></main>', '/person/', { hideStories: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(p.window.getComputedStyle(p.document.querySelector('#rail')).display, 'none');
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('#other')).display, 'none');
});

test('a preference changed during startup wins over a stale storage read', async () => {
  let finish;
  const saved = new Promise(resolve => { finish = resolve; });
  const p = page('<main>Story</main>', '/stories/friend/12/', saved);
  assert.deepEqual(p.redirects, []);
  p.change({ hideStories: { newValue: false } });
  finish({ hideStories: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(p.redirects, []);
  assert.equal(p.document.documentElement.dataset.jfRoute, 'stories');
  p.change({ hideStories: { newValue: true } });
  assert.equal(p.redirects.length, 1);
});

test('Story hiding removes the native button rail when supplied on Following', async () => {
  const p = page('<main><div role="presentation" id="rail"><div><ul><li><div role="button" aria-label="Story by friend, not seen">Friend</div></li></ul></div><button>Next</button></div><article id="post">Native photo</article></main>', '/?variant=following', { hideStories: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(p.window.getComputedStyle(p.document.querySelector('#rail')).display, 'none');
  assert.notEqual(p.window.getComputedStyle(p.document.querySelector('#post')).display, 'none');
  assert.deepEqual(p.redirects, []);
});
