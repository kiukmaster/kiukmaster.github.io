import config from '../../site.config.js';
export { config };
export const ROOT = new URL('../../', import.meta.url);
export const rootURL = (path = '') => new URL(path, ROOT).href;
const key = name => `blog:${ROOT.pathname}:${name}`;
export const storage = {
  get(name, fallback = null) { try { return localStorage.getItem(key(name)) ?? fallback; } catch { return fallback; } },
  set(name, value) { try { localStorage.setItem(key(name), value); return true; } catch { return false; } }
};
export const lang = ['ko', 'en'].includes(storage.get('lang')) ? storage.get('lang') : 'ko';
export const localize = value => typeof value === 'string' ? value : (value?.[lang] || value?.ko || value?.en || '');
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const strings = {
  home:['홈','Home'], about:['소개','About'],
  light:['라이트','Light'], gray:['그레이','Gray'], dark:['다크','Dark'], menu:['메뉴','Menu'], close:['닫기','Close'],
  all:['전체 글','All posts'], categories:['카테고리','Categories'], tags:['태그','Tags'], post:['글','Post'],
  author:['작성자','Author'], profileEmpty:['프로필을 준비하고 있습니다.','The profile is being prepared.'],
  search:['제목, 요약, 태그 검색…','Search titles, summaries, tags…'], searchLabel:['글 검색','Search entries'],
  newest:['최신순','Newest first'], oldest:['오래된순','Oldest first'], titleSort:['제목순','Title'],
  grid:['카드 보기','Grid view'], list:['목록 보기','List view'], sort:['정렬','Sort'],
  noPosts:['아직 발행된 글이 없습니다.','No entries published yet.'], noPostsDesc:['첫 번째 기록을 준비하고 있습니다.','The first entry is on its way.'],
  noResults:['검색 결과가 없습니다.','No matching entries.'], noResultsDesc:['검색어나 분류 조건을 바꿔보세요.','Try another search or filter.'],
  reset:['필터 초기화','Reset filters'], entries:['개의 글','posts'], featured:['추천 글','Featured'], read:['읽기','Read'],
  more:['더 보기','Load more'],
  homeTitle:['생각과 배움의 기록','Thoughts & notes'], homeSubtitle:['생각하고, 배우고, 기록합니다.','Thoughts, notes, and things learned.'],
  aboutTitle:['소개','About'], aboutEmpty:['아직 소개가 작성되지 않았습니다.','No introduction has been added yet.'],
  contact:['연락처','Contact'], error:['데이터를 불러오지 못했습니다.','Could not load the data.'], retry:['다시 시도','Try again'],
  fileHint:['파일을 더블클릭하지 말고 로컬 서버 또는 GitHub Pages에서 열어주세요. README.md에 실행 방법이 있습니다.','Use a local web server or GitHub Pages instead of opening the file directly. See README.md.'],
  toc:['목차','On this page'], copy:['복사','Copy'], copied:['복사됨','Copied'], copyFail:['복사하지 못했습니다. 직접 선택해 복사해주세요.','Copy failed. Select and copy manually.'],
  share:['링크 복사','Copy link'], previous:['이전 글','Previous'], next:['다음 글','Next'], back:['목록으로','Back to entries'],
  updated:['수정','Updated'], minutes:['분 읽기','min read'], top:['맨 위로','Back to top'],
  uiLanguage:['언어 전환은 화면 메뉴에만 적용됩니다. 글은 자동 번역되지 않습니다.','Language changes apply to the interface. Entries are not auto-translated.'],
  notFound:['페이지를 찾을 수 없습니다.','Page not found.'], notFoundDesc:['주소가 바뀌었거나 존재하지 않는 페이지입니다.','The address may have changed or the page does not exist.'],
  loading:['불러오는 중…','Loading…'], skip:['본문으로 건너뛰기','Skip to content'],
  emptyCategory:['분류 없음','Uncategorized'], rss:['RSS 구독','Subscribe to feed']
};
export const t = name => strings[name]?.[lang === 'en' ? 1 : 0] || name;
const paths = {
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon:'<path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5 8.7 8.7 0 1 0 20.5 14.2Z"/>',
  contrast:'<circle cx="12" cy="12" r="8.5"/><path fill="currentColor" stroke="none" d="M12 3.5a8.5 8.5 0 0 1 0 17Z"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list:'<rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>', external:'<path d="M7 17 17 7M7 7h10v10"/>',
  file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8m-8 4h5"/>',
  book:'<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  github:'<path d="M9 20c-4 1-4-2-6-2m12 4v-3.5a3 3 0 0 0-.8-2.3c3-.4 6-1.5 6-6.2a5 5 0 0 0-1.5-3.5 5 5 0 0 0-.2-3.5s-1.2-.4-3.8 1.4a13 13 0 0 0-6.8 0C5.3 2.6 4.1 3 4.1 3a5 5 0 0 0-.2 3.5A5 5 0 0 0 2.4 10c0 4.7 3 5.8 6 6.2a3 3 0 0 0-.8 2.3V22"/>',
  link:'<path d="m10 13 4-4M8 15l-2 2a3 3 0 0 0 4 4l4-4a3 3 0 0 0 0-4M16 9l2-2a3 3 0 0 0-4-4l-4 4a3 3 0 0 0 0 4"/>',
  rss:'<circle cx="5" cy="19" r="1"/><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/>',
  up:'<path d="m6 14 6-6 6 6"/>', chevron:'<path d="m9 5 7 7-7 7"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
};
export const icon = (name, cls = '') => `<svg class="icon ${esc(cls)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
export function safeURL(value, base = ROOT, allowMail = true) {
  const raw = String(value || '').trim();
  if (!raw || /[\u0000-\u001f\u007f\\]/.test(raw)) return '';
  try {
    const url = new URL(raw, base);
    return ['http:', 'https:', ...(allowMail ? ['mailto:'] : [])].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
export const validSlug = slug => typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 96;
export function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(+parsed) && parsed.toISOString().slice(0, 10) === date;
}
export function validateIndex(data) {
  if (data?.version !== 1 || !Array.isArray(data.posts)) throw new Error('data/posts.json은 {"version": 1, "posts": [...]} 형식이어야 합니다.');
  const seen = new Set();
  data.posts.forEach((p, index) => {
    const fail = message => { throw new Error(`data/posts.json의 ${index+1}번째 글: ${message}`); };
    if (!p || typeof p !== 'object' || Array.isArray(p)) fail('글 정보를 객체로 입력하세요.');
    if (!validSlug(p.slug)) fail('slug는 영문 소문자·숫자·단일 하이픈으로 96자 이내여야 합니다.');
    if (seen.has(p.slug)) fail(`slug가 중복되었습니다: ${p.slug}`);
    if (typeof p.title !== 'string' || !p.title.trim()) fail('title에 제목을 입력하세요.');
    if (!validDate(p.date)) fail('date를 실제 날짜 YYYY-MM-DD로 입력하세요.');
    if (typeof p.category !== 'string') fail('category는 문자열이어야 합니다.');
    if (!Array.isArray(p.tags) || p.tags.some(tag=>typeof tag !== 'string')) fail('tags는 문자열 배열이어야 합니다. 예: ["Python", "보안"]');
    for (const field of ['excerpt','searchText','cover','updated','language']) {
      if (p[field] !== undefined && typeof p[field] !== 'string') fail(`${field}는 문자열이어야 합니다.`);
    }
    if (p.updated && (!validDate(p.updated) || p.updated < p.date)) fail('updated는 작성일 이후 또는 같은 날짜여야 합니다.');
    if (p.featured !== undefined && typeof p.featured !== 'boolean') fail('featured는 true 또는 false여야 합니다.');
    if (p.readingMinutes !== undefined && (!Number.isInteger(p.readingMinutes) || p.readingMinutes < 1)) fail('readingMinutes는 1 이상의 정수여야 합니다.');
    seen.add(p.slug);
  });
  return data.posts;
}
export async function loadPosts() {
  if (location.protocol === 'file:') throw new Error(t('fileHint'));
  const response = await fetch(rootURL('data/posts.json'), { cache:'no-store' });
  if (!response.ok) throw new Error(`data/posts.json · HTTP ${response.status}`);
  return validateIndex(await response.json());
}
export const postURL = p => rootURL(`posts/${p.slug}/`);
export const coverURL = p => p.cover ? safeURL(p.cover, new URL(`posts/${p.slug}/`, ROOT), false) : '';
export const dateLabel = date => validDate(date) ? new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', {year:'numeric',month:'short',day:'numeric'}).format(new Date(`${date}T12:00:00`)) : '';
export const readingTime = text => Math.max(1, Math.ceil(String(text).replace(/\s/g,'').length / 850));
export function notify(message) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role','status'); document.body.append(el); }
  el.textContent = message; el.classList.add('visible');
  clearTimeout(notify.timer); notify.timer = setTimeout(() => el.classList.remove('visible'), 3600);
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const field = document.createElement('textarea'); field.value = text;
    field.style.cssText = 'position:fixed;left:-10000px;top:0'; document.body.append(field); field.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* 복사 기능 미지원 */ } field.remove(); return ok;
  }
}
export function setTitle(title) {
  document.title = title ? `${title} — ${localize(config.title)}` : localize(config.title);
  document.documentElement.lang = lang;
  document.querySelector('meta[name="description"]')?.setAttribute('content', localize(config.description));
}
export function errorState(error, target = document.getElementById('page-content')) {
  target.innerHTML = `<section class="empty-state error-state" role="alert">${icon('file')}<h1>${t('error')}</h1><p>${esc(error.message)}</p><button class="button" id="retry">${t('retry')}</button></section>`;
  target.querySelector('#retry')?.addEventListener('click',()=>location.reload());
}
export function socialLinks() {
  const links = config.author?.links || {};
  return Object.entries(links).map(([name, value]) => {
    const url = safeURL(name === 'email' && value && !value.startsWith('mailto:') ? `mailto:${value}` : value);
    if (!url) return '';
    return `<a class="icon-button" href="${esc(url)}" aria-label="${esc(name)}" title="${esc(name)}" ${url.startsWith('mailto:') ? '' : 'target="_blank" rel="noopener noreferrer"'}>${icon(name==='email'?'mail':name==='github'?'github':'link')}</a>`;
  }).join('');
}
export function renderShell(page, posts = []) {
  const themes = ['light','gray','dark'];
  const theme = storage.get('theme', config.defaultTheme || 'dark');
  document.documentElement.dataset.theme = themes.includes(theme) ? theme : 'dark';
  document.documentElement.lang = lang;
  const nav = ['home','about'].map(name=>`<a href="${rootURL(name==='home'?'index.html':name+'.html')}" ${page===name?'aria-current="page"':''}>${t(name)}</a>`).join('');
  const header = document.getElementById('site-header');
  if (header) header.innerHTML = `<div class="header-inner"><a class="brand" href="${rootURL('index.html')}">${esc(localize(config.title))}</a><nav class="main-nav" aria-label="${t('menu')}">${nav}</nav><div class="header-controls"><div class="segmented theme-switch" role="group" aria-label="Theme">${themes.map((mode,i)=>`<button type="button" data-theme-choice="${mode}" aria-label="${t(mode)}" title="${t(mode)}" aria-pressed="${theme===mode}">${icon(['sun','contrast','moon'][i])}<span>${t(mode)}</span></button>`).join('')}</div><div class="segmented language-switch" role="group" aria-label="Language"><button type="button" data-lang="ko" aria-pressed="${lang==='ko'}" title="${t('uiLanguage')}">KOR</button><button type="button" data-lang="en" aria-pressed="${lang==='en'}" title="${t('uiLanguage')}">ENG</button></div><button class="icon-button menu-button" id="menu-toggle" aria-label="${t('menu')}" aria-expanded="false" aria-controls="mobile-menu">${icon('menu')}</button></div></div><nav id="mobile-menu" class="mobile-nav" aria-label="${t('menu')}" hidden>${nav}</nav>`;
  document.querySelectorAll('[data-theme-choice]').forEach(btn=>btn.addEventListener('click',()=> {
    document.documentElement.dataset.theme=btn.dataset.themeChoice;
    storage.set('theme',btn.dataset.themeChoice);
    document.querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',b===btn));
  }));
  document.querySelectorAll('[data-lang]').forEach(btn=>btn.addEventListener('click',()=> {
    if (btn.dataset.lang===lang) return;
    storage.set('lang',btn.dataset.lang); location.reload();
  }));
  const toggle = document.getElementById('menu-toggle');
  const mobile = document.getElementById('mobile-menu');
  toggle?.addEventListener('click',()=>{mobile.hidden=!mobile.hidden;toggle.setAttribute('aria-expanded',!mobile.hidden);});
  document.addEventListener('keydown', e=>{if(e.key==='Escape'&&mobile&&!mobile.hidden){mobile.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}});
  const sidebar = document.getElementById('site-sidebar');
  if (sidebar) {
    const author = config.author || {};
    const name = (lang==='en' ? author.nameEn || author.name : author.name) || t('author');
    const avatar = safeURL(author.avatar, ROOT, false);
    const categories = [...new Set([...(config.categories || []),...posts.map(p=>p.category).filter(Boolean)])];
    const current = new URLSearchParams(location.search).get('category');
    sidebar.innerHTML = `<div class="sidebar-sticky"><section class="profile-card panel"><div class="profile-heading">${avatar?`<img class="avatar" src="${esc(avatar)}" alt="${esc(name)}" width="64" height="64">`:`<div class="avatar avatar-initial" aria-hidden="true">${esc((name==='작성자'||name==='Author')?'·':name[0])}</div>`}<div><p class="profile-name">${esc(name)}</p>${author.nameEn?`<span class="eyebrow">${esc(author.nameEn)}</span>`:`<span class="eyebrow">PERSONAL BLOG</span>`}</div></div>${localize(author.role)?`<p class="profile-role">${esc(localize(author.role))}</p>`:''}<p class="profile-bio">${esc(localize(author.bio)||t('profileEmpty'))}</p>${socialLinks()?`<div class="social-links">${socialLinks()}</div>`:''}</section><nav class="category-nav panel" aria-label="${t('categories')}"><a href="${rootURL('index.html')}" class="category-link ${!current&&page==='home'?'active':''}"><span>${t('all')}</span><span class="count">${posts.length}</span></a>${categories.map(category=>`<a class="category-link ${current===category?'active':''}" href="${rootURL('index.html')}?category=${encodeURIComponent(category)}"><span>${esc(category)}</span><span class="count">${posts.filter(p=>p.category===category).length}</span></a>`).join('')}</nav><div class="sidebar-note"><span class="tiny-line"></span><span>${posts.length} ${t('entries')}</span></div></div>`;
  }
  const footer = document.getElementById('site-footer');
  if (footer) footer.innerHTML = `<span>© ${new Date().getFullYear()} ${esc(config.author?.name||localize(config.title))}</span><div>${config.feedEnabled===true?`<a href="${rootURL('feed.xml')}" title="${t('rss')}">${icon('rss')}RSS</a>`:''}<a href="${rootURL('about.html')}">${t('about')}</a></div>`;
  // 구독 파일을 직접 관리하는 경우에만 피드를 독자에게 노출합니다.
  if (config.feedEnabled===true && !document.querySelector('link[rel="alternate"][type="application/atom+xml"]')) {
    const link=document.createElement('link');
    link.rel='alternate';link.type='application/atom+xml';link.href=rootURL('feed.xml');link.title=localize(config.title);
    document.head.append(link);
  }
  document.querySelector('.skip-link')?.replaceChildren(document.createTextNode(t('skip')));
}
export function emptyState(filtered = false) {
  return `<section class="empty-state">${icon(filtered?'search':'book')}<span class="eyebrow">${filtered?'SEARCH':'NOTES / 000'}</span><h2>${t(filtered?'noResults':'noPosts')}</h2><p>${t(filtered?'noResultsDesc':'noPostsDesc')}</p>${filtered?`<button class="button secondary" id="reset-empty">${t('reset')}</button>`:''}</section>`;
}
export function enhanceProse(container) {
  container.querySelectorAll('pre').forEach(pre=> {
    if (pre.querySelector('.copy-code')) return;
    const button=document.createElement('button');button.type='button';button.className='copy-code';button.textContent=t('copy');
    button.addEventListener('click',async()=> {const ok=await copyText(pre.querySelector('code')?.textContent||'');button.textContent=t(ok?'copied':'copy');if(!ok)notify(t('copyFail'));setTimeout(()=>button.textContent=t('copy'),1500);});
    pre.append(button);
  });
  container.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.classList.add('broken-image');img.title='이미지를 불러오지 못했습니다.';},{once:true}));
}
