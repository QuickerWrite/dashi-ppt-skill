import { getThemeProfile } from '../skills/dashi-ppt/project/scripts/native-pptx/theme-profiles.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hex = (value, fallback) => /^#?[0-9a-f]{6}$/i.test(String(value || '')) ? '#' + String(value).replace('#','') : '#' + fallback;
const num = (value, fallback) => value != null && Number.isFinite(Number(value)) ? Number(value) : fallback;
const imageSource = value => /^data:image\/(png|jpeg|webp|gif);base64,/.test(String(value || '')) ? esc(value) : '';

// Render authoritative neutral content, never unfilled theme sample props.
// This uses Dashi's own theme profiles and keeps all resources in one artifact.
export function renderNeutralHtml(spec, theme) {
  const p = getThemeProfile(theme);
  const slides = spec.slides || [];
  if (!slides.length || slides.length > 200) throw new Error('Expected 1 to 200 slides');
  const pages = slides.map((slide, i) => {
    const bg = hex(slide.background?.color, p.bg);
    const background = imageSource(slide.background?.src);
    let body = background ? `<img class="background" src="${background}">` : '';
    const elements = Array.isArray(slide.elements) ? slide.elements : [];
    if (elements.length && !elements.every(el => el.kind === 'image')) {
      body += elements.map((el, n) => {
        const box = `position:absolute;left:${num(el.x,6)}%;top:${num(el.y,8+n*18)}%;width:${num(el.w,88)}%;height:${num(el.h,16)}%;`;
        const style = box + `font-size:${num(el.font_size,el.kind==='title'?34:22)/.6}px;color:${hex(el.color,p.text)};font-weight:${el.bold || el.kind==='title'?700:400};font-style:${el.italic?'italic':'normal'};text-align:${['left','center','right'].includes(el.align)?el.align:'left'};`;
        let content = esc(el.text);
        if (el.kind === 'image') {
          const src = imageSource(el.src || el.image_data || el.image_url);
          if (!src) throw new Error('Image requires embedded bytes');
          return `<img style="${box}object-fit:contain" src="${src}">`;
        }
        if (el.kind === 'list') content = `<ul>${(el.items || []).map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`;
        if (el.kind === 'table') content = `<table>${el.headers?.length ? '<tr>'+el.headers.map(c=>`<th>${esc(c)}</th>`).join('')+'</tr>':''}${(el.rows||[]).map(row=>'<tr>'+row.map(c=>`<td>${esc(c)}</td>`).join('')+'</tr>').join('')}</table>`;
        return `<div style="${style}${['shape','rect','rectangle','divider'].includes(el.kind)?`background:${hex(el.fill_color || el.background_color,p.accent)};`:''}">${content}</div>`;
      }).join('');
    } else {
      const cover = i === 0 || slide.role === 'cover';
      const media = elements.length ? elements : (slide.media || []);
      body += `<div class="accent"></div><h1 class="${cover?'cover-title':''}">${esc(slide.title)}</h1>`;
      body += `<div class="points ${cover?'cover-points':''}" style="width:${media.length?43:86}%">${(slide.points||[]).map((point,n)=>`<div class="point"><span class="ordinal">${String(n+1).padStart(2,'0')}</span><div>${esc(point)}</div></div>`).join('')}</div>`;
      body += media.map((item,n)=>{
        const src=imageSource(item.src); if(!src) throw new Error('Image requires embedded bytes');
        return `<img style="position:absolute;left:54%;top:${22+n*60/media.length}%;width:40%;height:${56/media.length}%;object-fit:contain" src="${src}">`;
      }).join('');
    }
    return `<section class="slide" style="background:${bg}">${body}</section>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(spec.title)}</title><style>
*{box-sizing:border-box}html,body{margin:0}body{font-family:"Noto Sans CJK SC","Microsoft YaHei",sans-serif;color:#${p.text}}
.slide{position:relative;width:1600px;height:900px;overflow:hidden;line-height:1.25}.background{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.accent{position:absolute;left:6%;top:8%;width:5%;height:8px;background:#${p.accent}}h1{position:absolute;left:6%;top:12%;width:88%;margin:0;font-size:58px;line-height:1.2}h1.cover-title{top:22%;font-size:74px}
.points{position:absolute;left:6%;top:29%;font-size:36px}.points.cover-points{top:48%;font-size:34px}.point{display:flex;align-items:flex-start;gap:28px;padding:18px 0;border-top:1px solid #${p.line}}.ordinal{color:#${p.accent};font-size:25px;padding-top:6px;min-width:44px}ul{margin:0;padding-left:1.3em}li{margin-bottom:.35em}table{border-collapse:collapse;width:100%;font-size:inherit}td,th{border:1px solid #${p.line};padding:12px}th{background:#${p.surface2}}
</style></head><body><div id="deck">${pages}</div></body></html>`;
}
