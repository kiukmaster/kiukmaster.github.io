/**
 * 소개 페이지의 설정 문자열만 읽어 표시하는 제한된 Markdown 렌더러.
 * 게시글은 이 모듈을 사용하지 않고 HTML 파일의 본문을 그대로 표시합니다.
 * 지원: 제목, 문단, 강조, 링크/이미지, 코드, 인용, 중첩 목록, 체크리스트, 표, 구분선.
 * 원시 HTML/iframe/script, 수식, 각주, GFM 전체 문법은 지원하지 않습니다.
 * 모든 텍스트는 escape 후 생성합니다. 링크는 http(s)/mailto/상대 주소만 허용합니다.
 */
import { esc } from './core.js';
const LIMIT = 200000;
function allowedURL(value, image = false) {
  const raw = String(value || '').trim();
  if (!raw || /[\u0000-\u0020\u007f\\]/.test(raw)) return '';
  if (/^(?:javascript|data|vbscript|file|blob):/i.test(raw)) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^(https?:|mailto:)/i.test(raw)) return '';
  if (image && /^mailto:/i.test(raw)) return '';
  return raw;
}
export function markdownText(source) {
  return String(source || '').replace(/!\[([^\]]*)\]\([^)]*\)/g,' $1 ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[`#*_~>|]/g,'').replace(/\s+/g,' ').trim();
}
export function renderMarkdown(source, options = {}) {
  source = String(source || '');
  if (source.length > LIMIT) throw new Error(`본문은 ${LIMIT.toLocaleString()}자까지 지원합니다.`);
  let headingNumber = 0;
  const headings = [];
  const inline = (text, depth = 0) => {
    if (depth > 10) return esc(text);
    let out = '', i = 0;
    while (i < text.length) {
      if (text[i] === '\\' && i + 1 < text.length && /[\\`*_{}\[\]()#+.!~|>-]/.test(text[i+1])) { out += esc(text[i+1]); i+=2; continue; }
      if (text[i] === '`') {
        const ticks = text.slice(i).match(/^`+/)[0], end = text.indexOf(ticks, i + ticks.length);
        if (end !== -1) { out += `<code>${esc(text.slice(i+ticks.length,end).replace(/\n/g,' '))}</code>`; i=end+ticks.length; continue; }
      }
      const isImage = text.startsWith('![',i);
      let matched = false;
      // URL 괄호는 최대 5단계까지 처리합니다.
      if (isImage || text[i] === '[') {
        const start=i+(isImage?2:1), close=text.indexOf('](',start);
        if(close!==-1) {
          let j=close+2, level=1;
          for(;j<text.length;j++) {if(text[j]==='(')level++;else if(text[j]===')'){level--;if(!level)break;}if(level>5)break;}
          if(!level) {
            const label=text.slice(start,close), destination=text.slice(close+2,j).trim();
            const match=destination.match(/^(\S+?)(?:\s+["']([^"']*)["'])?$/);
            const url=allowedURL(match?.[1],isImage);
            if(url) {
              const title=match[2]?` title="${esc(match[2])}"`:'';
              if(isImage) {
                const resolved=options.resolveImage?options.resolveImage(url):url;
                out+=resolved?`<img src="${esc(resolved)}" alt="${esc(label)}" loading="lazy" decoding="async"${title}>`:`<span class="muted">[${esc(label)}]</span>`;
              } else {
                const external=/^(?:https?:)?\/\//i.test(url);
                out+=`<a href="${esc(url)}"${external?' target="_blank" rel="noopener noreferrer"':''}${title}>${inline(label,depth+1)}</a>`;
              }
              i=j+1;matched=true;
            } else {out+=esc(text.slice(i,j+1));i=j+1;matched=true;}
          }
        }
      }
      if(matched)continue;
      for(const [mark,tag] of [['**','strong'],['__','strong'],['~~','del'],['*','em'],['_','em']]) {
        if(text.startsWith(mark,i) && !(mark==='_'&&/[\p{L}\p{N}]/u.test(text[i-1]||''))) {
          const end=text.indexOf(mark,i+mark.length);
          if(end>i+mark.length) {out+=`<${tag}>${inline(text.slice(i+mark.length,end),depth+1)}</${tag}>`;i=end+mark.length;matched=true;break;}
        }
      }
      if(matched)continue;
      if(text[i]==='<') {
        const match=text.slice(i).match(/^<(https?:\/\/[^\s<>]+)>/);
        if(match) {out+=`<a href="${esc(match[1])}" target="_blank" rel="noopener noreferrer">${esc(match[1])}</a>`;i+=match[0].length;continue;}
      }
      if(text.startsWith('  \n',i)){out+='<br>\n';i+=3;continue;}
      out+=esc(text[i]);i++;
    }
    return out;
  };
  const cells = line => {
    line=line.trim().replace(/^\|/,'').replace(/\|$/,'');
    const result=[];let current='',code=false;
    for(let i=0;i<line.length;i++) {
      if(line[i]==='\\'&&line[i+1]==='|'){current+='|';i++;continue;}
      if(line[i]==='`')code=!code;
      if(line[i]==='|'&&!code){result.push(current.trim());current='';}else current+=line[i];
    }
    result.push(current.trim());return result;
  };
  const isTableDivider=line=>line?.includes('-')&&cells(line).every(c=>/^:?-{3,}:?$/.test(c));
  const listMatch=line=>line.match(/^( *)([-+*]|\d+[.)])\s+(.*)$/);
  const blockStart=(line,next)=>/^\s*$/.test(line)||/^( {0,3})(#{1,6}\s|`{3,}|~{3,}|>|(?:[-*_]\s*){3,}$)/.test(line)||Boolean(listMatch(line))||(line.includes('|')&&isTableDivider(next));
  const blocks = (lines, depth = 0) => {
    if(depth>16)return `<p>${esc(lines.join('\n'))}</p>`;
    const html=[];let i=0;
    while(i<lines.length) {
      const line=lines[i];
      if(!line.trim()){i++;continue;}
      const fence=line.match(/^ {0,3}(`{3,}|~{3,})\s*([^\s]*)/);
      if(fence) {
        const token=fence[1][0],length=fence[1].length,language=(fence[2]||'text').replace(/[^a-zA-Z0-9_+-]/g,'').slice(0,30);
        const code=[];i++;
        while(i<lines.length&&!new RegExp(`^ {0,3}${token}{${length},}\\s*$`).test(lines[i]))code.push(lines[i++]);
        if(i<lines.length)i++;
        html.push(`<pre data-language="${esc(language)}"><code>${esc(code.join('\n'))}</code></pre>`);continue;
      }
      const heading=line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if(heading) {
        const level=Math.max(2,heading[1].length),id=`section-${++headingNumber}`,text=markdownText(heading[2]);
        headings.push({id,level,text});html.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`);i++;continue;
      }
      if(/^ {0,3}(?:\*\s*){3,}$/.test(line)||/^ {0,3}(?:-\s*){3,}$/.test(line)||/^ {0,3}(?:_\s*){3,}$/.test(line)){html.push('<hr>');i++;continue;}
      if(/^ {0,3}>/.test(line)) {
        const quote=[];while(i<lines.length&&/^ {0,3}>/.test(lines[i]))quote.push(lines[i++].replace(/^ {0,3}> ?/,''));
        html.push(`<blockquote>${blocks(quote,depth+1)}</blockquote>`);continue;
      }
      if(line.includes('|')&&isTableDivider(lines[i+1])) {
        const head=cells(line),align=cells(lines[i+1]).map(c=>c.startsWith(':')&&c.endsWith(':')?'align-center':c.endsWith(':')?'align-right':'');
        i+=2;const rows=[];
        while(i<lines.length&&lines[i].trim()&&lines[i].includes('|'))rows.push(cells(lines[i++]));
        html.push(`<div class="table-scroll" tabindex="0" role="region" aria-label="Table"><table><thead><tr>${head.map((c,k)=>`<th class="${align[k]||''}" scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${head.map((_,k)=>`<td class="${align[k]||''}">${inline(row[k]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue;
      }
      const list=listMatch(line);
      if(list) {
        const indent=list[1].length,ordered=/^\d/.test(list[2]),tag=ordered?'ol':'ul',start=ordered?parseInt(list[2],10):1,items=[];
        while(i<lines.length) {
          const m=listMatch(lines[i]);
          if(!m||m[1].length!==indent||/^\d/.test(m[2])!==ordered)break;
          const content=[m[3]],width=m[1].length+m[2].length+1;i++;
          while(i<lines.length) {
            const next=listMatch(lines[i]);
            if(next&&next[1].length<=indent)break;
            if(!lines[i].trim()) {
              let j=i+1;while(j<lines.length&&!lines[j].trim())j++;
              if(j<lines.length&&lines[j].match(/^ */)[0].length>indent){content.push('');i++;continue;}break;
            }
            const spaces=lines[i].match(/^ */)[0].length;
            if(spaces<=indent)break;
            content.push(lines[i].slice(Math.min(width,spaces)));i++;
          }
          const task=content[0].match(/^\[([ xX])\]\s+(.*)$/);
          if(task)content[0]=task[2];
          let body=blocks(content,depth+1);
          if(body.startsWith('<p>')) body=body.replace(/^<p>([\s\S]*?)<\/p>/,'$1');
          items.push(`<li${task?' class="task-item"':''}>${task?`<input type="checkbox" disabled aria-label="${esc(markdownText(task[2]))}" ${task[1].toLowerCase()==='x'?'checked':''}>`:''}${body}</li>`);
          if(i<lines.length&&!lines[i].trim()) {
            let j=i;while(j<lines.length&&!lines[j].trim())j++;
            const next=listMatch(lines[j]||'');if(next&&next[1].length===indent){i=j;continue;}
          }
        }
        html.push(`<${tag}${ordered&&start!==1?` start="${start}"`:''}>${items.join('')}</${tag}>`);continue;
      }
      const paragraph=[line];i++;
      while(i<lines.length&&!blockStart(lines[i],lines[i+1]))paragraph.push(lines[i++]);
      html.push(`<p>${inline(paragraph.join('\n'))}</p>`);
    }
    return html.join('\n');
  };
  return { html:blocks(source.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n')), headings, text:markdownText(source) };
}
