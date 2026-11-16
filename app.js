const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const storeKey = 'kvk-studio-data-v2';
let records = JSON.parse(localStorage.getItem(storeKey) || '[]');
let currentView = 'all';
let selectedKingdom = 'all';
function number(value) { return Number(value || 0).toLocaleString('en-US'); }
function esc(value='') { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function normalized(raw) { return [...new Set(raw.split(/[\s,，;；\n]+/).map(x => x.trim()).filter(Boolean))]; }
function showMessage(message, kind='') { const el = $('#form-message'); el.textContent = message; el.className = `form-message ${kind}`; }
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
  $('#stat-date').textContent = latest ? new Date(latest).toLocaleDateString('zh-CN') : '暂无';
  const unique = ok;
  $('#kingdom-tabs').innerHTML = `<button class="kingdom-tab ${selectedKingdom==='all'?'active':''}" data-id="all">全部王国</button>` + unique.map(r=>`<button class="kingdom-tab ${selectedKingdom===String(r.kingdomId)?'active':''}" data-id="${esc(r.kingdomId)}">王国 ${esc(r.kingdomId)}</button>`).join('');
  $$('#kingdom-tabs button').forEach(btn=>btn.onclick=()=>{selectedKingdom=btn.dataset.id;render();});
  const data = selectedRows();
  const one = currentView==='kingdom' && selectedKingdom==='all' ? data[0] : null;
  const chosen = one ? [one] : data;
  const total = key => chosen.reduce((acc,r)=>acc+(Number(r.stats?.[key])||0),0);
  const sumMetric = (label, key, sub) => `<div class="metric-card"><span>${label}</span><strong>${has(key)?compact(total(key)):'—'}</strong><small>${chosen.length ? sub : '等待采集数据'}</small></div>`;
  $('#metric-cards').innerHTML = sumMetric('击杀点数 KP','kp', chosen.length===1?'该王国最新 KvK':'所选王国合计') + sumMetric('阵亡部队','deaths',chosen.length===1?'该王国最新 KvK':'所选王国合计') + `<div class="metric-card"><span>T4 / T5 击杀</span><strong>${has('t4')||has('t5')?`${compact(total('t4'))} / ${compact(total('t5'))}`:'—'}</strong><small>${chosen.length===1?'该王国最新 KvK':'所选王国合计'}</small></div>`;
  $('#kingdom-rows').innerHTML = data.length ? chosen.map(r=>`<tr><td class="kingdom-name">王国 ${esc(r.kingdomId)}${r.name?` · ${esc(r.name)}`:''}</td><td>${esc(r.season||'—')}</td><td>${r.stats?.players==null?'—':number(r.stats.players)}</td><td>${r.stats?.kp==null?'—':number(r.stats.kp)}</td><td>${r.stats?.deaths==null?'—':number(r.stats.deaths)}</td><td>${r.stats?.t4==null?'—':number(r.stats.t4)}</td><td>${r.stats?.t5==null?'—':number(r.stats.t5)}</td><td>${r.scannedAt?new Date(r.scannedAt).toLocaleDateString('zh-CN'):'—'}</td></tr>`).join('') : `<tr><td colspan="8" class="empty-row">${records.length?'所选王国暂无可用的 KvK 数据。':'提交王国编号后，在这里查看单国和汇总表现。'}</td></tr>`;
  const history = records.slice(0,8);
  $('#history-content').hidden = history.length>0;
  $('#table-wrap').hidden = history.length===0;
  $('#task-rows').innerHTML = history.map(r=>`<tr><td class="kingdom-name">王国 ${esc(r.kingdomId)}</td><td>${esc(r.season||'—')}</td><td><span class="status-tag ${r.status==='failed'?'fail':''}">${r.status==='completed'?'已完成':r.status==='running'?'采集中':'未获取'}</span></td><td>${new Date(r.createdAt).toLocaleString('zh-CN')}</td><td>${r.dashboardUrl?`<a href="${esc(r.dashboardUrl)}" target="_blank" rel="noreferrer">查看来源 ↗</a>`:esc(r.error||'—')}</td></tr>`).join('');
  $('#download-btn').disabled = !data.length;
  $('#clear-data-btn').disabled = records.length === 0;
  localStorage.setItem(storeKey, JSON.stringify(records));
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
$('#clear-data-btn').addEventListener('click',()=>{if(!records.length)return;if(!window.confirm('清除当前采集记录和汇总数据？清除后需要重新获取王国数据。'))return;records=[];selectedKingdom='all';localStorage.removeItem(storeKey);render();showMessage('当前数据已清除，可以重新获取并汇总。','success');});
$('#refresh-btn').addEventListener('click',()=>{render();const toast=$('#toast');toast.textContent='记录已刷新';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800);});
render();

