#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import pptxgen from 'pptxgenjs';
import { getThemeProfile } from './native-pptx/theme-profiles.mjs';

const args = parseArgs(process.argv.slice(2));
if ((!args.spec && !args.goal) || !args.out) {
  console.error('Usage: node scripts/export-native-pptx.mjs [--spec <neutral-spec.json>] [--goal <goal.json>] --out <deck.pptx>');
  process.exit(2);
}

const spec = args.spec && fs.existsSync(args.spec) ? readJson(args.spec) : {};
const goal = args.goal && fs.existsSync(args.goal) ? readJson(args.goal) : {};
const deck = { ...goal, ...spec };
const themeId = String(args.theme || spec.theme || goal.themePack || 'theme01').toLowerCase();
const profile = getThemeProfile(themeId);
const slides = Array.isArray(spec.slides) && spec.slides.length ? spec.slides : Array.isArray(goal.slides) ? goal.slides : [];
if (!slides.length) throw new Error('slides must not be empty');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Dashi PPT Skill · QuickerWrite native runner';
pptx.company = 'QuickerWrite';
pptx.subject = String(deck.title || 'Presentation');
pptx.title = String(deck.title || 'Presentation');
pptx.lang = String(deck.language || 'zh-CN');
pptx.theme = {
  headFontFace: profile.fontZh,
  bodyFontFace: profile.fontZh,
  lang: String(deck.language || 'zh-CN'),
};
pptx.defineSlideMaster({
  title: `DASHI_${themeId.toUpperCase()}`,
  background: { color: profile.bg },
  objects: [],
  slideNumber: { x: 12.25, y: 7.05, w: 0.6, h: 0.22, color: profile.muted, fontFace: profile.font, fontSize: 8, align: 'right' },
});

for (let index = 0; index < slides.length; index += 1) {
  const total = Number(spec.planned_slides) || 0;
  const cacheKey = crypto.createHash('sha256').update(JSON.stringify([slides[index], index, themeId, spec.title, total])).digest('hex');
  const cacheFile = args['page-cache'] ? path.join(args['page-cache'], `${index}-${cacheKey}.json`) : null;
  const target = pptx.addSlide(`DASHI_${themeId.toUpperCase()}`);
  if (cacheFile && fs.existsSync(cacheFile)) {
    for (const command of readJson(cacheFile)) {
      if (command.property) target[command.property] = command.value;
      else target[command.method](...command.args);
    }
    console.log(JSON.stringify({type:'page_ready', page:index + 1, revision:cacheKey, reused:true}));
    continue;
  }
  const commands = [];
  const slide = new Proxy(target, {
    get(object, key) {
      if (typeof object[key] !== 'function') return object[key];
      return (...values) => {
        commands.push({method:key, args:JSON.parse(JSON.stringify(values))});
        return object[key](...values);
      };
    },
    set(object, key, value) { commands.push({property:key, value}); object[key] = value; return true; },
  });
  const source = normalizeSlide(slides[index], index, total);
  const goalSlide = Array.isArray(goal.slides) ? goal.slides[index] || {} : {};
  if (Array.isArray(slides[index].elements) && slides[index].elements.length) {
    renderElements(slide, slides[index]);
    if (source.speakerNotes) slide.addNotes(source.speakerNotes);
  } else {
  slide.background = { color: profile.bg };
  addThemeAtmosphere(slide, profile, index);
  if (index === 0 || source.role === 'cover') renderCover(slide, source, profile, deck, index);
  else renderBody(slide, source, profile, goalSlide, index, total);
  addChrome(slide, source, profile, themeId, index, total);
  if (source.speakerNotes && typeof slide.addNotes === 'function') slide.addNotes(source.speakerNotes);
  }
  if (cacheFile) {
    fs.mkdirSync(path.dirname(cacheFile), {recursive:true});
    fs.writeFileSync(`${cacheFile}.tmp`, JSON.stringify(commands));
    fs.renameSync(`${cacheFile}.tmp`, cacheFile);
  }
  if (args['page-output']) {
    fs.mkdirSync(args['page-output'], {recursive:true});
    const snapshot = path.join(args['page-output'], `page-${index + 1}.pptx`);
    await pptx.writeFile({fileName:snapshot + '.tmp.pptx'});
    fs.renameSync(snapshot + '.tmp.pptx', snapshot);
  }
  console.log(JSON.stringify({type:'page_ready', page:index + 1, revision:cacheKey, reused:false}));
}

fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
await pptx.writeFile({ fileName: path.resolve(args.out) });
console.log(JSON.stringify({ file: path.resolve(args.out), slides: slides.length, theme: themeId, renderer: 'pptxgenjs-native-v1' }));

function renderElements(slide, raw) {
  const color = (value, fallback) => /^#?[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).replace('#', '') : fallback;
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const background = color(raw.background?.color, profile.bg);
  slide.background = {color: background};
  const fg = parseInt(background.slice(0, 2), 16) * .299 + parseInt(background.slice(2, 4), 16) * .587 + parseInt(background.slice(4), 16) * .114 < 128 ? 'FFFFFF' : '171717';
  for (const el of raw.elements) {
    const x = Math.max(0, Math.min(99, finite(el.x, 6))), y = Math.max(0, Math.min(99, finite(el.y, 6)));
    const w = Math.max(.1, Math.min(100 - x, finite(el.w, 88))), h = Math.max(.1, Math.min(100 - y, finite(el.h, 16)));
    const box = {x: x / 100 * 13.333333, y: y / 100 * 7.5, w: w / 100 * 13.333333, h: h / 100 * 7.5};
    const textOpts = {...box, fontFace: el.font_name || profile.fontZh, fontSize: finite(el.font_size, 20), color: color(el.color, fg), bold: Boolean(el.bold), italic: Boolean(el.italic), align: ['left','center','right','justify'].includes(el.align) ? el.align : 'left', margin: 0, valign: 'top', breakLine: false, fit: 'shrink'};
    if (el.kind === 'image') {
      const src = el.src || el.image_data;
      if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src || '')) {
        slide.addImage({data: src, ...box, sizing: {type: el.object_fit === 'contain' ? 'contain' : 'cover', w: box.w, h: box.h}});
      }
    } else if (el.kind === 'table') {
      const rows = [...(el.headers?.length ? [el.headers] : []), ...(el.rows || [])];
      if (rows.length) slide.addTable(rows, {...textOpts, border: {pt:.5, color: color(el.border_color, 'CCCCCC')}, margin: 4, autoPage:false});
    } else if (el.kind === 'divider') {
      slide.addShape(pptx.ShapeType.line, {...box, h:0, line:{color:color(el.color, profile.accent), width:1.5}});
    } else if (el.kind === 'progress_bar') {
      const fraction = Math.max(0, Math.min(1, finite(el.value, 0) / Math.max(1, finite(el.max_value || el.max, 100))));
      slide.addText(String(el.label || ''), {...textOpts, h: box.h * .65, fontSize:14});
      const track = {...box,y:box.y + box.h * .7,h:box.h * .2};
      slide.addShape(pptx.ShapeType.rect,{...track,fill:{color:color(el.track_color,'CCCCCC')},line:{transparency:100}});
      if(fraction) slide.addShape(pptx.ShapeType.rect,{...track,w:box.w*fraction,fill:{color:color(el.bar_color,profile.accent)},line:{transparency:100}});
    } else {
      if (['shape','callout','quote'].includes(el.kind)) {
        const names = {rectangle:'rect',rounded_rectangle:'roundRect',circle:'ellipse',oval:'ellipse',arrow_right:'rightArrow',arrow_left:'leftArrow'};
        const name = names[el.shape_type] || el.shape_type || 'rect';
        slide.addShape(pptx.ShapeType[name] || pptx.ShapeType.rect, {...box, fill:{color:color(el.fill_color || el.background_color,profile.accent)},line:{color:color(el.border_color,profile.accent),transparency:el.border_color ? 0 : 100}});
      }
      if (Array.isArray(el.items)) {
        slide.addText(el.items.map((text,i)=>({text:String(text),options:{breakLine:true,bullet:el.kind === 'numbered_list' ? {type:'ul', style:'arabicPeriod', numberStartAt:i+1} : {indent:14}}})),textOpts);
      } else if (el.text) slide.addText(String(el.text),textOpts);
    }
  }
}

