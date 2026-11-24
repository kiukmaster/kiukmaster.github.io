(function () {
  'use strict';

  if (window.frameElement?.id === 'blog-frame') return;
  const term = document.querySelector('.term[data-start-path]');
  const catalog = document.getElementById('shell-catalog');
  const params = new URLSearchParams(location.search);
  const savedNavigation = window.history.state?.kiukShell;
  const classicSessionKey = 'terminal-blog.classic-folder';
  function classicFolder() {
    try { return sessionStorage.getItem(classicSessionKey); }
    catch { return null; }
  }
  function rememberClassicFolder(folder) {
    try {
      if (folder) sessionStorage.setItem(classicSessionKey, folder);
      else sessionStorage.removeItem(classicSessionKey);
    } catch { /* 저장소가 제한된 탭에서는 방문 기록으로 복원합니다. */ }
  }
  const resumeFolder = classicFolder();
  const resumeBrowser = Boolean(resumeFolder) || savedNavigation?.browser === location.href;
  if (!term || !catalog || (!resumeBrowser && (params.get('view') === 'page' ||
      ['q', 'sort', 'tag', 'category'].some(key => params.has(key)) ||
      /\/page\/\d+\/?$/.test(location.pathname)))) return;

  let files;
  try {
    files = JSON.parse(catalog.content.textContent);
  } catch {
    return;
  }
  const home = '~';
  const absoluteHome = '/home/guest';
  const posts = '~/posts';
  const about = '~/about.md';
  const startPath = term.dataset.startPath;
  if (!files?.[home]?.dir || !Array.isArray(files[home].kids) || !files[startPath]) return;

  const host = term.dataset.host || 'kiuk';
  const byId = id => document.getElementById(id);
  const out = byId('out');
  const input = byId('cmd');
  const win = byId('win');
  const article = byId('tpl-shell-article').content.firstElementChild.cloneNode(true);
  const body = article.querySelector('[data-article-body]');
  const title = article.querySelector('[data-article-title]');
  const cands = byId('cands');
  const chips = byId('chips');
  const commandHelp = {
    help: '명령어 목록을 봅니다.',
    ls: '폴더 안의 글과 폴더를 봅니다.',
    page: '글 목록의 다음 페이지를 봅니다.',
    open: '인자 없이 블로그를 열고, 제목을 넣으면 본문을 출력합니다.',
    cd: '폴더를 이동합니다.',
    contact: '연락처를 봅니다.',
    whoami: '현재 사용자 이름을 봅니다.',
    pwd: '현재 폴더의 전체 경로를 봅니다.',
    date: '현재 날짜와 시각을 봅니다.',
    echo: '입력한 말을 그대로 출력합니다.',
    cowsay: '문자로 그린 소가 한마디 합니다.',
    sudo: '관리자 권한을 요청합니다.',
    clear: '터미널 화면을 비웁니다.'
  };
  const commands = Object.keys(commandHelp);
  const pathCommands = ['ls', 'cd', 'open', 'cat'];
  const inputCommands = [...pathCommands, 'echo'];
  const desktopPointer = window.matchMedia?.('(hover: hover) and (pointer: fine)');
  const state = { cwd: home, view: '', browser: '', log: [], seq: 0 };
  const postsPerPage = 10;
  let lastListing = null;
  let passwordAttempts = 0;
  let passwordCheck = 0;
  const commandPlaceholder = input.placeholder;
  const commandLabel = input.getAttribute('aria-label');

  function parentPath(path) {
    return path.slice(0, path.lastIndexOf('/')) || home;
  }

  const legacySections = new Map([
    ['글', posts], ['대회', '~/contests'], ['진행중', '~/ongoing'],
    ['카테고리', '~/categories'], ['태그', '~/tags']
  ]);
  const names = new Map();
  const children = new Map();
  const entries = Object.entries(files);
  const directories = entries.filter(([, node]) => node.dir);
  const collisions = [];
  for (const [path] of directories) children.set(path, new Map());
  for (const [path, node] of [...directories, ...entries.filter(([, node]) => !node.dir)]) {
    if (path === home) continue;
    const parent = parentPath(path);
    const directory = children.get(parent);
    const name = node.dir && parent === home ? path.slice(home.length + 1) : node.title;
    if (directory.has(name) || ['.', '..', '~'].includes(name)) {
      collisions.push([path, name]);
    } else {
      names.set(path, name);
      directory.set(name, path);
    }
  }
  for (const [path, title] of collisions) {
    const directory = children.get(parentPath(path));
    let number = 2;
    let name;
    do { name = title + ' (' + number++ + ')'; } while (directory.has(name));
    names.set(path, name);
    directory.set(name, path);
  }

  function displayPath(path) {
    if (path === home) return home;
    return displayPath(parentPath(path)) + '/' + names.get(path);
  }

  // 제목 안에도 슬래시가 들어갈 수 있어 실제로 등록된 폴더까지만 경로로 해석합니다.
  function splitPath(cwd, value) {
    let prefix = '';
    let folder = cwd;
    let name = value;
    if (value === home || value.startsWith('~/') || value.startsWith('/')) {
      folder = home;
      if (value === absoluteHome || value.startsWith(absoluteHome + '/')) prefix = absoluteHome + '/';
      else prefix = value.startsWith('/') ? '/' : '~/';
      name = value === home || value === absoluteHome ? '' : value.slice(prefix.length);
    }
    while (name.includes('/') && !children.get(folder).has(name)) {
      const cut = name.indexOf('/');
      const part = name.slice(0, cut);
      if (!part || part === '.' || part === '..') {
        if (part === '..' && folder !== home) folder = parentPath(folder);
        prefix += name.slice(0, cut + 1);
        name = name.slice(cut + 1);
        continue;
      }
      let match = '';
      let next;
      for (const [label, child] of children.get(folder)) {
        if (files[child].dir && label.length > match.length && name.startsWith(label + '/')) {
          match = label;
          next = child;
        }
      }
      if (!next) {
        next = childPath(folder, part);
        if (!files[next]?.dir) break;
        match = part;
      }
      folder = next;
      prefix += names.get(folder) + '/';
      name = name.slice(match.length + 1);
    }
    return { prefix, folder, name };
  }

  function childPath(folder, name) {
    const child = children.get(folder).get(name);
    if (child) return child;
    if (folder === home) {
      if (legacySections.has(name)) return legacySections.get(name);
      if (name === files[about]?.heading) return about;
    }
    return folder + '/' + name;
  }

  function resolve(cwd, value) {
    const { folder, name } = splitPath(cwd, value);
    if (!name || name === '.') return folder;
    if (name === '..') return parentPath(folder);
    return childPath(folder, name);
  }

  function quotePath(path, quote = '') {
    if (!quote && !/[\s"'\\]/.test(path)) return path;
    if (quote === "'" && !path.includes("'")) return "'" + path + "'";
    return '"' + path.replace(/["\\]/g, '\\$&') + '"';
  }

  function commandFor(verb, path) {
    if (!path || path === state.cwd) return verb;
    const shown = displayPath(path);
    let relative = path.startsWith(state.cwd + '/') ? shown.slice(displayPath(state.cwd).length + 1) : shown;
    if (relative !== shown && (relative.startsWith('/') || relative.startsWith('~/'))) relative = './' + relative;
    return verb + ' ' + quotePath(relative);
  }

  // 모든 경로 명령은 한 경로를 받으므로 따옴표 밖의 공백도 파일 이름에 쓸 수 있습니다.
  function readPath(raw) {
    let value = '';
    let quote = '';
    let escaped = false;
    for (const char of raw) {
      if (escaped) { value += char; escaped = false; }
      else if (char === '\\' && quote !== "'") escaped = true;
      else if (quote && char === quote) quote = '';
      else if (!quote && (char === '"' || char === "'")) quote = char;
      else value += char;
    }
    return { value, unfinished: Boolean(quote || escaped) };
  }

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'onclick') node.addEventListener('click', value);
      else node.setAttribute(key, value);
    }
    node.append(...children);
    return node;
  }

  function icon(dir) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    for (const [key, value] of Object.entries({
      width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    })) svg.setAttribute(key, value);
    const outline = document.createElementNS(ns, 'path');
    outline.setAttribute('d', dir
      ? 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'
      : 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z');
    svg.append(outline);
    if (!dir) {
      const corner = document.createElementNS(ns, 'polyline');
      corner.setAttribute('points', '14 3 14 8 19 8');
      svg.append(corner);
    }
    return el('span', { class: 'ico', 'aria-hidden': 'true' }, svg);
  }

  const icons = { dir: icon(true), file: icon(false) };

  function promptNode(path) {
    const prompt = document.createDocumentFragment();
    prompt.append(el('span', { class: 'ps-user' }, 'guest@' + host), ':',
      el('span', { class: 'ps-path' }, displayPath(path)), '$');
    return prompt;
  }

  function runButton(cls, command, ...children) {
    return el('button', { type: 'button', class: cls, onclick: () => typeAndRun(command) }, ...children);
  }

  function actionChip(label, command) {
    return runButton('chip', command, el('span', { class: 'chip-main' }, label),
      el('span', { class: 'chip-hint' }, '$ ' + command));
  }

  function add(entry) {
    entry.id = 'e' + ++state.seq;
    state.log.push(entry);
  }

  function say(kind, text, fixVerb, fixPath, fixLabel) {
    add({ kind, text, fixVerb, fixPath, fixLabel });
  }

  function listDirectory(path, number = 1) {
    const folder = files[path];
    const pages = folder.postList ? Math.max(1, Math.ceil(folder.kids.length / postsPerPage)) : 0;
    const entry = { kind: 'ls', path, number, pages };
    lastListing = pages ? entry : null;
    add(entry);
  }

  function renderEntry(entry) {
    if (entry.kind === 'welcome') return byId('tpl-welcome').content.cloneNode(true);
    if (entry.kind === 'contact') return byId('tpl-contact').content.cloneNode(true);
    if (entry.kind === 'cowsay') {
      return el('div', { class: 'shell-cow' }, el('q', {}, entry.text),
        el('pre', { 'aria-hidden': 'true' }, String.raw`  \   ^__^
   \  (oo)\_______
      (__)\       )\/\
          ||----w |
          ||     ||`));
    }
    if (entry.kind === 'cmd') {
      return el('div', { class: 'line', 'data-eid': entry.id }, promptNode(entry.at), ' ',
        el('span', { class: 'typed' }, entry.text));
    }
    if (entry.kind === 'help') {
      const list = el('div', { class: 'list' });
      for (const command of commands) {
        const label = el('span', { class: 'row-cmd' }, command);
        const description = el('span', { class: 'row-desc' }, commandHelp[command]);
        if (command === 'cd' || command === 'echo') {
          list.append(el('button', { type: 'button', class: 'row', onclick: () => {
            window.kiukFireworks.stop();
            if (passwordAttempts) leavePasswordPrompt();
            stopTyping();
            showCandidates([]);
            setCompletion(command + ' ');
            input.focus({ preventScroll: true });
          } }, label, description));
        } else list.append(runButton('row', command, label, description));
      }
      return list;
    }
    if (entry.kind === 'ls') {
      const list = el('div', { class: 'list' });
      if (!entry.only && !files[entry.path].kids.length) list.append(el('p', { class: 'hint' }, '빈 폴더입니다.'));
      let namesToList = entry.only ? [entry.only] : files[entry.path].kids;
      if (entry.pages > 1) {
        const offset = (entry.number - 1) * postsPerPage;
        namesToList = namesToList.slice(offset, offset + postsPerPage);
      }
      for (const name of namesToList) {
        const path = entry.path + '/' + name;
        const node = files[path];
        const command = commandFor(node.dir ? 'ls' : 'open', path);
        const desc = el('span', { class: 'row-desc' });
        if (node.date) desc.append(el('span', { class: 'dim' }, node.date));
        if (node.dir) desc.append(el('span', {}, '항목 ' + node.kids.length + '개'));
        else if (node.note && (!node.date || entry.path === '~/contests' || entry.path === '~/ongoing')) {
          desc.append(el('span', {}, node.note));
        }
        list.append(runButton(node.dir ? 'row' : 'row file-row', command,
          el('span', { class: node.dir ? 'row-name is-dir' : 'row-name' },
            icons[node.dir ? 'dir' : 'file'].cloneNode(true), el('span', {}, node.dir ? names.get(path) + '/' : node.title)),
          desc, el('span', { class: 'row-hint' }, '$ ' + command)));
      }
      if (entry.pages > 1) {
        const hint = entry.number < entry.pages ? '다음 페이지는 page를 입력하세요.' : '마지막 페이지입니다.';
        list.append(el('p', { class: 'hint' }, entry.number + ' / ' + entry.pages + ' 페이지. ' + hint));
      }
      return list;
    }
    const message = el('div', { class: 'msg' }, el('span', { class: entry.kind }, entry.text));
    if (entry.fixVerb) message.append(actionChip(entry.fixLabel, commandFor(entry.fixVerb, entry.fixPath)));
    return message;
  }

  let renderedCount = 0;
  let renderedCwd = '';
  function renderLog() {
    // 이전 목록의 버튼은 현재 위치에서 실행할 경로가 바뀔 때만 다시 그립니다.
    if (state.cwd !== renderedCwd || renderedCount > state.log.length) {
      out.replaceChildren();
      renderedCount = 0;
      renderedCwd = state.cwd;
    }
    const added = document.createDocumentFragment();
    for (; renderedCount < state.log.length; renderedCount++) added.append(renderEntry(state.log[renderedCount]));
    out.append(added);
  }

  function listPath(doc) {
    return doc ? doc.parent || parentPath(state.view) : posts;
  }

  function renderChips() {
    const doc = files[state.view];
    const items = [];
    if (doc?.next) items.push([commandFor('open', doc.next), '다음 글 읽기']);
    items.push([commandFor('ls', listPath(doc)), '글 목록 보기']);
    if (!doc) items.push([commandFor('open', about), '소개 읽기']);
    items.push(['help', '명령어 보기']);
    if (!doc) items.push(['clear', '화면 지우기']);
    chips.replaceChildren(el('span', { class: 'strip-label' }, '눌러서 실행'),
      ...items.map(([command, label]) => runButton('chip', command, el('span', { class: 'chip-cmd' }, command),
        el('span', { class: 'chip-sub' }, label))));
  }

  function setCompletion(value, directory = false) {
    input.value = value;
    const end = value.length - (directory && /["']$/.test(value) ? 1 : 0);
    input.setSelectionRange(end, end);
  }

  function showCandidates(items) {
    cands.hidden = !items.length;
    cands.replaceChildren();
    if (!items.length) return;
    cands.append(el('span', { class: 'strip-label' }, 'Tab 후보'));
    for (const item of items) cands.append(el('button', { type: 'button', class: 'chip', onclick: () => {
      setCompletion(item.fill, item.dir);
      showCandidates([]);
      input.focus({ preventScroll: true });
    } }, item.label));
  }

  function complete() {
    const text = input.value.trimStart();
    const space = text.search(/\s/);
    let prefix = text.toLowerCase();
    let choices = commands.map(name => ({ name, tail: inputCommands.includes(name) ? ' ' : '' }));
    let fill = (name, tail) => name + tail;
    showCandidates([]);
    if (space >= 0) {
      const verb = text.slice(0, space);
      if (!pathCommands.includes(verb.toLowerCase())) return;
      const raw = text.slice(space).trimStart();
      const path = readPath(raw).value;
      const { prefix: parent, folder, name } = splitPath(state.cwd, path);
      prefix = name;
      const quote = /^["']/.test(raw) ? raw.charAt(0) : '';
      choices = files[folder].kids.map(key => {
        const child = folder + '/' + key;
        return { name: names.get(child), tail: files[child].dir ? '/' : '' };
      });
      fill = (name, tail) => verb + ' ' + quotePath(parent + name + tail, quote);
    }
    const hits = choices.filter(choice => choice.name.startsWith(prefix));
    if (!hits.length) return;
    if (hits.length === 1) {
      setCompletion(fill(hits[0].name, hits[0].tail), hits[0].tail === '/');
      return;
    }
    let common = hits[0].name;
    for (const hit of hits) while (!hit.name.startsWith(common)) common = common.slice(0, -1);
    setCompletion(fill(common, ''), true);
    showCandidates(hits.map(({ name, tail }) => ({
      label: name + (tail === '/' ? '/' : ''), fill: fill(name, tail), dir: tail === '/'
    })));
  }

  const historyKey = 'terminal-blog.history';
  const historyLimit = 100;
  let history = [];
  let at = 0;
  let draft = '';
  let storageAvailable = true;
  let storedHistory;

  function normalizeHistoricalCommand(line, cwd) {
    const match = /^(\S+)(\s+)([\s\S]+)$/.exec(line);
    if (!match || !pathCommands.includes(match[1].toLowerCase())) return line;
    const raw = match[3];
    const { value, unfinished } = readPath(raw);
    if (!value || value === home || unfinished) return line;

    const absolute = value.startsWith('~/') || value.startsWith('/');
    const base = absolute ? home : cwd;
    // 이전 기록에는 작업 폴더가 없어 가능한 폴더에서 같은 표기가 나올 때만 바꿉니다.
    let found;
    for (const directory of base ? [base] : children.keys()) {
      const { prefix, folder, name } = splitPath(directory, value);
      let shown = prefix + name;
      if (name && name !== '.' && name !== '..' && !children.get(folder).has(name)) {
        const path = childPath(folder, name);
        if (!files[path]) continue;
        shown = prefix + displayPath(path).slice(displayPath(folder).length + 1);
      }
      if (!absolute && (shown.startsWith('/') || shown.startsWith('~/'))) shown = './' + shown;
      if (found !== undefined && found !== shown) return line;
      found = shown;
    }
    if (found === undefined || found === value) return line;
    return match[1] + match[2] + quotePath(found, /^["']/.test(raw) ? raw[0] : '');
  }

  function saveHistory() {
    if (!storageAvailable) return;
    try {
      storedHistory = JSON.stringify(history);
      localStorage.setItem(historyKey, storedHistory);
    }
    catch { storageAvailable = false; }
  }

  function readHistory() {
    if (!storageAvailable) return;
    try {
      const serialized = localStorage.getItem(historyKey);
      if (serialized === storedHistory) return;
      const saved = JSON.parse(serialized || '[]');
      storedHistory = serialized;
      const lines = Array.isArray(saved) ? saved.filter(item => typeof item === 'string') : [];
      const titles = lines.map(line => normalizeHistoricalCommand(line));
      history = titles.filter((line, i) => i === 0 || line !== titles[i - 1]).slice(-historyLimit);
      if (history.length !== lines.length || history.some((line, i) => line !== lines[i])) saveHistory();
    } catch (error) {
      if (!(error instanceof SyntaxError)) storageAvailable = false;
    }
  }
  readHistory();
  at = history.length;

  function remember(line) {
    readHistory();
    if (history[history.length - 1] !== line) history.push(line);
    history = history.slice(-historyLimit);
    at = history.length;
    draft = '';
    saveHistory();
  }

  function recall(step) {
    if (!history.length) return;
    if (at === history.length) draft = input.value;
    const next = Math.max(0, Math.min(history.length, at + step));
    if (next === at) return;
    at = next;
    setCompletion(at === history.length ? draft : history[at]);
    showCandidates([]);
  }

  function urlFor(value, base = location.href) {
    if (!value) return null;
    try { return new URL(value, base); }
    catch { return null; }
  }

  function localURL(value) {
    const url = urlFor(value);
    return url && url.origin === location.origin && /^https?:$/.test(url.protocol) ? url : null;
  }

  function recordNavigation(url, replace = false) {
    window.kiukFireworks.stop();
    const browserHistory = window.history;
    const current = { ...browserHistory.state, kiukShell: { cwd: state.cwd, view: state.view, browser: state.browser } };
    const sameAddress = url.href === location.href;
    if (!sameAddress || !state.browser) delete current.kiukClassicList;
    try {
      const sameMode = Boolean(browserHistory.state?.kiukShell?.browser) === Boolean(state.browser);
      if (replace || (sameAddress && sameMode)) browserHistory.replaceState(current, '', url.href);
      else browserHistory.pushState(current, '', url.href);
    } catch {
      if (!sameAddress) location.assign(url.href);
    }
  }

  function fragmentId(hash) {
    const id = hash.slice(1);
    try { return decodeURIComponent(id); }
    catch { return id; }
  }

  function scrollOutputTo(element) {
    out.scrollTop += element.getBoundingClientRect().top - out.getBoundingClientRect().top - 12;
  }

  function jumpTo(hash) {
    if (!hash || !article.isConnected) return false;
    const id = fragmentId(hash);
    if (!id) return false;
    const target = body.querySelector('#' + CSS.escape(id)) ||
      (['introduction', 'introduction-title', 'article-body', 'page-content'].includes(id) ? title : null);
    if (!target) return false;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    scrollOutputTo(target);
    target.focus({ preventScroll: true });
    return true;
  }

  function articleFragment(text, doc, source) {
    // 이미지 주소를 원래 글 기준으로 맞춘 뒤에만 브라우저가 이미지를 불러오게 합니다.
    const parsed = new DOMParser().parseFromString('<template>' + text + '</template>', 'text/html');
    const content = parsed.querySelector('template').content;
    const base = urlFor(doc.baseURL || doc.url) || source;
    const permalink = localURL(doc.url) || base;
    for (const node of content.querySelectorAll('script, base')) node.remove();
    for (const node of content.querySelectorAll('[href], [src], [poster], [srcset]')) {
      for (const attr of ['href', 'src', 'poster']) {
        const value = node.getAttribute(attr);
        if (!value) continue;
        const localAnchor = attr === 'href' && node.matches('a') && value.startsWith('#');
        if (attr === 'href' && value.startsWith('#') && !localAnchor) continue;
        const url = urlFor(value, localAnchor ? permalink : base);
        if (!url) continue;
        if (localAnchor) node.dataset.shellAnchor = value;
        node.setAttribute(attr, url.href);
      }
      if (node.hasAttribute('srcset')) {
        // URL 내부의 쉼표와 각 이미지의 너비, 배율 지정자를 유지합니다.
        const srcset = node.getAttribute('srcset').replace(/(^\s*|,\s*)(\S+?)(?=,\s|\s|$)/g,
          (match, lead, value) => lead + (urlFor(value, base)?.href || value));
        node.setAttribute('srcset', srcset);
      }
    }
    return document.importNode(content, true);
  }

  let shownPath = '';
  let loading = null;
  let pendingHash = '';
  async function loadBody(path) {
    loading?.abort();
    const controller = new AbortController();
    loading = controller;
    const doc = files[path];
    body.setAttribute('aria-busy', 'true');
    body.replaceChildren(el('p', { class: 'note', role: 'status' }, '글을 불러오는 중입니다.'));
    try {
      const source = localURL(doc.contentURL);
      if (!source) throw new Error();
      const response = await fetch(source.href, { mode: 'same-origin', signal: controller.signal });
      if (!response.ok) throw new Error();
      const content = await response.text();
      if (controller !== loading || path !== state.view) return;
      body.replaceChildren(articleFragment(content, doc, source));
      if (!jumpTo(pendingHash)) scrollOutputTo(title);
      pendingHash = '';
    } catch {
      if (controller !== loading || path !== state.view) return;
      body.replaceChildren(el('p', { class: 'err', role: 'alert' }, '글을 불러오지 못했습니다.'),
        el('button', { type: 'button', class: 'chip', onclick: () => {
          title.focus({ preventScroll: true });
          loadBody(path);
        } }, '다시 불러오기'));
    } finally {
      if (controller === loading) {
        loading = null;
        body.removeAttribute('aria-busy');
      }
    }
  }

  function renderBrowser() {
    win.hidden = !state.browser;
    if (state.browser) window.kiukBrowser.show(state.browser);
    else window.kiukBrowser.hide();
  }

  function renderArticle() {
    const doc = files[state.view];
    if (!doc) {
      if (!shownPath) return;
      loading?.abort();
      loading = null;
      shownPath = '';
      pendingHash = '';
      body.removeAttribute('aria-busy');
      body.replaceChildren();
      article.remove();
      return;
    }
    if (out.lastElementChild !== article) out.append(article);
    title.textContent = doc.heading || doc.title;
    article.querySelector('[data-article-meta]').textContent = doc.date || doc.note || '';
    const actions = [actionChip('글 목록으로', commandFor('ls', listPath(doc)))];
    if (doc.next) actions.push(actionChip('다음 글', commandFor('open', doc.next)));
    article.querySelector('[data-article-actions]').replaceChildren(...actions);
    if (shownPath !== state.view) {
      shownPath = state.view;
      loadBody(state.view);
    }
  }

  function render() {
    byId('title').textContent = 'guest@' + host + ': ' + displayPath(state.cwd);
    byId('ps1').replaceChildren(passwordAttempts ? '[sudo] guest 비밀번호:' : promptNode(state.cwd));
    renderLog();
    renderArticle();
    renderBrowser();
    renderChips();
    showCandidates([]);
  }

  function setPasswordPrompt(active) {
    passwordCheck++;
    passwordAttempts = active ? 1 : 0;
    input.value = '';
    input.readOnly = false;
    input.type = active ? 'password' : 'text';
    input.placeholder = active ? '비밀번호 입력' : commandPlaceholder;
    input.setAttribute('aria-label', active ? 'sudo 비밀번호' : commandLabel);
    byId('cancel-password').hidden = !active;
    byId('run').textContent = active ? '확인' : '실행';
  }

  function leavePasswordPrompt() {
    setPasswordPrompt(false);
    render();
    input.focus({ preventScroll: true });
  }

  async function submitInput(fromPrompt = false) {
    if (!passwordAttempts) {
      const command = pendingCommand || input.value;
      stopTyping();
      execute(command, fromPrompt);
      return;
    }
    if (input.readOnly) return;
    const check = passwordCheck;
    const value = new TextEncoder().encode(input.value);
    input.value = '';
    input.readOnly = true;
    let matched;
    try {
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', value));
      matched = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('') ===
        '725d3d30712c43950d3775f2c4c20e6548ea35093fa9937de39afb669cd776dc';
    } catch {
      if (check === passwordCheck) {
        say('err', '입력을 확인할 수 없습니다.');
        leavePasswordPrompt();
      }
      return;
    }
    if (check !== passwordCheck) return;
    input.readOnly = false;
    if (matched) {
      window.kiukFireworks.start();
    } else if (passwordAttempts < 3) {
      passwordAttempts++;
      say('err', '비밀번호가 틀렸습니다. 다시 입력해 주세요.');
      renderLog();
      out.scrollTop = out.scrollHeight;
      input.focus({ preventScroll: true });
      return;
    } else say('err', '비밀번호가 세 번 틀렸습니다.');
    leavePasswordPrompt();
    out.scrollTop = out.scrollHeight;
  }

  function execute(raw, fromPrompt = false) {
    if (state.browser) return;
    const line = normalizeHistoricalCommand(raw.trim(), state.cwd);
    if (!line) return;
    window.kiukFireworks.stop();
    input.value = '';
    remember(line);
    const previousView = state.view;
    const previousFolder = state.cwd;
    const wasOpen = Boolean(previousView);
    state.view = '';
    pendingHash = '';
    const entry = { kind: 'cmd', text: line, at: state.cwd };
    add(entry);
    const parts = /^(\S+)\s*([\s\S]*)$/.exec(line);
    const verb = parts[1].toLowerCase();
    const arg = readPath(parts[2]);
    const path = resolve(state.cwd, arg.value);
    const node = files[path];
    if (pathCommands.includes(verb) && arg.unfinished) {
      say('err', '경로의 따옴표나 역슬래시 뒤에 올 문자를 확인해 주세요.', 'ls', null, '지금 위치 보기');
    } else if (verb === 'clear') {
      state.log = [];
      lastListing = null;
    } else if (verb === 'help' || verb === 'contact') {
      add({ kind: verb });
    } else if (verb === 'whoami') {
      say('note', 'guest');
    } else if (verb === 'pwd') {
      say('note', absoluteHome + displayPath(state.cwd).slice(1));
    } else if (verb === 'date') {
      say('note', new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full', timeStyle: 'medium' }).format(new Date()));
    } else if (verb === 'echo') {
      say('note', arg.value);
    } else if (verb === 'cowsay') {
      add({ kind: verb, text: arg.value || '음메!' });
    } else if (verb === 'sudo' && !parts[2]) {
      setPasswordPrompt(true);
    } else if (verb === 'sudo') {
      say('err', '사용법: sudo');
    } else if (verb === 'ls') {
      if (!node) say('err', 'ls: ' + arg.value + ': 그런 파일이나 폴더가 없습니다.', 'ls', null, '지금 위치 보기');
      else if (node.dir) listDirectory(path);
      else {
        lastListing = null;
        add({ kind: 'ls', path: parentPath(path), only: path.slice(path.lastIndexOf('/') + 1) });
      }
    } else if (verb === 'page') {
      if (parts[2]) say('err', '사용법: page');
      else if (!lastListing) say('note', '먼저 글 목록을 열어 주세요.', 'ls',
        files[state.cwd].postList ? state.cwd : posts, '글 목록 보기');
      else if (lastListing.number >= lastListing.pages) say('note', '마지막 페이지입니다.');
      else listDirectory(lastListing.path, lastListing.number + 1);
    } else if (verb === 'cd') {
      const to = arg.value ? path : home;
      if (!files[to]) say('err', 'cd: ' + arg.value + ': 그런 폴더가 없습니다.', 'ls', null, '지금 위치 보기');
      else if (!files[to].dir) say('err', 'cd: ' + arg.value + ': 폴더가 아니라 파일입니다.', 'open', to, '이 글 열기');
      else {
        lastListing = null;
        state.cwd = to;
        if (to === home) add({ kind: 'welcome' });
        say('note', displayPath(to) + ' 로 이동했습니다.', 'ls', null, '여기 목록 보기');
      }
    } else if (verb === 'open' || verb === 'cat') {
      if (verb === 'open' && !parts[2]) {
        state.browser = localURL(files[home].url).href;
        rememberClassicFolder(state.cwd);
      }
      else if (!arg.value) say('err', verb + ': 열고 싶은 글의 제목을 뒤에 적어 주세요.', 'ls', null, '목록 보기');
      else if (!node) say('err', verb + ': ' + arg.value + ': 그런 파일이 없습니다.', 'ls', null, '목록 보기');
      else if (node.dir) say('err', verb + ': ' + arg.value + ': 폴더입니다. ls 로 안을 봅니다.', 'ls', path, '폴더 안 보기');
      else state.view = path;
    } else {
      say('err', parts[1] + ': 명령어를 찾을 수 없습니다.', 'help', null, '명령어 보기');
    }
    if (previousView !== state.view || previousFolder !== state.cwd || state.browser) {
      const address = localURL(state.browser || files[state.view]?.url || files[state.cwd].url);
      if (address) recordNavigation(address);
    }
    render();
    const last = state.log.length && out.querySelector('[data-eid="' + entry.id + '"]');
    out.scrollTop = last ? Math.max(0, last.offsetTop - 12) : 0;
    if (state.browser) {
      window.kiukBrowser.focus();
    } else if (state.view) {
      if (!fromPrompt) title.focus({ preventScroll: true });
    } else if (passwordAttempts || desktopPointer?.matches || wasOpen || document.activeElement === document.body || document.activeElement === byId('run')) {
      input.focus({ preventScroll: true });
    }
  }

  let typingFrame = 0;
  let pendingCommand = '';
  let composing = false;
  function stopTyping() {
    cancelAnimationFrame(typingFrame);
    typingFrame = 0;
    pendingCommand = '';
  }

  function typeAndRun(command) {
    if (state.browser) return;
    window.kiukFireworks.stop();
    if (passwordAttempts) leavePasswordPrompt();
    stopTyping();
    showCandidates([]);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { execute(command); return; }
    const letters = Array.from(command);
    const duration = Math.min(120, letters.length * 9);
    const start = performance.now();
    pendingCommand = command;
    function tick(now) {
      const fraction = Math.min(1, (now - start) / duration);
      input.value = letters.slice(0, Math.max(1, Math.ceil(letters.length * fraction))).join('');
      if (fraction < 1) typingFrame = requestAnimationFrame(tick);
      else { stopTyping(); execute(command); }
    }
    tick(start);
  }

  input.addEventListener('compositionstart', () => { composing = true; stopTyping(); });
  input.addEventListener('compositionend', () => { composing = false; });
  input.addEventListener('input', () => { window.kiukFireworks.stop(); stopTyping(); pendingHash = ''; showCandidates([]); });
  input.addEventListener('keydown', event => {
    if (!passwordAttempts) window.kiukFireworks.stop();
    const tab = event.key === 'Tab' && !event.shiftKey;
    if (tab) event.preventDefault();
    if (event.isComposing || composing || event.keyCode === 229) return;
    if (passwordAttempts) {
      if (event.key === 'Enter') { event.preventDefault(); submitInput(true); }
      else if (event.key === 'Escape' || (event.ctrlKey && event.key.toLowerCase() === 'c')) {
        event.preventDefault(); leavePasswordPrompt();
      }
      return;
    }
    if (tab) { stopTyping(); complete(); }
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault(); stopTyping(); recall(event.key === 'ArrowUp' ? -1 : 1);
    } else if (event.key === 'Enter') {
      event.preventDefault(); submitInput(true);
    } else if (event.key === 'Escape') {
      stopTyping(); showCandidates([]);
    }
  });
  byId('run').addEventListener('click', () => { if (!composing) submitInput(); });
  byId('cancel-password').addEventListener('click', leavePasswordPrompt);
  byId('help-btn').addEventListener('click', () => typeAndRun('help'));
  byId('win-close').addEventListener('click', () => {
    if (!state.browser) return;
    rememberClassicFolder(null);
    state.browser = '';
    recordNavigation(localURL(files[state.cwd].url));
    render();
    input.focus({ preventScroll: true });
  });
  document.addEventListener('kiuk:browser-navigate', event => {
    const address = localURL(event.detail?.url);
    if (!state.browser || !address) return;
    state.browser = address.href;
    recordNavigation(address, event.detail.replace === true);
    renderBrowser();
  });

  body.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const target = urlFor(link.href);
    const doc = files[state.view];
    if (!doc || !target?.hash) return;
    const permalink = localURL(doc.url || doc.baseURL);
    const samePage = permalink && permalink.origin === target.origin && permalink.pathname === target.pathname &&
      permalink.search === target.search;
    if ((link.dataset.shellAnchor || samePage) && jumpTo(target.hash)) {
      event.preventDefault();
      if (target.origin === location.origin && target.pathname === location.pathname &&
          target.search === location.search && target.hash !== location.hash) {
        recordNavigation(target);
      }
    }
  });


  function chromeAnchor() {
    const target = byId(fragmentId(location.hash));
    return term.contains(target) && !body.contains(target) ? target : null;
  }

  function routeFile(path) {
    if (!files[path].dir) return path;
    if (path !== home || !location.hash || !files[about]) return '';
    const id = fragmentId(location.hash);
    const intro = document.querySelector('.home-introduction');
    return id === 'introduction' || (id && intro?.querySelector('#' + CSS.escape(id))) ? about : '';
  }
  function followClassicLocation(folder) {
    stopTyping();
    if (passwordAttempts) setPasswordPrompt(false);
    state.cwd = files[folder]?.dir ? folder : home;
    state.view = '';
    state.browser = location.href;
    pendingHash = '';
    rememberClassicFolder(state.cwd);
    recordNavigation(new URL(location.href), true);
    render();
    window.kiukBrowser.focus();
  }
  window.addEventListener('pageshow', event => {
    if (event.persisted && classicFolder()) followClassicLocation(classicFolder());
  });
  window.addEventListener('popstate', event => {
    window.kiukFireworks.stop();
    const saved = event.state?.kiukShell;
    const folder = classicFolder();
    if (state.browser || folder || saved?.browser === location.href) {
      followClassicLocation(folder || (state.browser ? state.cwd : saved.cwd));
      return;
    }
    if (!saved || !files[saved.cwd]?.dir || (saved.view && !files[saved.view])) return;
    stopTyping();
    if (passwordAttempts) setPasswordPrompt(false);
    const changed = state.view !== saved.view;
    state.cwd = saved.cwd;
    state.view = saved.view;
    pendingHash = location.hash;
    render();
    if (state.view) {
      if (!changed && !loading) {
        if (!jumpTo(pendingHash)) scrollOutputTo(title);
        pendingHash = '';
      }
      if (!location.hash) title.focus({ preventScroll: true });
    } else input.focus({ preventScroll: true });
  });
  window.addEventListener('hashchange', () => {
    window.kiukFireworks.stop();
    if (window.history.state?.kiukShell) return;
    if (state.browser) {
      state.browser = location.href;
      recordNavigation(new URL(location.href), true);
      renderBrowser();
      return;
    }
    if (chromeAnchor()) { pendingHash = ''; return; }
    const atHome = location.pathname === localURL(files[home].url)?.pathname;
    const path = routeFile(atHome ? home : state.view || state.cwd);
    if (!path) return;
    pendingHash = location.hash;
    if (state.view !== path) {
      state.cwd = parentPath(path);
      state.view = path;
      render();
    } else if (!loading) {
      if (!jumpTo(pendingHash)) scrollOutputTo(title);
      pendingHash = '';
    }
  });

  const initial = routeFile(startPath);
  if (resumeBrowser) {
    const folder = resumeFolder || savedNavigation?.cwd;
    state.cwd = files[folder]?.dir ? folder : home;
    state.browser = location.href;
    rememberClassicFolder(state.cwd);
    add({ kind: 'cmd', text: 'open', at: state.cwd });
  } else if (initial) {
    state.cwd = parentPath(initial);
    state.view = initial;
    pendingHash = location.hash;
    add({ kind: 'cmd', text: commandFor('open', initial), at: state.cwd });
  } else if (startPath !== home) {
    state.cwd = startPath;
    add({ kind: 'cmd', text: 'ls', at: state.cwd });
    listDirectory(state.cwd);
  } else {
    add({ kind: 'welcome' });
    add({ kind: 'cmd', text: 'help', at: home });
    add({ kind: 'help' });
  }
  recordNavigation(new URL(location.href), true);
  render();
  document.documentElement.lang = 'ko';
  document.documentElement.classList.add('shell-ready');
  const anchor = chromeAnchor();
  if (state.browser) window.kiukBrowser.focus();
  else if (anchor) {
    pendingHash = '';
    anchor.focus({ preventScroll: true });
  } else if (state.view) title.focus({ preventScroll: true });
  else if (!location.hash && desktopPointer?.matches && document.activeElement === document.body) {
    input.focus({ preventScroll: true });
  }
})();
