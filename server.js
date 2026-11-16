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
      const overviewUrl = `https://app.rokstats.online/kingdoms/${encodeURIComponent(kingdomId)}?lang=en`;
      const overviewResponse = await fetch(overviewUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KVKStudio/1.0)' }, signal: AbortSignal.timeout(15000) });
      if (!overviewResponse.ok) throw new Error(`ROKSTATS 未找到王国 ${kingdomId}（HTTP ${overviewResponse.status}）`);
      const overviewHtml = await overviewResponse.text();
      const title = pageText((overviewHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[,''])[1]) || `Kingdom ${kingdomId}`;
      const name = (title.match(/Kingdom\s+\d+\s*[—-]\s*(.+?)(?:\s*\||$)/i)||[])[1] || '';
      const hrefs = [...overviewHtml.matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({ href:m[1]||m[2], text:pageText(m[3]) }));
      let dashboardUrl = hrefs.map(a=>a.href).find(h=>/\/kvk\/dashboard\//i.test(h));
      const currentUrl = hrefs.map(a=>a.href).find(h=>/\/kvk\/lost-kingdoms\/current/i.test(h));
      if (dashboardUrl && dashboardUrl.startsWith('/')) dashboardUrl = `https://app.rokstats.online${dashboardUrl}`;
      let dashboardHtml = '';
      if (dashboardUrl) {
        const dashboardResponse = await fetch(dashboardUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KVKStudio/1.0)' }, signal: AbortSignal.timeout(15000) });
        if (dashboardResponse.ok) dashboardHtml = await dashboardResponse.text();
      }
      let currentHtml = '';
      if (!dashboardHtml && currentUrl) {
        const currentResponse = await fetch(new URL(currentUrl, overviewUrl), { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KVKStudio/1.0)' }, signal: AbortSignal.timeout(15000) });
        if (currentResponse.ok) currentHtml = await currentResponse.text();
        const kingdomPos = currentHtml.indexOf(kingdomId);
        if (kingdomPos >= 0) {
          const rowStart = currentHtml.lastIndexOf('<tr', kingdomPos);
          const rowEnd = currentHtml.indexOf('</tr>', kingdomPos);
          const kingdomRow = rowStart >= 0 && rowEnd > kingdomPos ? currentHtml.slice(rowStart, rowEnd + 5) : currentHtml.slice(Math.max(0, kingdomPos - 1200), kingdomPos + 1200);
          const target = [...kingdomRow.matchAll(/(?:href\s*=\s*"([^"]+)"|href\s*=\s*'([^']+)')/gi)].map(m=>m[1]||m[2]).find(h=>/\/kvk\/(?:dashboard|lost-kingdoms)\//i.test(h));
          if (target) {
            const detailUrl = new URL(target, overviewUrl).href;
            const detailResponse = await fetch(detailUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KVKStudio/1.0)' }, signal: AbortSignal.timeout(15000) });
            if (detailResponse.ok) { dashboardHtml = await detailResponse.text(); dashboardUrl = detailUrl; }
          }
        }
      }
      const text = pageText(dashboardHtml);
      const pick = patterns => { for (const pattern of patterns) { const m=text.match(pattern); if(m) return Number(m[1].replace(/,/g,'')); } return null; };
      const dashboardHasData = Boolean(dashboardHtml) && !/Failed to load (?:basic|dashboard) data|No camp statistics available|No scan periods available/i.test(text);
      const stats = {
        kp: dashboardHasData ? pick([/(?:Kill\s*Points|KP)[^\d]{0,50}([\d,]+)/i]) : null, deaths: dashboardHasData ? pick([/(?:Dead\s*Troops|Deaths|Dead)[^\d]{0,50}([\d,]+)/i]) : null,
        t4: dashboardHasData ? pick([/T4[^\d]{0,40}([\d,]+)/i]) : null, t5: dashboardHasData ? pick([/T5[^\d]{0,40}([\d,]+)/i]) : null, players: dashboardHasData ? pick([/(?:Governors|Players|Participants)[^\d]{0,40}([\d,]+)/i]) : null, power: null
      };
      const hasStats = Object.values(stats).some(value=>value !== null);
      const source = dashboardUrl || currentUrl || overviewUrl;
      if (!hasStats) throw new Error(`王国 ${kingdomId} 页面可访问，但未找到可公开读取的 KvK 统计。可能需要 ROKSTATS 登录权限，或该王国尚无公开 KvK 扫描。`);
      const result = { kingdomId, name: name.trim(), season: '最新可用 KvK', scannedAt: new Date().toISOString(), stats, dashboardUrl: source, sourceTitle: title };
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
