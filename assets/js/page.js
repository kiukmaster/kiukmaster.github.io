import { config,lang,t,esc,localize,renderShell,loadPosts,setTitle,socialLinks,enhanceProse } from './core.js';
import {renderMarkdown} from './markdown.js';
const page=document.body.dataset.page;let posts=[];
try{posts=await loadPosts();}catch(error){console.warn(error);}
renderShell(page,posts);setTitle(t('about'));
if(page==='about'){
  const content=localize(config.about),links=socialLinks();
  document.getElementById('page-content').innerHTML=`<div class="page-heading"><div><span class="eyebrow">ABOUT</span><h1>${t('aboutTitle')}</h1></div></div>${content?`<section class="about-content panel"><div class="prose">${renderMarkdown(content).html}</div>${links?`<section class="about-contact"><h2>${t('contact')}</h2><div class="social-links">${links}</div></section>`:''}</section>`:`<section class="empty-state"><span class="eyebrow">ABOUT THIS SPACE</span><h2>${t('aboutEmpty')}</h2>${links?`<div class="social-links">${links}</div>`:''}</section>`}`;
}
document.querySelectorAll('.prose').forEach(enhanceProse);
