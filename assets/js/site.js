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
    const meta = element('div', 'card-meta');
    const parts = Object.fromEntries(dateFormat.formatToParts(new Date(post.timestamp)).map(part => [part.type, part.value]));
    const time = element('time', '', `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`);
    time.dateTime = post.date;
    meta.append(time);
    post.categories.forEach(category => { const link = element('a', 'category-label', category.name); link.href = category.url; meta.append(link); });
    const title = element('h2');
    const link = element('a', '', post.title);
    link.href = post.url;
    title.append(link);
    article.append(meta, title);
    if (post.excerpt) article.append(element('p', 'card-excerpt', post.excerpt));
    if (post.tags.length) {
      const tags = element('div', 'tag-list');
      post.tags.forEach(tag => { const link = element('a', 'tag', tag.name); link.href = tag.url; tags.append(link); });
      article.append(tags);
    }
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
    const error = document.getElementById('feed-error');
    const count = document.getElementById('results-count');
    const params = new URLSearchParams(location.search);
    const listRoot = localPath(feed.dataset.listRoot || '/');
    const pageSize = Math.max(1, Number(feed.dataset.pageSize) || 8);
    const state = {
      q: params.get('q') || '',
      category: feed.dataset.category || params.get('category') || '',
      tag: feed.dataset.tag || params.get('tag') || '',
      sort: ['newest', 'oldest', 'title'].includes(params.get('sort')) ? params.get('sort') : 'newest'
    };
    let start = (Math.max(1, Number(feed.dataset.pageNumber) || 1) - 1) * pageSize;
    let end = start + list.querySelectorAll('.post-card').length;
    let total = Number(feed.dataset.total) || 0;
    let indexPromise;
    let request = 0;
    let timer;
    let failedMode = 'reset';
    let composing = false;
    const queryKey = () => JSON.stringify([state.q, state.category, state.tag, state.sort]);
    let renderedQuery = JSON.stringify(['', feed.dataset.category || '', feed.dataset.tag || '', 'newest']);
    search.value = state.q;
    sort.value = state.sort;

    function updateControls() {
      count.textContent = `${total} ${t('entries')}`;
      reset.hidden = !(state.q || state.category || state.tag || state.sort !== 'newest');
      more.hidden = end >= total || queryKey() !== renderedQuery;
      document.querySelectorAll('.category-link').forEach(link => {
        const active = state.category ? link.querySelector('span')?.textContent === state.category : new URL(link.href).pathname === '/';
        link.classList.toggle('active', active);
      });
    }
    refreshFeedLabels = updateControls;

    function applyView(value) {
      const view = value === 'list' ? 'list' : 'grid';
      list.dataset.view = view;
      document.querySelectorAll('[data-view]').forEach(button => {
        if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.view === view));
      });
    }
    applyView(storage.get('view', 'grid'));
    document.querySelectorAll('button[data-view]').forEach(button => button.addEventListener('click', () => { storage.set('view', button.dataset.view); applyView(button.dataset.view); }));

    function writeURL() {
      const url = new URL(listRoot, location.origin);
      for (const key of ['q', 'category', 'tag']) if (state[key]) url.searchParams.set(key, state[key]);
      if (state.sort !== 'newest') url.searchParams.set('sort', state.sort);
      history.replaceState(null, '', url.pathname + url.search);
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

    async function load(mode) {
      clearTimeout(timer);
      if (mode === 'more' && queryKey() !== renderedQuery) mode = 'reset';
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
        const nextEnd = Math.min(mode === 'reset' ? pageSize : end + pageSize, result.length);
        const fragment = document.createDocumentFragment();
        result.slice(nextStart, nextEnd).forEach(post => fragment.append(card(post)));
        if (!result.length) {
          const key = current.q || current.category || current.tag ? 'noResults' : 'noPosts';
          const empty = element('p', 'empty-state', t(key));
          empty.dataset.i18n = key;
          fragment.append(empty);
        }
        list.replaceChildren(fragment);
        start = nextStart;
        end = nextEnd;
        total = result.length;
        renderedQuery = currentQuery;
        pagination.querySelector('[data-i18n="nextPage"]')?.setAttribute('hidden', '');
        if (mode === 'reset') pagination.hidden = true;
        updateControls();
      } catch {
        if (token !== request) return;
        failedMode = mode;
        error.hidden = false;
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
    reset.addEventListener('click', () => location.assign('/'));
    more.addEventListener('click', () => load('more'));
    document.getElementById('retry').addEventListener('click', () => load(failedMode));
    window.addEventListener('popstate', () => location.reload());
    updateControls();
    if (['q', 'category', 'tag', 'sort'].some(key => params.get(key))) load('reset');
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
        scheduled = false;
      });
    };
    window.addEventListener('scroll', scheduleProgress, { passive: true });
    window.addEventListener('resize', scheduleProgress);
    article.addEventListener('toggle', scheduleProgress, true);
    article.querySelectorAll('img').forEach(image => image.addEventListener('load', scheduleProgress));
    scheduleProgress();

    if ('IntersectionObserver' in window) {
      const headings = [...article.querySelectorAll('h2[id], h3[id], h4[id]')];
      const links = [...document.querySelectorAll('.toc-list a[href^="#"]')];
      const visible = new Set();
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target); });
        const current = headings.find(heading => visible.has(heading));
        if (!current) return;
        links.forEach(link => {
          let active = false;
          try { active = decodeURIComponent(link.hash.slice(1)) === current.id; } catch { /* 잘못된 앵커는 활성화하지 않습니다. */ }
          link.classList.toggle('active', active);
          if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
        });
      }, { rootMargin: '-15% 0px -60% 0px' });
      headings.forEach(heading => observer.observe(heading));
    }
  }

  const theme = document.getElementById('theme');
  if (theme) {
    theme.value = ['light', 'gray', 'dark'].includes(root.dataset.theme) ? root.dataset.theme : 'gray';
    theme.addEventListener('change', () => {
      if (!['light', 'gray', 'dark'].includes(theme.value)) return;
      root.dataset.theme = theme.value;
      storage.set('theme', theme.value);
    });
  }
  document.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', () => {
    if (!['ko', 'en'].includes(button.dataset.lang)) return;
    language = button.dataset.lang;
    storage.set('lang', language);
    applyLanguage();
  }));
  const email = document.getElementById('copy-email');
  email?.addEventListener('click', async () => {
    email.disabled = true;
    notify(await copyText(email.dataset.email) ? 'emailCopied' : 'copyFail');
    email.disabled = false;
  });
  const feed = document.getElementById('post-feed');
  if (feed) initFeed(feed);
  initArticle();
  applyLanguage();
  document.querySelectorAll('[data-js]').forEach(element => { element.hidden = false; });
})();
