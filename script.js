(function(){
  const qs=(s,p=document)=>p.querySelector(s), qsa=(s,p=document)=>[...p.querySelectorAll(s)];
  const menu=qs('#mobileMenu'), panel=qs('#mobilePanel');
  if(menu&&panel) menu.addEventListener('click',()=>panel.classList.toggle('open'));

  const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.08});
  qsa('.reveal').forEach(el=>obs.observe(el));

  qsa('.acc-btn').forEach(btn=>btn.addEventListener('click',()=>btn.closest('.acc-item').classList.toggle('open')));

  qsa('[data-tabs]').forEach(group=>{
    const tabs=qsa('.tab',group), panels=qsa('.tab-panel',group);
    tabs.forEach(t=>t.addEventListener('click',()=>{
      tabs.forEach(x=>x.classList.remove('active')); panels.forEach(x=>x.classList.remove('active'));
      t.classList.add('active'); const p=qs('#'+t.dataset.target,group); if(p)p.classList.add('active');
    }));
  });

  const top=qs('#backTop');
  if(top) top.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

  window.showToast=function(msg){
    let t=qs('#toast'); if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t);}
    t.textContent=msg;t.classList.add('show');clearTimeout(window.__toastTimer);
    window.__toastTimer=setTimeout(()=>t.classList.remove('show'),1800);
  }
})();


(function(){
  const file=document.querySelector('#csvFile'), col=document.querySelector('#csvColumn'),
        metrics=document.querySelector('#csvMetrics'), preview=document.querySelector('#csvPreview'),
        canvas=document.querySelector('#trendCanvas'), ctx=canvas.getContext('2d');
  let headers=[], rows=[];

  function parseLine(line){
    const out=[];let cur='',q=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"'){ if(q && line[i+1]==='"'){cur+='"';i++;} else q=!q; }
      else if(c===','&&!q){out.push(cur);cur='';}
      else cur+=c;
    }
    out.push(cur); return out;
  }
  function parseCSV(text){
    const lines=text.replace(/\uFEFF/g,'').split(/\r?\n/).filter(x=>x.trim().length);
    if(!lines.length) return;
    headers=parseLine(lines[0]).map(x=>x.trim());
    rows=lines.slice(1).map(parseLine);
  }
  function values(h){
    const idx=headers.indexOf(h); if(idx<0)return[];
    return rows.map(r=>Number(String(r[idx]??'').trim())).filter(Number.isFinite);
  }
  function stats(a){
    if(!a.length)return null;
    const s=[...a].sort((x,y)=>x-y), mean=a.reduce((x,y)=>x+y,0)/a.length;
    const mid=Math.floor(s.length/2), med=s.length%2?s[mid]:(s[mid-1]+s[mid])/2;
    return {n:a.length,mean,med,min:s[0],max:s[s.length-1]};
  }
  function fmt(v){return Math.abs(v)>=1000?v.toLocaleString(undefined,{maximumFractionDigits:2}):v.toFixed(2)}
  function draw(a){
    const W=canvas.width,H=canvas.height,p=28;
    ctx.clearRect(0,0,W,H);
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0b2132');g.addColorStop(1,'#06121c');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(154,181,209,.12)';ctx.lineWidth=1;
    for(let i=0;i<5;i++){const y=p+i*(H-2*p)/4;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(W-p,y);ctx.stroke();}
    if(!a.length){ctx.fillStyle='#8fa3b5';ctx.font='15px Arial';ctx.fillText('Upload a CSV and select a numeric column.',p,50);return;}
    let sample=a; if(a.length>500){const step=Math.ceil(a.length/500);sample=a.filter((_,i)=>i%step===0);}
    const min=Math.min(...sample),max=Math.max(...sample),span=max-min||1;
    ctx.beginPath();ctx.lineWidth=2.4;ctx.strokeStyle='#5eead4';
    sample.forEach((v,i)=>{const x=p+(i/(sample.length-1||1))*(W-2*p), y=H-p-((v-min)/span)*(H-2*p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
    ctx.stroke();
    const grad=ctx.createLinearGradient(0,p,0,H-p);grad.addColorStop(0,'rgba(56,189,248,.28)');grad.addColorStop(1,'rgba(56,189,248,0)');
    ctx.lineTo(W-p,H-p);ctx.lineTo(p,H-p);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
    ctx.fillStyle='#9fb2c8';ctx.font='12px Arial';ctx.fillText('max '+fmt(max),p,16);ctx.fillText('min '+fmt(min),p,H-8);
  }
  function renderPreview(){
    const n=Math.min(rows.length,5), cols=Math.min(headers.length,6);
    let h='<table><thead><tr>'+headers.slice(0,cols).map(x=>'<th>'+escapeHtml(x)+'</th>').join('')+'</tr></thead><tbody>';
    for(let i=0;i<n;i++){h+='<tr>'+rows[i].slice(0,cols).map(x=>'<td>'+escapeHtml(x)+'</td>').join('')+'</tr>';}
    h+='</tbody></table>';preview.innerHTML=h;
  }
  function escapeHtml(x){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function update(){
    const a=values(col.value),s=stats(a);
    if(!s){draw([]);return;}
    metrics.innerHTML=`<div class="metric"><b>${s.n}</b><span>Valid values</span></div>
      <div class="metric"><b>${fmt(s.mean)}</b><span>Mean</span></div>
      <div class="metric"><b>${fmt(s.med)}</b><span>Median</span></div>
      <div class="metric"><b>${fmt(s.min)}–${fmt(s.max)}</b><span>Range</span></div>`;
    draw(a);
  }
  file.addEventListener('change',async()=>{
    const f=file.files[0]; if(!f)return;
    try{
      parseCSV(await f.text());
      const numeric=headers.filter(h=>values(h).length>=Math.max(3,Math.ceil(rows.length*.45)));
      col.innerHTML=numeric.length?numeric.map(h=>`<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join(''):'<option>No numeric columns detected</option>';
      renderPreview(); if(numeric.length)update();
      showToast(`${rows.length} rows loaded`);
    }catch(e){showToast('Could not read this CSV');}
  });
  col.addEventListener('change',update);
  document.querySelector('#resetCsv').addEventListener('click',()=>{
    file.value='';headers=[];rows=[];col.innerHTML='<option>Upload a CSV first</option>';
    metrics.innerHTML='<div class="metric"><b>—</b><span>Valid values</span></div><div class="metric"><b>—</b><span>Mean</span></div><div class="metric"><b>—</b><span>Median</span></div><div class="metric"><b>—</b><span>Range</span></div>';
    preview.innerHTML='<table><thead><tr><th>Status</th></tr></thead><tbody><tr><td>Upload a CSV to preview the first rows.</td></tr></tbody></table>';draw([]);showToast('Explorer reset');
  });
  draw([]);
})();
