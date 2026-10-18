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

const sourcePath = new URL('../content.js', import.meta.url);
const cssPath = new URL('../content.css', import.meta.url);
function page(html = '', path = '/?variant=following') {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => { errors.push(error); pageErrors.push(error.message); });
  const dom = new JSDOM(html, { url: `https://www.instagram.com${path}`, runScripts: 'outside-only', virtualConsole });
  openPages.add(dom.window);
  const redirects = [];
  if (existsSync(cssPath)) {
    const style = dom.window.document.createElement('style');
    style.textContent = readFileSync(cssPath, 'utf8');
    dom.window.document.head.append(style);
  }
  if (existsSync(sourcePath)) {
    dom.window.module = { exports: {} };
    dom.window.eval(readFileSync(sourcePath, 'utf8'));
    dom.window.module.exports.start(dom.window, href => redirects.push(href));
  }
  return { dom, window: dom.window, document: dom.window.document, redirects, errors };
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

test('posts supplied by Following keep their native viewer regardless of suggestion wording', () => {
  const p = page('<main><article><header><span>Suggested for you</span></header><a href="/stranger/reel/SUGGESTED/">Reel</a></article></main>');
  p.window.history.pushState({}, '', '/stranger/reel/SUGGESTED/');
  p.document.querySelector('main').innerHTML = '<article><video></video></article>';
  p.window.dispatchEvent(new p.window.PopStateEvent('popstate'));
  assert.deepEqual(p.redirects, []);
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

test('Following hides only the account sidebar while preserving native feed content', () => {
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
  for (const id of ['suggested', 'sponsored', 'friend', 'suggested-posts', 'suggested-reels', 'discover', 'account', 'footer']) {
    for (let node = p.document.getElementById(id); node && node !== p.document.body; node = node.parentElement) {
      assert.notEqual(p.window.getComputedStyle(node).display, 'none', id);
    }
  }
  p.window.close();
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

test('Following does not pause native videos based on suggestion wording', () => {
  const p = page('<main><article><header><span>Suggested for you</span></header><video></video></article></main>');
  const video = p.document.querySelector('video');
  let pauses = 0;
  video.pause = () => { pauses += 1; };
  video.dispatchEvent(new p.window.Event('play'));
  assert.equal(pauses, 0);
  p.window.close();
});

test('a video permalink using /p/ returns to Following instead of a blank post', async () => {
  const p = page('<main><article><video></video></article></main>', '/p/VIDEO/');
  assert.deepEqual(p.redirects, ['https://www.instagram.com/?variant=following']);
  p.window.close();
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
