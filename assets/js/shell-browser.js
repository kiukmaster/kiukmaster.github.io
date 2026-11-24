(() => {
  'use strict';

  const hostFrame = window.frameElement;
  if (hostFrame?.id === 'blog-frame') {
    const notify = (name, detail) => hostFrame.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
    document.addEventListener('click', event => {
      const link = event.target.closest?.('a[href]');
      if (!link || event.defaultPrevented || link.hasAttribute('download')) return;
      const url = new URL(link.href);
      if (!['http:', 'https:'].includes(url.protocol)) {
        if (!['mailto:', 'tel:'].includes(url.protocol)) event.preventDefault();
        return;
      }
      if (url.origin !== location.origin || /\.[a-z0-9]+$/i.test(url.pathname) && !/\.html?$/i.test(url.pathname)) {
        link.target = '_blank';
        link.relList.add('noopener');
        return;
      }
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
      event.preventDefault();
      notify('kiuk:browser-navigate', { url: url.href, replace: false });
    });
    document.addEventListener('kiuk:location-replaced', () => {
      notify('kiuk:browser-navigate', { url: location.href, replace: true });
    });
    return;
  }

  const pane = document.getElementById('win-browser');
  if (!pane) return;
  const notice = document.getElementById('browser-notice');
  const status = document.getElementById('browser-status');
  const retry = document.getElementById('browser-retry');
  let frame = null;
  let requested = '';

  function load(url) {
    const keepFocus = frame && document.activeElement === frame;
    frame?.remove();
    const next = document.createElement('iframe');
    next.id = 'blog-frame';
    next.title = 'KIUK 블로그';
    next.addEventListener('load', () => {
      if (frame !== next) return;
      const doc = next.contentDocument;
      if (!doc?.getElementById('page-content')) {
        status.textContent = '페이지를 불러오지 못했습니다.';
        retry.hidden = false;
        return;
      }
      notice.hidden = true;
      if (doc.location.href !== requested) {
        next.dispatchEvent(new CustomEvent('kiuk:browser-navigate', {
          detail: { url: doc.location.href, replace: true }, bubbles: true
        }));
      }
    });
    // 프레임의 첫 로드만 사용해 방문 기록은 바깥 브라우저 한 곳에 쌓습니다.
    next.src = url.href;
    frame = next;
    notice.hidden = false;
    status.textContent = '페이지를 불러오는 중입니다.';
    retry.hidden = true;
    pane.prepend(next);
    if (keepFocus) next.focus({ preventScroll: true });
  }

  function show(value) {
    const url = new URL(value, location.href);
    if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) return;
    pane.hidden = false;
    if (requested === url.href) return;
    requested = url.href;
    const current = frame?.contentDocument?.location;
    if (current?.href === requested) return;
    if (current?.origin === url.origin && current.pathname === url.pathname && current.search === url.search) {
      current.replace(url.href);
      return;
    }
    load(url);
  }

  function hide() {
    frame?.remove();
    frame = null;
    requested = '';
    pane.hidden = true;
  }

  retry.addEventListener('click', () => { if (requested) load(new URL(requested)); });
  window.kiukBrowser = { show, hide, focus: () => frame?.focus({ preventScroll: true }) };
})();
