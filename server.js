const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const tasks = [];
function pageText(html) { return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim(); }
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function clean(value = '') { return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim(); }
function attr(tag, name) { const match = tag.match(new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return match ? (match[1] || match[2] || match[3] || '') : ''; }
function extract(html, base, selector) {
  const results = [];
  if (selector === 'a' || selector === 'a[href]') {
    for (const match of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) { const href = attr(match[0], 'href'); const text = clean(match[1]); if (href && text) { try { results.push({ text, url: new URL(href, base).href }); } catch {} } }
  } else if (selector === 'img' || selector === 'img[src]') {
    for (const match of html.matchAll(/<img\b[^>]*>/gi)) { const src = attr(match[0], 'src'); if (src) { try { results.push({ text: attr(match[0], 'alt') || '图片', url: new URL(src, base).href }); } catch {} } }
  } else {
    const simple = selector.match(/^([a-z][\w-]*|\*)?(?:([.#])([\w-]+))?$/i);
    if (!simple) throw new Error('暂只支持简单 CSS 选择器，例如 h2、.product、#main、a[href]');
    const tag = simple[1] && simple[1] !== '*' ? simple[1] : '[a-z][\\w-]*';
    const attrTest = simple[2] === '.' ? `(?=[^>]*\\bclass\\s*=\\s*["'][^"']*\\b${simple[3]}\\b)` : simple[2] === '#' ? `(?=[^>]*\\bid\\s*=\\s*["']${simple[3]}["'])` : '';
    const re = new RegExp(`<(${tag})\\b${attrTest}[^>]*>([\\s\\S]*?)<\\/\\1\\s*>`, 'gi');
    for (const match of html.matchAll(re)) { const text = clean(match[2]); if (text) results.push({ text }); }
  }
  return results.slice(0, 500);
}
function pageData(html, url) {
  const title = clean((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [,''])[1]) || url;
  const descriptionTag = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]).find(tag => /\bname\s*=\s*["']description["']/i.test(tag));
  const description = descriptionTag ? attr(descriptionTag, 'content') : '';
  const links = extract(html, url, 'a[href]');
  const text = clean(html).slice(0, 3000);
  return { title, description, links, text };
}
function send(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(data)); }
async function body(req) { let raw=''; for await (const chunk of req) raw += chunk; return JSON.parse(raw || '{}'); }
async function scrape(input) {
  const url = new URL(input.url);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('仅支持 http 或 https 地址');
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DataStudio/1.0)' }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
  if (!response.ok) throw new Error(`目标网站返回 HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html') && !type.includes('text/plain')) throw new Error('目标地址不是可读取的网页');
  const html = (await response.text()).slice(0, 5_000_000);
  const fields = input.fields || ['title', 'description', 'links'];
  const data = pageData(html, response.url);
  const result = { title: data.title };
  if (fields.includes('description')) result.description = data.description;
  if (fields.includes('links')) result.links = data.links;
  if (fields.includes('text')) result.text = data.text;
  const selector = (input.selector || '').trim();
  if (selector) result.selected = extract(html, response.url, selector);
  return { url: response.url, status: response.status, fetchedAt: new Date().toISOString(), result };
}
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
  if (req.method === 'GET' && pathname === '/api/tasks') return send(res, 200, tasks);
  if (req.method === 'POST' && pathname === '/api/kingdoms/latest') {
    let task;
    try {
      const input = await body(req);
      const kingdomId = String(input.kingdomId || '');
      if (!/^\d{1,6}$/.test(kingdomId)) throw new Error('王国编号格式无效');
      task = { id: Date.now().toString(36), kingdomId, status: 'running', createdAt: new Date().toISOString() }; tasks.unshift(task);
      const source = new URL('https://app.rokstats.online/api/kingdoms/seed-ranking/kvk-performance');
      source.searchParams.set('kingdoms', kingdomId);
      source.searchParams.set('limit', '10');
      source.searchParams.set('includeSelectionMeta', '0');
      const response = await fetch(source, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; KVKStudio/1.0)' }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`ROKSTATS 接口返回 HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.success === false) throw new Error(payload.error || `ROKSTATS 无法读取王国 ${kingdomId}`);
      const recentKvks = payload.byKingdom?.[kingdomId]?.recentKvks;
      if (!Array.isArray(recentKvks) || recentKvks.length === 0) throw new Error(`ROKSTATS 没有王国 ${kingdomId} 的 recentKvks 数据。`);
      const kvk = recentKvks.reduce((latest, item) => Number(item.lkCode) > Number(latest.lkCode) ? item : latest);
      const stats = {
        players: kvk.trackedPlayers ?? null,
        kp: kvk.kp ?? null,
        deaths: kvk.dead ?? null,
        t4: kvk.t4 ?? null,
        t5: kvk.t5 ?? null,
        power: kvk.powerDiff ?? null,
        participants: kvk.participants ?? null,
        acclaim: kvk.acclaim ?? null,
        healed: kvk.healed ?? null
      };
      const result = { kingdomId, name: '', season: `Season ${kvk.season} · LK ${kvk.lkCode}`, lkCode: kvk.lkCode, seasonNumber: kvk.season, openTime: kvk.openTime, closeTime: kvk.closeTime, scannedAt: new Date().toISOString(), stats, dashboardUrl: source.href, sourceTitle: `ROKSTATS KvK Performance · LK ${kvk.lkCode}` };
      Object.assign(task, { ...result, status: 'completed' });
      return send(res, 200, result);
    } catch (error) { if (task) { task.status='failed'; task.error=error.message; } return send(res, 422, { error:error.message, task }); }
  }
  if (req.method === 'POST' && pathname === '/api/scrape') {
    let task; try { const input = await body(req); task = { id: Date.now().toString(36), url: input.url, name: input.name || input.url, status: 'running', createdAt: new Date().toISOString() }; tasks.unshift(task); task.data = await scrape(input); task.status = 'completed'; }
    catch (error) { if (task) { task.status = 'failed'; task.error = error.message; } return send(res, 400, { error: error.message, task }); }
    return send(res, 200, task);
  }
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  const target = path.resolve(ROOT, file);
  if (!target.startsWith(ROOT + path.sep)) return send(res, 403, { error: 'Forbidden' });
  fs.readFile(target, (err, content) => { if (err) return send(res, 404, { error: 'Not found' }); res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' }); res.end(content); });
});
server.listen(PORT, () => console.log(`Data Studio running at http://localhost:${PORT}`));

