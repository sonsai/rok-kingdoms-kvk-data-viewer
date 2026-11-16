const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const storeKey = 'kvk-studio-data-v2';
const languageKey = 'kvk-studio-language';
const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const traditionalChars = {国:'國',战:'戰',绩:'績',总:'總',览:'覽',采:'採',现:'現',汇:'匯',数:'數',据:'據',时:'時',间:'間',参:'參',与:'與',击:'擊',杀:'殺',点:'點',阵:'陣',队:'隊',输:'輸',编:'編',号:'號',动:'動',选:'選',择:'擇',录:'錄',仅:'僅',访:'訪',问:'問',确:'確',认:'認',当:'當',显:'顯',语:'語',简:'簡',体:'體',导:'導',获:'獲',后:'後',这:'這',里:'裡',为:'為',于:'於',还:'還',没:'沒',请:'請',询:'詢',标:'標',题:'題',单:'單',个:'個',开:'開',并:'並',会:'會',关:'關',须:'須',员:'員',经:'經',过:'過',统:'統',计:'計',况:'況',详:'詳',态:'態',识:'識',观:'觀',视:'視',缩:'縮',变:'變',样:'樣',药:'藥',暂:'暫',独:'獨',对:'對',来:'來',们:'們',华:'華',兴:'興',条:'條',约:'約',达:'達',发:'發',长:'長',载:'載',级:'級',声:'聲',应:'應',将:'將',无:'無',该:'該',结:'結',构:'構',错:'錯',误:'誤',页:'頁',宽:'寬',扫:'掃',内:'內',际:'際',报:'報',仪:'儀',较:'較',准:'準',败:'敗',试:'試',尝:'嘗',权:'權',户:'戶',实:'實',为:'為',则:'則',并:'並',难:'難',处:'處',发:'發',动:'動',终:'終',线:'線',联:'聯',网:'網',历:'歷',区:'區',别:'別',发:'發',场:'場',达:'達',条:'條',选:'選',项:'項',额:'額',帮:'幫',助:'助',爱:'愛',礼:'禮'};
Object.assign(traditionalChars, {读:'讀',横:'橫',务:'務',规:'規',类:'類',况:'況',两:'兩',数:'數',据:'據',确:'確',为:'為',认:'認',边:'邊',线:'線',页:'頁',导:'導',览:'覽',响:'響',态:'態',时:'時',变:'變',换:'換',复:'復',杂:'雜',优:'優',输:'輸',录:'錄',历:'歷',试:'試',终:'終',场:'場',际:'際',据:'據',处:'處',规:'規',标:'標',执:'執',务:'務',条:'條',欢:'歡',进:'進',远:'遠',动:'動',达:'達',报:'報',种:'種',实:'實',线:'線',种:'種',连:'連',统:'統',组:'組',织:'織',录:'錄',头:'頭',顿:'頓',奖:'獎',营:'營',军:'軍',战:'戰',势:'勢',权:'權',记:'記',录:'錄',录:'錄',导:'導',项:'項',选:'選',获:'獲',发:'發',现:'現',为:'為',对:'對',从:'從',将:'將',据:'據',开:'開',复:'復',汇:'匯',总:'總',类:'類',传:'傳',数:'數',扫:'掃',描:'描',来:'來',进:'進',过:'過',这:'這',后:'後',还:'還',没:'沒',请:'請',该:'該',仅:'僅',参:'參',与:'與',击:'擊',杀:'殺',阵:'陣',队:'隊',际:'際',国:'國',报:'報',户:'戶',广:'廣',东:'東',万:'萬',为:'為',里:'裡',条:'條',头:'頭',压:'壓',终:'終',输:'輸',选:'選',择:'擇',开:'開',简:'簡',体:'體',语:'語',区:'區',际:'際',扩:'擴',显:'顯',会:'會',应:'應',统:'統',务:'務',扫:'掃',准:'準',后:'後',单:'單',个:'個',数:'數',据:'據',显:'顯',现:'現',转:'轉',换:'換'});
function detectLanguage() { const candidates = navigator.languages?.length ? navigator.languages : [navigator.language || 'zh-CN']; return candidates.some(value => /^zh[-_](Hant|TW|HK|MO)([-_]|$)/i.test(value)) ? 'zh-Hant' : 'zh-Hans'; }
let language = localStorage.getItem(languageKey) || detectLanguage();
function t(value) { return language === 'zh-Hant' ? [...value].map(char => traditionalChars[char] || char).join('') : value; }
function translateDom() {
  document.documentElement.lang = language === 'zh-Hant' ? 'zh-Hant' : 'zh-CN';
  document.title = t('KvK 情报台 · 王国战绩');
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    node.nodeValue = t(originalText.get(node));
  }
  for (const input of $$('input[placeholder]')) {
    let attrs = originalAttributes.get(input);
    if (!attrs) { attrs = {}; originalAttributes.set(input, attrs); }
    if (!('placeholder' in attrs)) attrs.placeholder = input.placeholder;
    input.placeholder = t(attrs.placeholder);
  }
  for (const element of $$('[aria-label]')) {
    let attrs = originalAttributes.get(element);
    if (!attrs) { attrs = {}; originalAttributes.set(element, attrs); }
    if (!('aria-label' in attrs)) attrs['aria-label'] = element.getAttribute('aria-label');
    element.setAttribute('aria-label', t(attrs['aria-label']));
  }
  $('#language-select').value = language;
}
let records = JSON.parse(localStorage.getItem(storeKey) || '[]');
let currentView = 'all';
let selectedKingdom = 'all';
function number(value) { return Number(value || 0).toLocaleString('en-US'); }
function esc(value='') { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function normalized(raw) { return [...new Set(raw.split(/[\s,，;；\n]+/).map(x => x.trim()).filter(Boolean))]; }
function showMessage(message, kind='') { const el = $('#form-message'); el.textContent = message; originalText.set(el.firstChild, message); el.className = `form-message ${kind}`; translateDom(); }
function latestByKingdom(rows) {
  const latest = new Map();
  for (const row of rows.filter(r => r.status === 'completed')) {
    const id = String(row.kingdomId);
    const timestamp = Date.parse(row.scannedAt || row.createdAt) || 0;
    const previous = latest.get(id);
    if (!previous || timestamp >= previous.timestamp) latest.set(id, { row, timestamp });
  }
  return [...latest.values()].map(item => item.row);
}
function selectedRows() { return latestByKingdom(records).filter(r => selectedKingdom === 'all' || String(r.kingdomId) === selectedKingdom); }
function render() {
  const ok = latestByKingdom(records);
  $('#stat-kingdoms').textContent = new Set(ok.map(r=>r.kingdomId)).size;
  const stats = ok.map(r=>r.stats || {});
  const sum = key => stats.reduce((acc,row)=>acc+(Number(row[key])||0),0);
  const has = key => stats.some(row=>row[key] !== undefined && row[key] !== null);
  $('#stat-players').textContent = has('players') ? number(sum('players')) : '—';
  $('#stat-kp').textContent = has('kp') ? compact(sum('kp')) : '—';
  const latest = ok.map(r=>r.scannedAt).filter(Boolean).sort().at(-1);
  $('#stat-date').textContent = latest ? new Date(latest).toLocaleDateString(language === 'zh-Hant' ? 'zh-TW' : 'zh-CN') : '暂无';
  const unique = ok;
  $('#kingdom-tabs').innerHTML = `<button class="kingdom-tab ${selectedKingdom==='all'?'active':''}" data-id="all">全部王国</button>` + unique.map(r=>`<button class="kingdom-tab ${selectedKingdom===String(r.kingdomId)?'active':''}" data-id="${esc(r.kingdomId)}">王国 ${esc(r.kingdomId)}</button>`).join('');
  $$('#kingdom-tabs button').forEach(btn=>btn.onclick=()=>{selectedKingdom=btn.dataset.id;render();});
  const data = selectedRows();
  const one = currentView==='kingdom' && selectedKingdom==='all' ? data[0] : null;
  const chosen = one ? [one] : data;
  const total = key => chosen.reduce((acc,r)=>acc+(Number(r.stats?.[key])||0),0);
  const sumMetric = (label, key, sub) => `<div class="metric-card"><span>${label}</span><strong>${has(key)?compact(total(key)):'—'}</strong><small>${chosen.length ? sub : '等待采集数据'}</small></div>`;
  $('#metric-cards').innerHTML = sumMetric('击杀点数 KP','kp', chosen.length===1?'该王国最新 KvK':'所选王国合计') + sumMetric('阵亡部队','deaths',chosen.length===1?'该王国最新 KvK':'所选王国合计') + `<div class="metric-card"><span>T4 / T5 击杀</span><strong>${has('t4')||has('t5')?`${compact(total('t4'))} / ${compact(total('t5'))}`:'—'}</strong><small>${chosen.length===1?'该王国最新 KvK':'所选王国合计'}</small></div>`;
  $('#kingdom-rows').innerHTML = data.length ? chosen.map(r=>`<tr><td class="kingdom-name">王国 ${esc(r.kingdomId)}${r.name?` · ${esc(r.name)}`:''}</td><td>${esc(r.season||'—')}</td><td>${r.stats?.players==null?'—':number(r.stats.players)}</td><td>${r.stats?.kp==null?'—':number(r.stats.kp)}</td><td>${r.stats?.deaths==null?'—':number(r.stats.deaths)}</td><td>${r.stats?.t4==null?'—':number(r.stats.t4)}</td><td>${r.stats?.t5==null?'—':number(r.stats.t5)}</td><td>${r.scannedAt?new Date(r.scannedAt).toLocaleDateString(language === 'zh-Hant' ? 'zh-TW' : 'zh-CN'):'—'}</td></tr>`).join('') : `<tr><td colspan="8" class="empty-row">${records.length?'所选王国暂无可用的 KvK 数据。':'提交王国编号后，在这里查看单国和汇总表现。'}</td></tr>`;
  const history = records.slice(0,8);
  $('#history-content').hidden = history.length>0;
  $('#table-wrap').hidden = history.length===0;
  $('#task-rows').innerHTML = history.map(r=>`<tr><td class="kingdom-name">王国 ${esc(r.kingdomId)}</td><td>${esc(r.season||'—')}</td><td><span class="status-tag ${r.status==='failed'?'fail':''}">${r.status==='completed'?'已完成':r.status==='running'?'采集中':'未获取'}</span></td><td>${new Date(r.createdAt).toLocaleString(language === 'zh-Hant' ? 'zh-TW' : 'zh-CN')}</td><td>${r.dashboardUrl?`<a href="${esc(r.dashboardUrl)}" target="_blank" rel="noreferrer">查看来源 ↗</a>`:esc(r.error||'—')}</td></tr>`).join('');
  $('#download-btn').disabled = !data.length;
  $('#clear-data-btn').disabled = records.length === 0;
  localStorage.setItem(storeKey, JSON.stringify(records));
  translateDom();
}
function compact(n) { n=Number(n)||0; if(n>=1e9)return `${(n/1e9).toFixed(2)}B`; if(n>=1e6)return `${(n/1e6).toFixed(2)}M`; if(n>=1e3)return `${(n/1e3).toFixed(1)}K`; return number(n); }
$('#parse-btn').addEventListener('click',()=>{ const ids=normalized($('#kingdom-ids').value); $('#kingdom-ids').value=ids.join(', '); showMessage(ids.length?`已识别 ${ids.length} 个王国编号。`:'请输入王国编号。',ids.length?'success':''); });
$('#scrape-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const ids=normalized($('#kingdom-ids').value);
  if(!ids.length){showMessage('请先输入至少一个王国编号。');return;}
  if(ids.some(id=>!/^[0-9]{1,6}$/.test(id))){showMessage('王国编号需为数字，多个编号请用逗号或空格分隔。');return;}
  const metrics=$$('input[name="metric"]:checked').map(el=>el.value);
  const btn=$('#submit-btn');btn.disabled=true;btn.firstElementChild.textContent='正在获取…';showMessage(`正在查找 ${ids.length} 个王国的最新 KvK 数据。`,'success');
  let completed=0;
  for(const kingdomId of ids){
    const item={kingdomId,status:'running',createdAt:new Date().toISOString()};
    records.unshift(item);render();
    try{const response=await fetch('/api/kingdoms/latest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kingdomId,metrics})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'读取 ROKSTATS 数据失败');Object.assign(item,payload,{status:'completed'});completed++;}
    catch(error){item.status='failed';item.error=error.message;}
    render();
  }
  btn.disabled=false;btn.firstElementChild.textContent='获取 KvK 数据';
  const failed=ids.length-completed;
  showMessage(failed?`完成 ${completed}/${ids.length} 个王国；${failed} 个暂时无法读取。查看采集记录中的原因。`:`已获取 ${completed} 个王国的最新 KvK 数据。`,completed?'success':'');
});
$$('.segment').forEach(button=>button.addEventListener('click',()=>{$$('.segment').forEach(x=>x.classList.toggle('active',x===button));currentView=button.dataset.view;render();}));
$('#download-btn').addEventListener('click',()=>{const data=selectedRows();if(!data.length)return;const blob=new Blob([JSON.stringify(data.map(({kingdomId,name,season,scannedAt,stats,dashboardUrl})=>({kingdomId,name,season,scannedAt,stats,dashboardUrl})),null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='kvk-performance.json';link.click();URL.revokeObjectURL(link.href);});
$('#clear-data-btn').addEventListener('click',()=>{if(!records.length)return;if(!window.confirm(t('清除当前采集记录和汇总数据？清除后需要重新获取王国数据。')))return;records=[];selectedKingdom='all';localStorage.removeItem(storeKey);render();showMessage('当前数据已清除，可以重新获取并汇总。','success');});
$('#refresh-btn').addEventListener('click',()=>{render();const toast=$('#toast');toast.textContent='记录已刷新';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800);});
$('#language-select').addEventListener('change', event => { language = event.target.value; localStorage.setItem(languageKey, language); render(); });
render();