function parseArgs(values) {
  const out = {};
  for (let i = 0; i < values.length; i += 1) {
    if (!values[i].startsWith('--')) continue;
    out[values[i].slice(2)] = values[i + 1];
    i += 1;
  }
  return out;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function normalizeSlide(raw, index, count) {
  const presentation = raw?.content?.presentation && typeof raw.content.presentation === 'object' ? raw.content.presentation : {};
  const canonicalItems = Array.isArray(presentation.items) ? presentation.items : [];
  const rawPoints = Array.isArray(raw?.points) ? raw.points : canonicalItems.map(item => item?.label || item?.displayValue || item?.value || item?.detail);
  const points = rawPoints.map(value => String(value || '').trim()).filter(Boolean).slice(0, 10);
  return {
    id: String(raw?.id || `slide-${index + 1}`),
    role: String(raw?.role || presentation.role || (index === 0 ? 'cover' : index === count - 1 ? 'result' : 'content')).toLowerCase(),
    title: String(raw?.title || presentation.title || `第 ${index + 1} 页`).trim(),
    points,
    speakerNotes: String(raw?.speaker_notes || presentation.speakerNotes || '').trim(),
  };
}

function addThemeAtmosphere(slide, p, index) {
  const transparent = p.mode === 'dark' ? 72 : 80;
  if (p.style === 'soft') {
    slide.addShape(pptx.ShapeType.ellipse, { x: 10.55, y: 0, w: 2.78, h: 2.4, fill: { color: p.accent, transparency: 82 }, line: { transparency: 100 }, shadow: softShadow(p.accent, 0.18) });
    slide.addShape(pptx.ShapeType.ellipse, { x: 0, y: 5.5, w: 1.5, h: 2.0, fill: { color: p.accent2, transparency: 88 }, line: { transparency: 100 } });
  } else if (['neon', 'glass', 'blue'].includes(p.style)) {
    slide.addShape(pptx.ShapeType.ellipse, { x: 9.0, y: 0, w: 4.3, h: 4.0, fill: { color: p.accent, transparency: 86 }, line: { color: p.accent, transparency: 82, width: 1.2 } });
    slide.addShape(pptx.ShapeType.ellipse, { x: 10.1, y: 4.7, w: 2.1, h: 2.1, fill: { color: p.accent2, transparency: 82 }, line: { color: p.accent2, transparency: 70 } });
  } else if (p.style === 'code') {
    for (let i = 0; i < 9; i += 1) slide.addShape(pptx.ShapeType.line, { x: 8.4 + i * 0.45, y: 0.5, w: 0, h: 5.9, line: { color: p.line, transparency: 48, width: 0.5 } });
    for (let i = 0; i < 7; i += 1) slide.addShape(pptx.ShapeType.line, { x: 8.4, y: 0.5 + i * 0.85, w: 3.6, h: 0, line: { color: p.line, transparency: 48, width: 0.5 } });
  } else if (p.style === 'research') {
    slide.addShape(pptx.ShapeType.rect, { x: 8.9, y: 0, w: 4.45, h: 7.5, fill: { color: p.accent, transparency: index % 2 ? 8 : 0 }, line: { transparency: 100 } });
    for (let i = 0; i < 14; i += 1) slide.addShape(pptx.ShapeType.line, { x: 7.4 + i * 0.31, y: 0, w: 1.7, h: 7.5, line: { color: 'FFFFFF', transparency: 85, width: 0.6 } });
  } else if (p.style === 'collage') {
    slide.addShape(pptx.ShapeType.rect, { x: 9.7, y: 0.65, w: 2.7, h: 1.55, rotate: -4, fill: { color: 'FFFFFF', transparency: 2 }, line: { color: p.line, width: 0.8 }, shadow: softShadow('000000', 0.16) });
    slide.addShape(pptx.ShapeType.rect, { x: 8.5, y: 4.55, w: 2.8, h: 1.5, rotate: 6, fill: { color: p.accent, transparency: 16 }, line: { color: p.text, transparency: 80 } });
  } else if (p.style === 'gold') {
    for (let i = 0; i < 18; i += 1) {
      const y1 = 6.6 - i * 0.12;
      const y2 = 3.8 + i * 0.06;
      slide.addShape(pptx.ShapeType.line, { x: 5.7, y: Math.min(y1, y2), w: 7.63, h: Math.abs(y2 - y1), flipV: y2 < y1, line: { color: p.accent, transparency: 88 - (i % 4) * 3, width: 0.5 } });
    }
  } else if (p.style === 'growth') {
    slide.addText('燃', { x: 9.4, y: 1.0, w: 3.2, h: 4.8, fontFace: p.fontZh, fontSize: 124, bold: true, color: p.text, transparency: 94, margin: 0, align: 'center', valign: 'mid' });
  } else if (p.style === 'waveform') {
    for (let i = 0; i < 36; i += 1) {
      const height = 0.18 + Math.abs(Math.sin(i * 0.72)) * 1.35;
      slide.addShape(pptx.ShapeType.rect, { x: 8.0 + i * 0.12, y: 3.75 - height / 2, w: 0.055, h: height, fill: { color: i % 3 ? p.accent : p.accent2, transparency: transparent }, line: { transparency: 100 } });
    }
  } else {
    slide.addShape(pptx.ShapeType.rect, { x: 9.8, y: 0, w: 3.55, h: 7.5, fill: { color: p.surface2, transparency: 10 }, line: { transparency: 100 } });
  }
}

function renderCover(slide, source, p, spec) {
  const centered = ['soft', 'blue'].includes(p.style);
  const titleSize = fontSizeFor(source.title, centered ? 54 : 48, centered ? 38 : 34);
  if (centered) {
    addAccentOrb(slide, p, 6.25, 1.05, 0.78);
    slide.addText(source.title, { x: 1.2, y: 2.15, w: 10.9, h: 1.45, fontFace: p.fontZh, fontSize: titleSize, bold: true, color: p.text, align: 'center', valign: 'mid', margin: 0, breakLine: false, fit: 'shrink' });
    slide.addText(String(spec.audience || p.name), { x: 2.7, y: 3.75, w: 7.9, h: 0.38, fontFace: p.fontZh, fontSize: 15, color: p.muted, align: 'center', charSpacing: 1.2, margin: 0 });
    addKeywordRail(slide, source.points, p, 3.3, 4.55, 6.7, true);
  } else {
    slide.addText(p.name.toUpperCase(), { x: 0.75, y: 0.76, w: 5.4, h: 0.3, fontFace: p.font, fontSize: 10, bold: true, color: p.accent, charSpacing: 2.2, margin: 0 });
    slide.addText(source.title, { x: 0.75, y: 1.45, w: 7.4, h: 2.25, fontFace: p.fontZh, fontSize: titleSize, bold: true, color: p.text, margin: 0, valign: 'mid', breakLine: false, fit: 'shrink' });
    const sub = String(spec.audience || source.points[0] || '面向关键决策的结构化演示');
    slide.addText(sub, { x: 0.8, y: 4.05, w: 5.9, h: 0.62, fontFace: p.fontZh, fontSize: 17, color: p.muted, margin: 0, breakLine: false, fit: 'shrink' });
    addKeywordRail(slide, source.points.slice(0, 4), p, 0.8, 5.15, 6.8, false);
    slide.addShape(pptx.ShapeType.line, { x: 0.8, y: 6.45, w: 7.2, h: 0, line: { color: p.line, width: 0.8 } });
    slide.addText(new Date().getFullYear().toString(), { x: 7.1, y: 5.65, w: 1.0, h: 0.72, fontFace: p.font, fontSize: 24, bold: true, color: p.accent, margin: 0, align: 'right' });
  }
}

function renderBody(slide, source, p, goalSlide, index, count) {
  const role = source.role;
  const pageNo = Number(String(goalSlide?.layout || '').match(/page(\d+)/)?.[1] || index + 1);
  const variant = pageNo % 4;
  slide.addText(source.title, { x: 0.75, y: 0.72, w: 9.2, h: 0.72, fontFace: p.fontZh, fontSize: fontSizeFor(source.title, 31, 25), bold: true, color: p.text, margin: 0, breakLine: false, fit: 'shrink' });
  slide.addShape(pptx.ShapeType.rect, { x: 0.76, y: 1.58, w: 0.72, h: 0.055, fill: { color: p.accent }, line: { transparency: 100 } });
  if (/result|conclusion|ending|action/.test(role)) return renderResult(slide, source, p);
  if (/process|timeline|flow|roadmap/.test(role)) return renderProcess(slide, source, p);
  if (/comparison|compare|option/.test(role)) return renderSplit(slide, source, p);
  if (/evidence|metric|data|chart|analysis/.test(role)) return renderEvidence(slide, source, p);
  if (variant === 3) return renderProcess(slide, source, p);
  if (variant === 2) return renderSplit(slide, source, p);
  if (variant === 1) return renderEvidence(slide, source, p);
  return renderEditorial(slide, source, p, index, count);
}

function renderEditorial(slide, source, p, index, count) {
  const points = source.points.length ? source.points : ['核心观点', '关键依据', '行动方向'];
  const width = 7.45;
  points.slice(0, 6).forEach((point, i) => {
    const y = 2.02 + i * 0.72;
    slide.addText(String(i + 1).padStart(2, '0'), { x: 0.8, y, w: 0.44, h: 0.34, fontFace: p.font, fontSize: 10, bold: true, color: p.accent, margin: 0 });
    slide.addShape(pptx.ShapeType.line, { x: 1.35, y: y + 0.04, w: width, h: 0, line: { color: p.line, width: 0.7 } });
    slide.addText(point, { x: 1.35, y: y + 0.13, w: width, h: 0.42, fontFace: p.fontZh, fontSize: 18, color: p.text, margin: 0, breakLine: false, fit: 'shrink' });
  });
  slide.addText(String(index + 1).padStart(2, '0'), { x: 9.55, y: 1.8, w: 2.5, h: 2.25, fontFace: p.font, fontSize: 92, bold: true, color: p.accent, transparency: p.mode === 'dark' ? 58 : 72, margin: 0, align: 'right' });
  slide.addText(`${points.length} KEY POINTS`, { x: 9.65, y: 4.32, w: 2.4, h: 0.28, fontFace: p.font, fontSize: 9, bold: true, color: p.muted, charSpacing: 1.4, margin: 0, align: 'right' });
}

function renderEvidence(slide, source, p) {
  const points = source.points.length ? source.points : ['数据说明', '趋势判断', '关键结论'];
  const numeric = points.map(extractMetric);
  const hasValues = numeric.filter(Boolean).length >= 2;
  if (hasValues) {
    const labels = numeric.filter(Boolean).map(item => item.label);
    const values = numeric.filter(Boolean).map(item => item.value);
    slide.addChart(pptx.ChartType.bar, [{ name: 'Value', labels, values }], {
      x: 0.8, y: 2.0, w: 7.55, h: 4.25, catAxisLabelColor: p.muted, valAxisLabelColor: p.muted,
      chartColors: [p.accent], showLegend: false, showTitle: false, showValue: true,
      showCatName: false, showValue: true, showBorder: false, showCategoryName: false,
      valGridLine: { color: p.line, transparency: 45, width: 0.5 },
      catAxisLineColor: p.line, valAxisLineColor: p.line, showValue: true,
    });
  } else {
    points.slice(0, 5).forEach((point, i) => {
      const y = 2.0 + i * 0.83;
      slide.addText(point, { x: 0.82, y, w: 4.25, h: 0.42, fontFace: p.fontZh, fontSize: 17, color: p.text, margin: 0, breakLine: false, fit: 'shrink' });
      slide.addShape(pptx.ShapeType.roundRect, { x: 5.15, y: y + 0.04, w: 3.15, h: 0.18, rectRadius: 0.06, fill: { color: p.surface2 }, line: { transparency: 100 } });
      slide.addShape(pptx.ShapeType.roundRect, { x: 5.15, y: y + 0.04, w: 1.25 + (i % 4) * 0.55, h: 0.18, rectRadius: 0.06, fill: { color: i % 2 ? p.accent2 : p.accent }, line: { transparency: 100 } });
    });
  }
  addCallout(slide, source.points.at(-1) || source.title, p, 9.0, 2.0, 3.2, 3.25);
}

function renderSplit(slide, source, p) {
  const points = source.points.length ? source.points : ['方案一', '方案二', '决策建议', '实施条件'];
  const halves = [points.filter((_, i) => i % 2 === 0), points.filter((_, i) => i % 2 === 1)];
  halves.forEach((items, col) => {
    const x = 0.8 + col * 6.05;
    slide.addShape(pptx.ShapeType.roundRect, { x, y: 1.95, w: 5.65, h: 4.65, rectRadius: 0.08, fill: { color: p.surface, transparency: p.mode === 'dark' ? 8 : 0 }, line: { color: col ? p.accent2 : p.accent, transparency: 24, width: 1.2 }, shadow: softShadow('000000', p.mode === 'dark' ? 0.24 : 0.10) });
    slide.addText(col ? 'B' : 'A', { x: x + 0.32, y: 2.25, w: 0.72, h: 0.72, fontFace: p.font, fontSize: 30, bold: true, color: col ? p.accent2 : p.accent, margin: 0 });
    items.slice(0, 4).forEach((item, i) => {
      slide.addShape(pptx.ShapeType.ellipse, { x: x + 0.38, y: 3.25 + i * 0.72, w: 0.12, h: 0.12, fill: { color: col ? p.accent2 : p.accent }, line: { transparency: 100 } });
      slide.addText(item, { x: x + 0.67, y: 3.08 + i * 0.72, w: 4.45, h: 0.44, fontFace: p.fontZh, fontSize: 17, color: p.text, margin: 0, breakLine: false, fit: 'shrink' });
    });
  });
}

function renderProcess(slide, source, p) {
  const points = (source.points.length ? source.points : ['识别问题', '形成方案', '执行验证', '持续优化']).slice(0, 6);
  const gap = 0.22;
  const width = (11.75 - gap * (points.length - 1)) / points.length;
  slide.addShape(pptx.ShapeType.line, { x: 1.0, y: 4.05, w: 11.2, h: 0, line: { color: p.line, width: 1.2 } });
  points.forEach((point, i) => {
    const x = 0.8 + i * (width + gap);
    const color = i % 2 ? p.accent2 : p.accent;
    slide.addShape(pptx.ShapeType.ellipse, { x: x + width / 2 - 0.18, y: 3.87, w: 0.36, h: 0.36, fill: { color }, line: { color: p.bg, width: 2 } });
    slide.addText(String(i + 1).padStart(2, '0'), { x, y: 2.22, w: width, h: 0.55, fontFace: p.font, fontSize: 21, bold: true, color, align: 'center', margin: 0 });
    slide.addText(point, { x, y: 2.92, w: width, h: 0.62, fontFace: p.fontZh, fontSize: 16, bold: true, color: p.text, align: 'center', valign: 'mid', margin: 0.02, fit: 'shrink' });
    slide.addText(i === points.length - 1 ? 'DELIVER' : 'PROGRESS', { x, y: 4.62, w: width, h: 0.25, fontFace: p.font, fontSize: 8, color: p.muted, align: 'center', charSpacing: 1.0, margin: 0 });
  });
}

function renderResult(slide, source, p) {
  const takeaway = source.points.at(-1) || source.title;
  slide.addText(takeaway, { x: 0.82, y: 1.95, w: 8.15, h: 1.65, fontFace: p.fontZh, fontSize: fontSizeFor(takeaway, 38, 28), bold: true, color: p.text, margin: 0, valign: 'mid', fit: 'shrink' });
  slide.addShape(pptx.ShapeType.rect, { x: 0.82, y: 3.95, w: 8.1, h: 0.08, fill: { color: p.accent }, line: { transparency: 100 } });
  source.points.slice(0, 4).forEach((item, i) => {
    slide.addText(`${String(i + 1).padStart(2, '0')}  ${item}`, { x: 0.82 + (i % 2) * 4.2, y: 4.42 + Math.floor(i / 2) * 0.72, w: 3.85, h: 0.42, fontFace: p.fontZh, fontSize: 16, color: p.muted, margin: 0, breakLine: false, fit: 'shrink' });
  });
  addAccentOrb(slide, p, 10.35, 2.2, 1.65);
  slide.addText('NEXT', { x: 9.45, y: 4.15, w: 3.4, h: 0.55, fontFace: p.font, fontSize: 25, bold: true, color: p.accent, align: 'center', charSpacing: 3, margin: 0 });
}

function addChrome(slide, source, p, themeId, index, count) {
  slide.addText(`${themeId.toUpperCase()} · ${p.name}`, { x: 0.76, y: 7.05, w: 4.0, h: 0.2, fontFace: p.font, fontSize: 7.5, bold: true, color: p.muted, charSpacing: 1.0, margin: 0 });
  slide.addText(`${String(index + 1).padStart(2, '0')}${count ? ` / ${String(count).padStart(2, '0')}` : ''}`, { x: 11.55, y: 7.03, w: 0.95, h: 0.22, fontFace: p.font, fontSize: 8, color: p.muted, align: 'right', margin: 0 });
}

function addKeywordRail(slide, points, p, x, y, width, centered) {
  const values = points.length ? points.slice(0, 4) : [p.name, 'NATIVE PPTX', 'EDITABLE'];
  const itemW = Math.min(1.85, (width - 0.18 * (values.length - 1)) / values.length);
  const total = itemW * values.length + 0.18 * (values.length - 1);
  const start = centered ? x + (width - total) / 2 : x;
  values.forEach((value, i) => {
    slide.addShape(pptx.ShapeType.roundRect, { x: start + i * (itemW + 0.18), y, w: itemW, h: 0.38, rectRadius: 0.08, fill: { color: i === 0 ? p.accent : p.surface2, transparency: i === 0 ? 0 : 16 }, line: { color: i === 0 ? p.accent : p.line, transparency: 20 } });
    slide.addText(value, { x: start + i * (itemW + 0.18) + 0.08, y: y + 0.07, w: itemW - 0.16, h: 0.2, fontFace: p.fontZh, fontSize: 8.5, bold: true, color: i === 0 && p.mode === 'dark' ? p.bg : p.text, align: 'center', margin: 0, breakLine: false, fit: 'shrink' });
  });
}

function addAccentOrb(slide, p, x, y, size) {
  slide.addShape(pptx.ShapeType.ellipse, { x: x - size * 0.18, y: y - size * 0.16, w: size * 1.35, h: size * 1.35, fill: { color: p.accent, transparency: 88 }, line: { transparency: 100 } });
  slide.addShape(pptx.ShapeType.ellipse, { x, y, w: size, h: size, fill: { color: p.accent, transparency: p.mode === 'dark' ? 18 : 28 }, line: { color: p.accent, transparency: 28, width: 1.2 }, shadow: softShadow(p.accent, 0.30) });
  slide.addShape(pptx.ShapeType.ellipse, { x: x + size * 0.2, y: y + size * 0.13, w: size * 0.26, h: size * 0.14, fill: { color: 'FFFFFF', transparency: 28 }, line: { transparency: 100 } });
}

function addCallout(slide, text, p, x, y, w, h) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: p.surface, transparency: p.mode === 'dark' ? 5 : 0 }, line: { color: p.accent, transparency: 28, width: 1.0 }, shadow: softShadow('000000', p.mode === 'dark' ? 0.28 : 0.12) });
  slide.addText('KEY INSIGHT', { x: x + 0.3, y: y + 0.38, w: w - 0.6, h: 0.26, fontFace: p.font, fontSize: 9, bold: true, color: p.accent, charSpacing: 1.5, margin: 0 });
  slide.addText(text, { x: x + 0.3, y: y + 1.0, w: w - 0.6, h: h - 1.35, fontFace: p.fontZh, fontSize: fontSizeFor(text, 22, 16), bold: true, color: p.text, valign: 'mid', margin: 0, fit: 'shrink' });
}

function softShadow(color, opacity) {
  return { type: 'outer', color, opacity, blur: 3, angle: 45, distance: 2 };
}

function fontSizeFor(text, preferred, minimum) {
  const length = [...String(text || '')].length;
  if (length <= 10) return preferred;
  if (length <= 18) return Math.max(minimum, preferred - 6);
  if (length <= 28) return Math.max(minimum, preferred - 11);
  return minimum;
}

function extractMetric(text) {
  const raw = String(text || '');
  const match = raw.match(/(-?\d+(?:\.\d+)?)\s*(%|％|万|亿|k|m)?/i);
  if (!match) return null;
  return { label: raw.replace(match[0], '').replace(/[：:，,\-—]/g, ' ').trim() || raw, value: Number(match[1]) };
}
