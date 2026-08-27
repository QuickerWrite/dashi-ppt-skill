#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillRoot = path.join(root, 'skills/dashi-ppt');
const project = path.join(skillRoot, 'project');
const outputRoot = path.resolve(process.env.QW_RUNNER_OUTPUT_DIR || path.join(root, '.runner-output'));
const host = process.env.QW_RUNNER_HOST || '0.0.0.0';
const port = Number(process.env.QW_RUNNER_PORT || 8080);
const secret = process.env.QW_RUNNER_SHARED_SECRET || '';
const jobs = new Map();
fs.mkdirSync(outputRoot, { recursive: true });

function json(res, status, value) { const body = Buffer.from(JSON.stringify(value)); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': body.length }); res.end(body); }
function auth(req, body = Buffer.alloc(0)) {
  if (!secret) return true;
  const stamp = String(req.headers['x-quickerwrite-timestamp'] || '');
  const supplied = String(req.headers['x-quickerwrite-signature'] || '').replace(/^sha256=/, '');
  if (!/^\d+$/.test(stamp) || Math.abs(Date.now() / 1000 - Number(stamp)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${stamp}.`).update(body).digest('hex');
  const a = Buffer.from(supplied, 'hex'); const b = Buffer.from(expected, 'hex');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}
async function body(req) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > 3 * 1024 * 1024) throw new Error('request too large'); chunks.push(chunk); } return Buffer.concat(chunks); }
function exec(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: project, env: { ...process.env, INIT_CWD: project }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', x => { output = (output + x).slice(-10000); }); child.stderr.on('data', x => { output = (output + x).slice(-10000); });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve(output) : reject(new Error(`${command} exited ${code}: ${output}`)));
  });
}
function safe(value) { return String(value || 'presentation').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || 'presentation'; }
function theme(value, title) {
  const explicit = String(value || '').match(/^theme(0[1-9]|1[0-2])$/)?.[0]; if (explicit) return explicit;
  const text = String(title || '').toLowerCase();
  if (/代码|开发|技术|api|架构/.test(text)) return 'theme03';
  if (/数据|分析|报告|调研|市场/.test(text)) return 'theme07';
  if (/品牌|故事|人物/.test(text)) return 'theme09';
  if (/增长|商业计划/.test(text)) return 'theme11';
  return 'theme01';
}
function briefs(spec) {
  const slides = Array.isArray(spec.slides) ? spec.slides : [];
  return slides.map((slide, index) => {
    const points = Array.isArray(slide.points) ? slide.points : [];
    return { role: index === 0 ? 'cover' : index === slides.length - 1 ? 'result' : String(slide.role || 'context'), priority: index === 0 ? 'statement' : 'content', content: { presentation: { title: String(slide.title || `第 ${index + 1} 页`), titleShort: String(slide.title || '').slice(0, 18), summary: String(points[0] || ''), summaryShort: String(points[0] || '').slice(0, 40), takeaway: String(points.at(-1) || ''), items: index === 0 ? [] : points.slice(0, 10).map((point, i) => ({ id: `item-${i + 1}`, label: String(point), detail: String(point), required: true, priority: i + 1 })) }, meta: { panelTitle: String(spec.title || ''), pageLabel: `${index + 1}/${slides.length}`, brand: '' }, media: [] } };
  });
}
async function generate(id, spec) {
  const job = jobs.get(id); const dir = path.join(outputRoot, id); const pptDir = path.join(dir, 'ppt');
  try {
    fs.mkdirSync(pptDir, { recursive: true });
    const content = briefs(spec); if (!content.length) throw new Error('slides must not be empty');
    const briefsFile = path.join(dir, 'briefs.json'); const goal = path.join(dir, 'goal.json'); const html = path.join(pptDir, 'index.html');
    fs.writeFileSync(briefsFile, JSON.stringify(content, null, 2)); const selectedTheme = theme(spec.theme, spec.title);
    job.status = 'running'; job.progress = 10; job.stage = 'scaffolding';
    await exec(process.execPath, [path.join(project, 'scripts/goal-scaffold.mjs'), '--title', String(spec.title || 'Presentation'), '--goal', String(spec.title || 'Presentation'), '--audience', String(spec.audience || '目标受众'), '--theme', selectedTheme, '--pages', String(content.length), '--content-briefs', briefsFile, '--layout-variants', '3', '--seed', id, '--workflow-run-id', id, '--chunk-size', '5', '--out', goal]);
    job.progress = 40; job.stage = 'validating_goal'; await exec(process.execPath, [path.join(project, 'scripts/write-safe-props.mjs'), '--goal', goal, '--write']);
    job.progress = 55; job.stage = 'rendering_html'; await exec(path.join(project, 'node_modules/.bin/tsx'), [path.join(project, 'scripts/render-goal-deck.jsx'), goal, html]);
    // A deployed deck must not depend on GitHub navigation. The runner's
    // local source-offer endpoint remains the single legal/source entry.
    const rendered = fs.readFileSync(html, 'utf8').replace(/https:\/\/github\.com\/[^"]+/g, '/source');
    fs.writeFileSync(html, rendered);
    const requested = Array.isArray(spec.outputs) ? spec.outputs : ['pptx', 'html']; const artifacts = [];
    if (requested.includes('html')) artifacts.push({ type: 'html', file_name: `${safe(spec.title)}.html`, mime_type: 'text/html; charset=utf-8', download_url: `/v1/jobs/${id}/artifacts/html` });
    if (requested.includes('pptx')) { job.progress = 72; job.stage = 'exporting_pptx'; const file = path.join(dir, `${safe(spec.title)}.pptx`); await exec(process.execPath, [path.join(project, 'scripts/export-pptx.mjs'), pptDir, file]); artifacts.push({ type: 'pptx', file_name: path.basename(file), mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', download_url: `/v1/jobs/${id}/artifacts/pptx` }); }
    if (requested.includes('pdf')) { job.progress = 84; job.stage = 'exporting_pdf'; const file = path.join(dir, `${safe(spec.title)}.pdf`); await exec(process.execPath, [path.join(project, 'scripts/export-pptx.mjs'), pptDir, file, '--pdf']); artifacts.push({ type: 'pdf', file_name: path.basename(file), mime_type: 'application/pdf', download_url: `/v1/jobs/${id}/artifacts/pdf` }); }
    Object.assign(job, { artifacts, status: 'succeeded', progress: 100, stage: 'completed', theme: selectedTheme });
  } catch (error) { Object.assign(job, { status: 'failed', stage: 'failed', error: String(error?.message || error) }); }
}
function file(res, location, type) { if (!fs.existsSync(location)) return json(res, 404, { error: 'artifact not found' }); const data = fs.readFileSync(location); res.writeHead(200, { 'content-type': type, 'content-length': data.length }); res.end(data); }
function sourceArchive() { const target = path.join(outputRoot, 'dashi-ppt-skill-source.tar.gz'); const result = spawnSync('tar', ['--exclude=.git', '--exclude=.runner-output', '--exclude=node_modules', '-czf', target, '-C', path.dirname(root), path.basename(root)], { encoding: 'utf8' }); if (result.status !== 0) throw new Error(result.stderr || 'could not build source archive'); return target; }

http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://runner.local');
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, engine: 'dashi' });
  if (req.method === 'GET' && url.pathname === '/source') return json(res, 200, { license: 'AGPL-3.0', download_url: '/source/archive' });
  if (req.method === 'GET' && url.pathname === '/source/archive') { try { const target = sourceArchive(); const data = fs.readFileSync(target); res.writeHead(200, { 'content-type': 'application/gzip', 'content-disposition': 'attachment; filename="dashi-ppt-skill-source.tar.gz"', 'content-length': data.length }); return res.end(data); } catch (error) { return json(res, 500, { error: String(error.message) }); } }
  if (req.method === 'GET' && url.pathname.startsWith('/v1/previews/')) return file(res, path.join(skillRoot, 'assets/skill/theme-style-grid.png'), 'image/png');
  let raw = Buffer.alloc(0); if (req.method === 'POST') { try { raw = await body(req); } catch (error) { return json(res, 413, { error: String(error.message) }); } }
  if (!auth(req, raw)) return json(res, 401, { error: 'invalid signature' });
  if (req.method === 'POST' && url.pathname === '/v1/jobs') {
    let spec; try { spec = JSON.parse(raw.toString('utf8')); } catch { return json(res, 400, { error: 'invalid JSON' }); }
    if (spec.protocol_version !== '1.0') return json(res, 400, { error: 'unsupported protocol_version' });
    const id = crypto.randomUUID(); jobs.set(id, { job_id: id, status: 'queued', progress: 0, stage: 'queued', artifacts: [], engine_version: '0.4.11+quickerwrite-runner-v1', source_offer_url: '/source' }); setImmediate(() => generate(id, spec)); return json(res, 202, jobs.get(id));
  }
  const match = url.pathname.match(/^\/v1\/jobs\/([0-9a-f-]+)$/); if (req.method === 'GET' && match) { const job = jobs.get(match[1]); return job ? json(res, 200, job) : json(res, 404, { error: 'job not found' }); }
  const artifact = url.pathname.match(/^\/v1\/jobs\/([0-9a-f-]+)\/artifacts\/(html|pptx|pdf)$/);
  if (req.method === 'GET' && artifact) { const [, id, kind] = artifact; const dir = path.join(outputRoot, id); if (kind === 'html') return file(res, path.join(dir, 'ppt/index.html'), 'text/html; charset=utf-8'); const meta = jobs.get(id)?.artifacts?.find(x => x.type === kind); return meta ? file(res, path.join(dir, meta.file_name), meta.mime_type) : json(res, 404, { error: 'artifact not found' }); }
  return json(res, 404, { error: 'not found' });
}).listen(port, host, () => console.log(`Dashi QuickerWrite runner listening on ${host}:${port}`));
