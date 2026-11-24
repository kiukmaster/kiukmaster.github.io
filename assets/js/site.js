(() => {
  'use strict';
  const labels = {{ hugo.Data.ui | jsonify | safeJS }};
  const root = document.documentElement;
  const prefix = `blog:${root.dataset.storageRoot || '/'}:`;
  const storage = {
    get(key, fallback) { try { return localStorage.getItem(prefix + key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(prefix + key, value); } catch { /* 저장하지 못해도 현재 화면에는 적용합니다. */ } }
  };
  let language = root.lang === 'en' ? 'en' : 'ko';
  let refreshFeedLabels = () => {};
  let scheduleProgress = () => {};
  let noticeTimer;
  const t = key => labels[key]?.[language === 'en' ? 1 : 0] || key;

  function applyLanguage() {
    root.lang = language;
    document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    for (const [data, attribute] of [['i18nAria', 'aria-label'], ['i18nPlaceholder', 'placeholder'], ['i18nTitle', 'title']]) {
      const selector = data.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
      document.querySelectorAll(`[data-${selector}]`).forEach(element => element.setAttribute(attribute, t(element.dataset[data])));
    }
    document.querySelectorAll('[data-ko][data-en]').forEach(element => { element.textContent = element.dataset[language] || element.dataset.ko; });
    document.querySelectorAll('[data-lang]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lang === language)));
    const name = document.querySelector('.profile-name');
    const avatar = document.querySelector('.avatar');
    if (name && avatar) avatar.alt = name.textContent;
    refreshFeedLabels();
    scheduleProgress();
  }

  function notify(key) {
    const notice = document.getElementById('notice');
    if (!notice) return;
    clearTimeout(noticeTimer);
    notice.dataset.i18n = key;
    notice.textContent = t(key);
    notice.hidden = false;
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 3500);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
    } catch { /* 권한이 없으면 브라우저의 선택 영역 복사를 시도합니다. */ }
    const previous = document.activeElement;
    const field = document.createElement('textarea');
    field.value = text;
    field.tabIndex = -1;
    field.style.position = 'fixed';
    field.style.left = '-10000px';
    document.body.append(field);
    field.select();
    try { return document.execCommand('copy'); }
    catch { return false; }
    finally { field.remove(); previous?.focus({ preventScroll: true }); }
  }

  function localPath(value) {
    if (typeof value !== 'string' || !value || /[\u0000-\u0020\u007f\\]/.test(value)) throw new Error('Invalid local URL');
    const url = new URL(value, location.origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== location.origin || url.username || url.password || url.search || url.hash) throw new Error('Invalid local URL');
    return url.pathname;
  }

  function validateIndex(data) {
    if (data?.version !== 1 || !Array.isArray(data.posts)) throw new Error('Invalid post index');
    const seen = new Set();
    return data.posts.map(post => {
      if (!post || typeof post.title !== 'string' || !post.title.trim() || typeof post.excerpt !== 'string' || typeof post.searchText !== 'string' || typeof post.date !== 'string' || !Number.isSafeInteger(post.timestamp) || Date.parse(post.date) !== post.timestamp) throw new Error('Invalid post');
      const url = localPath(post.url);
      if (seen.has(url)) throw new Error('Duplicate post URL');
      seen.add(url);
      const terms = values => {
        if (!Array.isArray(values)) throw new Error('Invalid terms');
        return values.map(term => {
          if (!term || typeof term.name !== 'string' || !term.name.trim()) throw new Error('Invalid term');
          return { name: term.name, url: localPath(term.url) };
        });
      };
      return { ...post, url, categories: terms(post.categories), tags: terms(post.tags) };
    });
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const dateFormat = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function card(post) {
    const article = element('article', 'post-card');
    article.lang = 'ko';
    const parts = Object.fromEntries(dateFormat.formatToParts(new Date(post.timestamp)).map(part => [part.type, part.value]));
    const time = element('time', 'post-date');
    time.dateTime = post.date;
    time.append(element('span', 'date-year', parts.year), element('span', 'date-day', `${parts.month}.${parts.day}`), element('span', 'date-clock', `${parts.hour}:${parts.minute}`));
    const content = element('div', 'post-content');
    const categories = element('div', 'card-categories');
    post.categories.forEach(category => { const link = element('a', `category-label${category.name === '공모전 / 자격증' ? ' activity' : ''}`, category.name); link.href = category.url; categories.append(link); });
    const title = element('h2');
    const link = element('a', '', post.title);
    link.href = post.url;
    title.append(link);
    content.append(categories, title);
    if (post.excerpt) content.append(element('p', 'card-excerpt', post.excerpt));
    if (post.tags.length) {
      const tags = element('div', 'tag-list');
      post.tags.forEach(tag => { const link = element('a', 'tag', tag.name); link.href = tag.url; tags.append(link); });
      content.append(tags);
    }
    const arrow = element('span', 'post-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    article.append(time, content, arrow);
    return article;
  }

  function initFeed(feed) {
    const list = document.getElementById('post-list');
    const form = document.getElementById('search-form');
    const search = document.getElementById('search');
    const sort = document.getElementById('sort');
    const reset = document.getElementById('reset');
    const more = document.getElementById('more');
    const pagination = document.getElementById('pagination');
    const nextPage = pagination.querySelector('[data-i18n="nextPage"]');
    const previousPage = pagination.querySelector('[data-i18n="prevPage"]');
    const error = document.getElementById('feed-error');
    const retry = document.getElementById('retry');
    const count = document.getElementById('results-count');
    const params = new URLSearchParams(location.search);
    const listRoot = localPath(feed.dataset.listRoot || '/posts/');
    const pageSize = Math.max(1, Number(feed.dataset.pageSize) || 8);
    const state = {
      q: params.get('q') || '',
      category: feed.dataset.category || params.get('category') || '',
      tag: feed.dataset.tag || params.get('tag') || '',
      sort: ['newest', 'oldest', 'title'].includes(params.get('sort')) ? params.get('sort') : 'newest'
    };
    let start = (Math.max(1, Number(feed.dataset.pageNumber) || 1) - 1) * pageSize;
    const initialEnd = start + list.querySelectorAll('.post-card').length;
    let end = initialEnd;
    let total = Number(feed.dataset.total) || 0;
    let indexPromise;
    let request = 0;
    let timer;
    let failedMode = null;
    let composing = false;
    const inBlogFrame = window.frameElement?.id === 'blog-frame';
    const stored = inBlogFrame ? window.parent.history.state?.kiukClassicList : null;
    const restored = stored?.url === location.href ? stored : null;
    const queryKey = () => JSON.stringify([state.q, state.category, state.tag, state.sort]);
    const initialQuery = JSON.stringify(['', feed.dataset.category || '', feed.dataset.tag || '', 'newest']);
    let renderedQuery = initialQuery;
    search.value = state.q;
    sort.value = state.sort;

    function updateControls() {
      count.textContent = `${total} ${t('entries')}`;
      reset.hidden = !(state.q || state.category || state.tag || state.sort !== 'newest');
      more.hidden = Boolean(failedMode) || end >= total || queryKey() !== renderedQuery;
      if (nextPage) nextPage.hidden = !failedMode || end !== initialEnd || renderedQuery !== initialQuery;
      if (previousPage) previousPage.hidden = start === 0;
      pagination.hidden = !pagination.querySelector('a:not([hidden])');
      document.querySelectorAll('.category-link').forEach(link => {
        const active = state.category ? link.querySelector('span')?.textContent === state.category : new URL(link.href).pathname === '/posts/';
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
      });
    }
    refreshFeedLabels = updateControls;

    function writeURL() {
      const url = new URL(listRoot, location.origin);
      for (const key of ['q', 'category', 'tag']) if (state[key]) url.searchParams.set(key, state[key]);
      if (state.sort !== 'newest') url.searchParams.set('sort', state.sort);
      if (url.pathname === location.pathname && url.search === location.search) return;
      history.replaceState(null, '', url.pathname + url.search);
      document.dispatchEvent(new Event('kiuk:location-replaced'));
    }

    function getPosts() {
      if (!indexPromise) {
        indexPromise = fetch(localPath(feed.dataset.index), { mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-cache' })
          .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
          .then(validateIndex)
          .catch(reason => { indexPromise = undefined; throw reason; });
      }
      return indexPromise;
    }

    function filtered(posts, current) {
      const normalize = value => value.normalize('NFKC').toLocaleLowerCase();
      const words = normalize(current.q).trim().split(/\s+/).filter(Boolean);
      const result = posts.filter(post => {
        if (current.category && !post.categories.some(term => term.name === current.category)) return false;
        if (current.tag && !post.tags.some(term => term.name === current.tag)) return false;
        const text = normalize([post.title, post.excerpt, post.searchText, ...post.categories.map(term => term.name), ...post.tags.map(term => term.name)].join(' '));
        return words.every(word => text.includes(word));
      });
      return result.sort((a, b) => {
        const primary = current.sort === 'title' ? a.title.localeCompare(b.title, 'ko') : (a.timestamp - b.timestamp) * (current.sort === 'newest' ? -1 : 1);
        return primary || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
      });
    }

    async function load(mode, trigger, amount = pageSize) {
      clearTimeout(timer);
      if (mode === 'more' && queryKey() !== renderedQuery) mode = 'reset';
      const triggeredWithFocus = trigger && document.activeElement === trigger;
      const shouldMoveFocus = () => triggeredWithFocus && (document.activeElement === trigger || document.activeElement === document.body);
      const token = ++request;
      const current = { ...state };
      const currentQuery = queryKey();
      if (mode === 'reset') writeURL();
      error.hidden = true;
      feed.setAttribute('aria-busy', 'true');
      more.disabled = true;
      try {
        const posts = await getPosts();
        if (token !== request) return;
        const result = filtered(posts, current);
        const nextStart = mode === 'reset' ? 0 : start;
        const nextEnd = Math.min((mode === 'reset' ? 0 : end) + amount, result.length);
        const shown = mode === 'more' ? Array.from(list.querySelectorAll('.post-card h2 a'), link => link.pathname) : [];
        const canAppend = mode === 'more' && shown.every((path, index) => path === result[nextStart + index]?.url);
        const fragment = document.createDocumentFragment();
        let firstAddedTitle;
        result.slice(canAppend ? end : nextStart, nextEnd).forEach(post => {
          const entry = card(post);
          if (mode === 'more' && !firstAddedTitle && (canAppend || !shown.includes(post.url))) firstAddedTitle = entry.querySelector('h2 a');
          fragment.append(entry);
        });
        if (!result.length) {
          const key = current.q || current.category || current.tag ? 'noResults' : 'noPosts';
          const empty = element('p', 'empty-state', t(key));
          empty.dataset.i18n = key;
          fragment.append(empty);
        }
        if (canAppend) list.append(fragment);
        else list.replaceChildren(fragment);
        start = nextStart;
        end = nextEnd;
        total = result.length;
        renderedQuery = currentQuery;
        failedMode = null;
        updateControls();
        if (shouldMoveFocus()) (firstAddedTitle || search).focus();
        if (inBlogFrame && trigger) rememberList();
      } catch {
        if (token !== request) return;
        failedMode = mode;
        error.hidden = false;
        updateControls();
        if (shouldMoveFocus()) retry.focus();
      } finally {
        if (token === request) { feed.removeAttribute('aria-busy'); more.disabled = false; }
      }
    }

    function onInput() {
      state.q = search.value;
      ++request;
      clearTimeout(timer);
      updateControls();
      if (!composing) timer = setTimeout(() => load('reset'), 150);
    }
    search.addEventListener('compositionstart', () => { composing = true; ++request; clearTimeout(timer); });
    search.addEventListener('compositionend', () => { composing = false; onInput(); });
    search.addEventListener('input', onInput);
    form.addEventListener('submit', event => { event.preventDefault(); state.q = search.value; load('reset'); });
    sort.addEventListener('change', () => { state.sort = ['newest', 'oldest', 'title'].includes(sort.value) ? sort.value : 'newest'; load('reset'); });
    document.addEventListener('keydown', event => {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input, textarea, select, [contenteditable]')) {
        event.preventDefault();
        search.focus();
      }
    });
    more.addEventListener('click', () => load('more', more));
    retry.addEventListener('click', () => load(failedMode, retry));
    function rememberList() {
      if (!window.frameElement?.isConnected || window.parent.location.href !== location.href || renderedQuery !== queryKey()) return;
      const focus = document.activeElement?.closest('.post-card h2 a')?.href || '';
      const snapshot = { url: location.href, count: end - start, y: window.scrollY, focus };
      const navigation = window.parent.history;
      navigation.replaceState({ ...navigation.state, kiukClassicList: snapshot }, '');
    }

    if (inBlogFrame) {
      // 링크가 바깥 주소창을 바꾸기 전에 돌아올 목록의 위치를 기록합니다.
      document.addEventListener('click', event => {
        if (event.target.closest?.('a[href]')) rememberList();
      }, true);
      window.addEventListener('scrollend', rememberList);
    } else window.addEventListener('popstate', () => location.reload());
    updateControls();
    const hasFilters = ['q', 'category', 'tag', 'sort'].some(key => params.get(key));
    const countToShow = Math.max(pageSize, restored?.count || 0);
    let ready;
    if (hasFilters) ready = load('reset', null, countToShow);
    else if (restored?.count > end - start) ready = load('more', null, restored.count - (end - start));
    if (restored) {
      const restoreRequest = request;
      Promise.resolve(ready).then(() => {
        if (restoreRequest !== request || failedMode || !window.frameElement?.isConnected || window.parent.location.href !== location.href) return;
        const link = Array.from(list.querySelectorAll('h2 a')).find(item => item.href === restored.focus);
        if (link && document.activeElement === document.body) link.focus({ preventScroll: true });
        window.scrollTo({ top: restored.y, behavior: 'instant' });
      });
    }
  }

  function initArticle() {
    document.querySelectorAll('.prose pre').forEach(pre => {
      const text = pre.querySelector('code')?.textContent || pre.textContent;
      const button = element('button', 'copy-code', t('copy'));
      button.type = 'button';
      button.dataset.i18n = 'copy';
      button.addEventListener('click', async () => { button.disabled = true; notify(await copyText(text) ? 'copied' : 'copyFail'); button.disabled = false; });
      pre.append(button);
    });
    document.getElementById('copy-link')?.addEventListener('click', async () => {
      const url = new URL(location.href);
      url.hash = '';
      notify(await copyText(url.href) ? 'copied' : 'copyFail');
    });
    const article = document.getElementById('article-body');
    if (!article) return;
    const progress = document.getElementById('reading-progress');
    const headings = [...article.querySelectorAll('h2[id], h3[id], h4[id]')];
    const links = [...document.querySelectorAll('.toc-list a[href^="#"]')].map(link => {
      let id = link.hash.slice(1);
      try { id = decodeURIComponent(id); } catch { /* 문자 그대로 작성한 앵커도 허용합니다. */ }
      return { link, id };
    });
    let currentHeading;
    let scheduled = false;
    scheduleProgress = () => {
      if (scheduled || !progress) return;
      scheduled = true;
      requestAnimationFrame(() => {
        const box = article.getBoundingClientRect();
        const header = document.querySelector('.site-header')?.offsetHeight || 0;
        const available = box.height - window.innerHeight + header;
        const fraction = available > 0 ? Math.min(1, Math.max(0, (header - box.top) / available)) : Number(box.bottom <= window.innerHeight);
        progress.style.width = `${fraction * 100}%`;
        const anchorTop = parseFloat(getComputedStyle(root).scrollPaddingTop) || header;
        let current;
        for (const heading of headings) {
          if (heading.getBoundingClientRect().top > anchorTop + 1) break;
          current = heading;
        }
        if (current !== currentHeading) {
          currentHeading = current;
          links.forEach(({ link, id }) => {
            const active = current?.id === id;
            link.classList.toggle('active', active);
            if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
          });
        }
        scheduled = false;
      });
    };
    window.addEventListener('scroll', scheduleProgress, { passive: true });
    window.addEventListener('resize', scheduleProgress);
    article.addEventListener('toggle', scheduleProgress, true);
    article.querySelectorAll('img').forEach(image => image.addEventListener('load', scheduleProgress));
    scheduleProgress();

  }

  document.addEventListener('click', async event => {
    const email = event.target.closest('button[data-email]');
    if (!email || email.disabled) return;
    email.disabled = true;
    try { notify(await copyText(email.dataset.email) ? 'emailCopied' : 'copyFail'); }
    finally { email.disabled = false; }
  });
  if (root.classList.contains('shell-ready')) return;

  document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', () => {
    if (!['ko', 'en'].includes(button.dataset.lang)) return;
    language = button.dataset.lang;
    storage.set('lang', language);
    applyLanguage();
  }));
  const feed = document.getElementById('post-feed');
  if (feed) initFeed(feed);
  initArticle();
  applyLanguage();
  document.querySelectorAll('[data-js]').forEach(element => { element.hidden = false; });
})();
