import { config, t, esc, icon, rootURL, postURL, coverURL, dateLabel, postDateTime, sortPostsByPublished, storage, setTitle, renderShell, loadPosts, errorState, emptyState } from './core.js';
const page=document.body.dataset.page;
const initialParams=new URLSearchParams(location.search);
let posts=[], visible=config.pageSize||8, timer;
let state={q:initialParams.get('q')||'',category:initialParams.get('category')||'',tag:initialParams.get('tag')||'',sort:initialParams.get('sort')||'newest',view:storage.get('view','grid')};
if(!['newest','oldest','title'].includes(state.sort))state.sort='newest';
if(!['grid','list'].includes(state.view))state.view='grid';
function updateURL() {
  const params=new URLSearchParams();['q','category','tag'].forEach(k=>{if(state[k])params.set(k,state[k]);});
  if(state.sort!=='newest')params.set('sort',state.sort);
  history.replaceState(null,'',`${location.pathname}${params.size?'?'+params:''}`);
}
function reset(){state={...state,q:'',category:'',tag:'',sort:'newest'};visible=config.pageSize||8;buildUI();render();}
function filteredPosts() {
  // 모든 항목은 게시글입니다. 원본 목록을 바꾸지 않도록 복사합니다.
  let result=[...posts];
  if(state.category)result=result.filter(p=>p.category===state.category);
  if(state.tag)result=result.filter(p=>p.tags.includes(state.tag));
  const tokens=state.q.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if(tokens.length)result=result.filter(p=>{const hay=[p.title,p.excerpt,p.category,...p.tags,p.searchText||''].join(' ').normalize('NFKC').toLocaleLowerCase();return tokens.every(word=>hay.includes(word.normalize('NFKC')));});
  return state.sort==='title' ? result.sort((a,b)=>a.title.localeCompare(b.title,'ko')) : sortPostsByPublished(result,state.sort==='newest');
}
function card(p,featured=false) {
  const cover=coverURL(p),url=postURL(p);
  const tags=p.tags.slice(0,3).map(tag=>`<a class="tag" href="${rootURL('index.html')}?tag=${encodeURIComponent(tag)}">${esc(tag)}</a>`).join('');
  const body=`<div class="${featured?'featured-content':'card-body'}">${featured?`<div class="featured-label"><span class="badge">${t('featured')}</span><span>${esc(p.category||t('post'))}</span></div>`:`<div class="card-meta"><span class="category-label">${esc(p.category||t('post'))}</span><time datetime="${postDateTime(p)}">${dateLabel(p.date,p.time)}</time></div>`}<h2><a href="${url}">${esc(p.title)}</a></h2>${p.excerpt?`<p class="card-excerpt">${esc(p.excerpt)}</p>`:''}${featured?`<div class="card-bottom"><span class="fine-print">${dateLabel(p.date,p.time)} · ${p.readingMinutes||1}${t('minutes')}</span><a class="text-link" href="${url}" aria-label="${esc(p.title)} — ${t('read')}">${t('read')} ${icon('arrow')}</a></div>`:''}</div>`;
  return `<article class="post-card ${featured?'featured-card':''} ${!cover?'no-cover':''}">${cover?`<a class="card-cover" href="${url}" tabindex="-1" aria-hidden="true"><img src="${esc(cover)}" alt="" loading="${featured?'eager':'lazy'}" decoding="async"></a>`:''}${body}${!featured?`<div class="card-bottom"><div class="tag-list">${tags}</div><a class="card-arrow" href="${url}" aria-label="${esc(p.title)} — ${t('read')}">${icon('external')}</a></div>`:''}</article>`;
}
function buildUI() {
  // 분류 탐색은 사이드바와 글의 태그 링크를 사용합니다. 검색 아래 중복 선택창은 만들지 않습니다.
  document.getElementById('page-content').innerHTML=`<div class="page-heading"><div><span class="eyebrow">${{home:'NOTES',writing:'WRITING'}[page]}</span><h1>${t(page+'Title')}</h1><p>${t(page+'Subtitle')}</p></div><span class="section-index">${String(posts.length).padStart(3,'0')} / POSTS</span></div><form class="toolbar" role="search" id="search-form"><div class="search-field">${icon('search')}<label class="sr-only" for="search">${t('searchLabel')}</label><input type="search" id="search" placeholder="${t('search')}" value="${esc(state.q)}" autocomplete="off"></div><div class="toolbar-controls"><div class="segmented view-switch" role="group" aria-label="View"><button type="button" data-view="grid" aria-label="${t('grid')}" title="${t('grid')}" aria-pressed="${state.view==='grid'}">${icon('grid')}</button><button type="button" data-view="list" aria-label="${t('list')}" title="${t('list')}" aria-pressed="${state.view==='list'}">${icon('list')}</button></div><label for="sort" class="sr-only">${t('sort')}</label><select class="sort-select" id="sort">${['newest','oldest','title'].map(s=>`<option value="${s}" ${state.sort===s?'selected':''}>${t(s==='title'?'titleSort':s)}</option>`).join('')}</select></div></form><div class="filter-row"><button type="button" class="reset-filter" id="reset" hidden>${t('reset')}</button><span class="results-count" id="results-count" role="status" aria-live="polite"></span></div><div id="feed"></div><div id="load-more" class="load-more-wrap"></div>`;
  document.getElementById('search-form').addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);state.q=document.getElementById('search').value;visible=config.pageSize||8;render();});
  document.getElementById('search').addEventListener('input',e=>{state.q=e.target.value;clearTimeout(timer);timer=setTimeout(()=>{visible=config.pageSize||8;render();},120);});
  document.getElementById('sort').addEventListener('change',e=>{state.sort=e.target.value;visible=config.pageSize||8;render();});
  document.querySelectorAll('button[data-view]').forEach(btn=>btn.addEventListener('click',()=>{state.view=btn.dataset.view;storage.set('view',state.view);render();}));
  document.getElementById('reset').addEventListener('click',reset);
}
function render() {
  updateURL();document.querySelectorAll('.category-link').forEach(a=>{const value=new URL(a.href).searchParams.get('category')||'';a.classList.toggle('active',value===state.category&&(!!value||page==='home'));});const result=filteredPosts(),isFiltered=Boolean(state.q||state.category||state.tag);
  document.getElementById('results-count').textContent=`${result.length} ${t('entries')}`;
  document.getElementById('reset').hidden=!isFiltered;
  document.querySelectorAll('button[data-view]').forEach(btn=>btn.setAttribute('aria-pressed',state.view===btn.dataset.view));
  const feed=document.getElementById('feed'),more=document.getElementById('load-more');more.innerHTML='';
  if(!result.length){feed.innerHTML=emptyState(isFiltered);document.getElementById('reset-empty')?.addEventListener('click',reset);return;}
  const featured=page==='home'&&!isFiltered&&state.sort==='newest'&&state.view==='grid'&&result[0]?.featured?result[0]:null;
  const remaining=featured?result.filter(p=>p.slug!==featured.slug):result;
  feed.innerHTML=`${featured?card(featured,true):''}<div class="posts-grid" data-view="${state.view}">${remaining.slice(0,visible).map(p=>card(p)).join('')}</div>`;
  if(remaining.length>visible) {
    more.innerHTML=`<button type="button" class="button secondary" id="more-button">${t('more')} ${icon('chevron')}</button><p>${Math.min(visible,remaining.length)+(featured?1:0)} / ${result.length}</p>`;
    document.getElementById('more-button').addEventListener('click',()=>{const previous=visible;visible+=config.pageSize||8;render();document.querySelectorAll('.posts-grid .post-card h2 a')[previous]?.focus({preventScroll:true});});
  }
}
try{posts=await loadPosts();renderShell(page,posts);setTitle(page==='home'?'':t(page));buildUI();render();}
catch(error){renderShell(page);setTitle(t(page));errorState(error);}
window.addEventListener('popstate',()=>location.reload());
