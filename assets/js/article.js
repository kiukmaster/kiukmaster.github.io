/** 정적 HTML 본문을 읽는 기능만 담당합니다. 파일 생성·수정·업로드는 하지 않습니다. */
import {t,esc,icon,renderShell,loadPosts,postURL,rootURL,enhanceProse,copyText,notify,lang,readingTime,sortPostsByPublished} from './core.js';
const slug=document.body.dataset.slug;
let posts=[];
try { posts=await loadPosts(); }
catch (error) { console.warn('본문은 읽을 수 있지만 글 목록을 불러오지 못했습니다.',error); }
renderShell('writing',posts);
const contentLanguage=document.body.dataset.contentLanguage||'ko';
document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);el.lang=lang;});
const back=document.getElementById('article-back');
if (back) { back.innerHTML=icon('arrow')+t('back');back.href=rootURL('index.html'); }
const prose=document.getElementById('article-body');
if (prose) {
  prose.lang=contentLanguage;
  // 목차와 예상 읽기 시간은 파일을 바꾸지 않고 현재 화면에만 표시합니다.
  document.querySelectorAll('[data-reading-time]').forEach(el=>{
    el.textContent=readingTime(prose.textContent)+' '+t('minutes');el.lang=lang;
  });
  enhanceProse(prose);
  const headings=[...prose.querySelectorAll('h2,h3,h4')];
  const used=new Set([...document.querySelectorAll('[id]')].map(el=>el.id));
  const headingIDs=new Set();
  headings.forEach((heading,index)=>{
    if (!heading.id || headingIDs.has(heading.id)) {
      const base='section-'+(index+1);let id=base,suffix=1;
      while(used.has(id)) id=base+'-'+suffix++;
      heading.id=id;used.add(id);
    }
    headingIDs.add(heading.id);
  });
  const markup=headings.map(h=>`<a href="#${esc(encodeURIComponent(h.id))}" data-heading="${esc(h.id)}" class="${h.tagName!=='H2'?'subheading':''}">${esc(h.textContent)}</a>`).join('');
  if (headings.length) {
    const panel=document.createElement('section');panel.className='toc-panel panel';
    panel.innerHTML=`<h2>${t('toc')}</h2><nav class="toc-list" aria-label="${t('toc')}">${markup}</nav>`;
    document.querySelector('.sidebar-sticky')?.append(panel);
    const mobile=document.getElementById('mobile-toc');
    if (mobile) { mobile.hidden=false;const nav=mobile.querySelector('nav');if(nav){nav.innerHTML=markup;nav.setAttribute('aria-label',t('toc'));} }
    if ('IntersectionObserver' in window) {
      const observer=new IntersectionObserver(entries=>{
        const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
        if(visible.length) document.querySelectorAll('.toc-list a').forEach(a=>a.classList.toggle('active',a.dataset.heading===visible[0].target.id));
      },{rootMargin:'-85px 0px -65% 0px'});
      headings.forEach(h=>observer.observe(h));
    }
    // JS가 id를 붙인 뒤에도 저장된 목차 주소의 위치로 이동합니다.
    if (location.hash) {
      try { const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(target&&prose.contains(target))requestAnimationFrame(()=>target.scrollIntoView()); }
      catch { /* 잘못된 URL 해시를 무시합니다. */ }
    }
  }
  const bar=document.getElementById('reading-progress');
  if (bar) {
    let ticking=false;
    function progress() {
      const rect=prose.getBoundingClientRect(),available=Math.max(1,rect.height-window.innerHeight+100);
      const percent=Math.max(0,Math.min(100,(-rect.top+100)/available*100));
      bar.style.width=percent+'%';ticking=false;
    }
    const schedule=()=>{if(!ticking){requestAnimationFrame(progress);ticking=true;}};
    window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
    prose.querySelectorAll('img').forEach(img=>img.addEventListener('load',schedule));progress();
  }
}
document.getElementById('share-link')?.addEventListener('click',async()=>notify(t(await copyText(location.href.split('#')[0])?'copied':'copyFail')));
const sorted=sortPostsByPublished(posts);
const index=sorted.findIndex(post=>post.slug===slug),adjacent=document.getElementById('adjacent-posts');
if(index>=0 && adjacent){
  const prev=sorted[index-1],next=sorted[index+1];
  adjacent.innerHTML=`${prev?`<a href="${postURL(prev)}"><span>${t('previous')}</span>${esc(prev.title)}</a>`:''}${next?`<a class="next-entry" href="${postURL(next)}"><span>${t('next')}</span>${esc(next.title)}</a>`:''}`;
}
