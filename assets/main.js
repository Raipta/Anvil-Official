/* ============ THEME ============ */
(function(){
  const saved = localStorage.getItem('wb-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();

function toggleTheme(){
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('wb-theme', next);
  updateThemeIcon(next);
}
function updateThemeIcon(theme){
  const sun = document.getElementById('iconSun');
  const moon = document.getElementById('iconMoon');
  if(!sun || !moon) return;
  sun.style.display = theme === 'dark' ? 'block' : 'none';
  moon.style.display = theme === 'dark' ? 'none' : 'block';
}
document.addEventListener('DOMContentLoaded', ()=>{
  updateThemeIcon(document.documentElement.getAttribute('data-theme'));
});

/* ============ MOBILE MENU ============ */
function toggleMenu(){
  document.getElementById('navLinks')?.classList.toggle('open');
}

/* ============ SEARCH (used on homepage) ============ */
function filterTools(q){
  q = q.toLowerCase();
  document.querySelectorAll('[data-search]').forEach(c=>{
    const txt = c.innerText.toLowerCase();
    c.style.display = txt.includes(q) ? '' : 'none';
  });
}

/* ============ UTIL ============ */
function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function setupDrop(dropEl, inputEl, onFiles){
  dropEl.addEventListener('click', ()=>inputEl.click());
  inputEl.addEventListener('change', e=>onFiles(e.target.files));
  ['dragenter','dragover'].forEach(ev=>dropEl.addEventListener(ev, e=>{e.preventDefault(); dropEl.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>dropEl.addEventListener(ev, e=>{e.preventDefault(); dropEl.classList.remove('drag');}));
  dropEl.addEventListener('drop', e=>{ if(e.dataTransfer.files.length) onFiles(e.dataTransfer.files); });
}

/* ================================================================
   PDF TOOLS
================================================================ */
let mergeFiles = [];
function handlePdfMergeFiles(fileList){
  mergeFiles = Array.from(fileList);
  const list = document.getElementById('pdfMergeList');
  list.innerHTML = mergeFiles.map(f=>`<div class="f"><span>${f.name}</span><span>${(f.size/1024).toFixed(0)} KB</span></div>`).join('');
  document.getElementById('pdfMergeBtn').disabled = mergeFiles.length < 2;
}
async function runPdfMerge(){
  const { PDFDocument } = PDFLib;
  const merged = await PDFDocument.create();
  for(const file of mergeFiles){
    const bytes = await file.arrayBuffer();
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach(p=>merged.addPage(p));
  }
  const outBytes = await merged.save();
  downloadBlob(new Blob([outBytes], {type:'application/pdf'}), 'merged.pdf');
  showResult('pdfMergeResult', `✅ Merged ${mergeFiles.length} files — your download has started.`);
}

let splitFile = null;
function handlePdfSplitFile(fileList){
  splitFile = fileList[0];
  document.getElementById('pdfSplitList').innerHTML = `<div class="f"><span>${splitFile.name}</span><span>${(splitFile.size/1024).toFixed(0)} KB</span></div>`;
  document.getElementById('pdfSplitBtn').disabled = false;
}
async function runPdfSplit(){
  const { PDFDocument } = PDFLib;
  const bytes = await splitFile.arrayBuffer();
  const src = await PDFDocument.load(bytes);
  const total = src.getPageCount();
  let from = Math.max(1, parseInt(document.getElementById('splitFrom').value||1));
  let to = Math.min(total, parseInt(document.getElementById('splitTo').value||total));
  if(from > to) [from,to] = [to,from];
  const out = await PDFDocument.create();
  const indices = [];
  for(let i=from-1;i<=to-1;i++) indices.push(i);
  const pages = await out.copyPages(src, indices);
  pages.forEach(p=>out.addPage(p));
  const outBytes = await out.save();
  downloadBlob(new Blob([outBytes], {type:'application/pdf'}), 'split.pdf');
  showResult('pdfSplitResult', `✅ Extracted pages ${from}–${to} of ${total} — your download has started.`);
}

let wmFile = null;
function handlePdfWmFile(fileList){
  wmFile = fileList[0];
  document.getElementById('pdfWmList').innerHTML = `<div class="f"><span>${wmFile.name}</span><span>${(wmFile.size/1024).toFixed(0)} KB</span></div>`;
  document.getElementById('pdfWmBtn').disabled = false;
}
async function runPdfWatermark(){
  const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;
  const bytes = await wmFile.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const text = document.getElementById('wmText').value || 'WATERMARK';
  doc.getPages().forEach(page=>{
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: width/2 - (text.length*7), y: height/2,
      size: 40, font, color: rgb(1,0.35,0.21), opacity:0.3, rotate: degrees(45)
    });
  });
  const outBytes = await doc.save();
  downloadBlob(new Blob([outBytes], {type:'application/pdf'}), 'watermarked.pdf');
  showResult('pdfWmResult', '✅ Watermark added — your download has started.');
}

/* ================================================================
   IMAGE TOOLS
================================================================ */
let compFile = null;
function handleImgCompFile(fileList){
  compFile = fileList[0];
  document.getElementById('imgCompBtn').disabled = false;
  document.getElementById('compStats').style.display = 'flex';
  document.getElementById('compBefore').textContent = (compFile.size/1024).toFixed(0)+' KB';
  document.getElementById('compAfter').textContent = '-';
}
async function runImgCompress(){
  const maxMB = parseFloat(document.getElementById('compMax').value) || 0.5;
  const options = { maxSizeMB: maxMB, maxWidthOrHeight: 1920, useWebWorker: true };
  const compressed = await imageCompression(compFile, options);
  document.getElementById('compAfter').textContent = (compressed.size/1024).toFixed(0)+' KB';
  downloadBlob(compressed, 'compressed-' + compFile.name);
  showResult('imgCompResult', '✅ Compressed — your download has started.');
}

let resizeFile = null, resizeImgEl = null;
function handleImgResizeFile(fileList){
  resizeFile = fileList[0];
  const img = new Image();
  img.onload = ()=>{
    resizeImgEl = img;
    document.getElementById('resizeW').value = img.width;
    document.getElementById('resizeH').value = img.height;
  };
  img.src = URL.createObjectURL(resizeFile);
  document.getElementById('imgResizeBtn').disabled = false;
}
function syncAspect(src){
  if(document.getElementById('keepAspect')?.checked && resizeImgEl){
    if(src === 'w'){
      document.getElementById('resizeH').value = Math.round(document.getElementById('resizeW').value * resizeImgEl.height / resizeImgEl.width);
    } else {
      document.getElementById('resizeW').value = Math.round(document.getElementById('resizeH').value * resizeImgEl.width / resizeImgEl.height);
    }
  }
}
async function runImgResize(){
  const w = parseInt(document.getElementById('resizeW').value);
  const h = parseInt(document.getElementById('resizeH').value);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(resizeImgEl, 0, 0, w, h);
  canvas.toBlob(blob=>{
    downloadBlob(blob, 'resized-' + resizeFile.name);
    showResult('imgResizeResult', `✅ Resized to ${w}×${h} — your download has started.`);
  }, resizeFile.type || 'image/png');
}

let convFile = null, convImgEl = null;
function handleImgConvFile(fileList){
  convFile = fileList[0];
  const img = new Image();
  img.onload = ()=>{ convImgEl = img; };
  img.src = URL.createObjectURL(convFile);
  document.getElementById('imgConvBtn').disabled = false;
}
async function runImgConvert(){
  const targetType = document.getElementById('convFormat').value;
  const canvas = document.createElement('canvas');
  canvas.width = convImgEl.width; canvas.height = convImgEl.height;
  canvas.getContext('2d').drawImage(convImgEl, 0, 0);
  canvas.toBlob(blob=>{
    const ext = targetType.split('/')[1];
    downloadBlob(blob, 'converted.' + ext);
    showResult('imgConvResult', `✅ Converted to ${ext.toUpperCase()} — your download has started.`);
  }, targetType, 0.92);
}

/* ================================================================
   TEXT TOOLS
================================================================ */
function updateWordCount(){
  const text = document.getElementById('wcText').value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const sentences = text.trim() ? (text.match(/[.!?]+/g) || []).length : 0;
  const readSec = Math.ceil(words / 3.5);
  document.getElementById('wcWords').textContent = words;
  document.getElementById('wcChars').textContent = chars;
  document.getElementById('wcSentences').textContent = sentences;
  document.getElementById('wcReadTime').textContent = readSec + 's';
}

function convCase(type){
  const el = document.getElementById('caseText');
  let t = el.value;
  if(type==='upper') t = t.toUpperCase();
  else if(type==='lower') t = t.toLowerCase();
  else if(type==='title') t = t.replace(/\w\S*/g, w=>w.charAt(0).toUpperCase()+w.substr(1).toLowerCase());
  else if(type==='sentence') t = t.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, c=>c.toUpperCase());
  el.value = t;
}

function runDiff(){
  const a = document.getElementById('diffA').value.split(/\s+/);
  const b = document.getElementById('diffB').value.split(/\s+/);
  const setA = new Set(a);
  const html = b.map(w => setA.has(w) ? w : `<mark style="background:var(--accent-soft); color:var(--accent); padding:1px 3px; border-radius:3px;">${w}</mark>`).join(' ');
  showResult('diffResult', '<b>Text B vs Text A</b> (highlighted = not found in A):<br><br>' + html, true);
}

/* ================================================================
   GENERATORS
================================================================ */
function genQR(){
  const val = document.getElementById('qrInput').value || 'https://example.com';
  const box = document.getElementById('qr-box');
  box.innerHTML = '';
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  new QRCode(box, { text: val, width:200, height:200, colorDark: isDark ? '#f1f1ee' : '#15161a', colorLight:'transparent' });
  document.getElementById('qrDownload').style.display = 'inline-flex';
}
function downloadQR(){
  const canvas = document.querySelector('#qr-box canvas');
  if(!canvas) return;
  canvas.toBlob(blob=>downloadBlob(blob, 'qrcode.png'));
}

function genPwd(){
  const len = parseInt(document.getElementById('pwdLen').value);
  document.getElementById('pwdLenVal').textContent = len;
  const sets = [];
  if(document.getElementById('pwdUpper').checked) sets.push('ABCDEFGHJKLMNPQRSTUVWXYZ');
  if(document.getElementById('pwdLower').checked) sets.push('abcdefghijkmnpqrstuvwxyz');
  if(document.getElementById('pwdNum').checked) sets.push('23456789');
  if(document.getElementById('pwdSym').checked) sets.push('!@#$%^&*()-_=+');
  const out = document.getElementById('pwdOut');
  if(sets.length===0){ out.textContent = 'Select at least one character set'; return; }
  const all = sets.join('');
  let pwd = '';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for(let i=0;i<len;i++) pwd += all[arr[i] % all.length];
  out.textContent = pwd;
}

/* ================================================================
   PDF COMPRESS
================================================================ */
let pdfCompFile = null;
function handlePdfCompFile(fileList){
  pdfCompFile = fileList[0];
  document.getElementById('pdfCompList').innerHTML = `<div class="f"><span>${pdfCompFile.name}</span><span>${(pdfCompFile.size/1024).toFixed(0)} KB</span></div>`;
  document.getElementById('pdfCompBtn').disabled = false;
  document.getElementById('pdfCompStats').style.display = 'flex';
  document.getElementById('pdfCompBefore').textContent = (pdfCompFile.size/1024).toFixed(0)+' KB';
  document.getElementById('pdfCompAfter').textContent = '-';
}
async function runPdfCompress(){
  const { PDFDocument } = PDFLib;
  const bytes = await pdfCompFile.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { updateMetadata:false });
  doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setProducer(''); doc.setCreator('');
  const outBytes = await doc.save({ useObjectStreams:true, addDefaultPage:false });
  const before = pdfCompFile.size, after = outBytes.byteLength;
  document.getElementById('pdfCompAfter').textContent = (after/1024).toFixed(0)+' KB';
  downloadBlob(new Blob([outBytes], {type:'application/pdf'}), 'compressed-' + pdfCompFile.name);
  const pct = before > after ? Math.round((1 - after/before)*100) : 0;
  const msg = pct > 0
    ? `✅ Compressed by ~${pct}% — your download has started.`
    : `✅ Done — your download has started. This PDF was already close to optimal, so the size barely changed.`;
  showResult('pdfCompResult', msg);
}

/* ================================================================
   IMAGE BACKGROUND REMOVER (real on-device AI segmentation)
================================================================ */
let bgFile = null, bgResultBlob = null;
function handleImgBgFile(fileList){
  bgFile = fileList[0];
  bgResultBlob = null;
  document.getElementById('imgBgBtn').disabled = false;
  document.getElementById('imgBgDownload').style.display = 'none';
  document.getElementById('bgPreviewWrap').style.display = 'none';
  showResult('imgBgResult', '');
  document.getElementById('imgBgResult').classList.remove('active');
}
async function runAiBgRemove(){
  if(!bgFile) return;
  if(!window.__aiRemoveBackground){
    showResult('imgBgResult', 'The AI engine is still loading — wait a moment and try again.');
    return;
  }
  const btn = document.getElementById('imgBgBtn');
  btn.disabled = true;
  const originalLabel = btn.textContent;
  showResult('imgBgResult', '⏳ Loading AI model (first time only)…');
  try {
    const blob = await window.__aiRemoveBackground(bgFile, {
      progress: (key, current, total) => {
        if(key && key.startsWith('fetch')){
          const pct = total ? Math.round((current/total)*100) : 0;
          btn.textContent = `Downloading model… ${pct}%`;
        } else {
          btn.textContent = 'Removing background…';
        }
      }
    });
    bgResultBlob = blob;
    const url = URL.createObjectURL(blob);
    document.getElementById('bgResultImg').src = url;
    document.getElementById('bgPreviewWrap').style.display = 'block';
    document.getElementById('imgBgDownload').style.display = 'inline-flex';
    showResult('imgBgResult', '✅ Background removed using on-device AI — preview above, ready to download.');
  } catch(err){
    console.error(err);
    showResult('imgBgResult', '⚠️ Something went wrong removing the background. Try a different image, or check your connection (the AI model needs to download once).');
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}
function downloadBgResult(){
  if(!bgResultBlob) return;
  downloadBlob(bgResultBlob, 'no-bg-' + (bgFile ? bgFile.name.replace(/\.[^.]+$/, '') : 'image') + '.png');
}

/* ================================================================
   TEXT PARAPHRASER
================================================================ */
const PARA_SYNONYMS = {
  "good":["great","fine","positive","solid"],"bad":["poor","negative","unpleasant","subpar"],
  "big":["large","sizable","substantial","considerable"],"small":["little","compact","minor","modest"],
  "important":["significant","essential","key","crucial"],"happy":["glad","pleased","content","cheerful"],
  "sad":["unhappy","down","upset","sorrowful"],"fast":["quick","rapid","swift","speedy"],
  "slow":["sluggish","unhurried","gradual","leisurely"],"easy":["simple","straightforward","effortless","uncomplicated"],
  "hard":["difficult","tough","challenging","demanding"],"help":["assist","aid","support","facilitate"],
  "use":["utilize","employ","apply","leverage"],"make":["create","produce","build","form"],
  "show":["demonstrate","display","reveal","illustrate"],"start":["begin","commence","initiate","launch"],
  "end":["finish","conclude","complete","wrap up"],"think":["believe","consider","feel","reckon"],
  "say":["state","mention","note","express"],"get":["obtain","acquire","gain","receive"],
  "many":["numerous","several","a number of","plenty of"],"very":["extremely","highly","really","quite"],
  "also":["additionally","furthermore","as well","too"],"because":["since","as","given that","due to"],
  "but":["however","yet","although","still"],"about":["regarding","concerning","around","roughly"],
  "improve":["enhance","upgrade","refine","strengthen"],"change":["alter","modify","adjust","revise"],
  "find":["locate","identify","discover","spot"],"want":["wish","desire","need","seek"],
  "problem":["issue","challenge","difficulty","obstacle"],"idea":["concept","notion","thought","proposal"],
  "plan":["strategy","scheme","approach","blueprint"],"result":["outcome","consequence","effect","finding"],
  "different":["distinct","varied","diverse","dissimilar"],"new":["fresh","novel","recent","modern"],
  "old":["aged","former","previous","outdated"],"quick":["fast","rapid","speedy","prompt"],
  "great":["excellent","outstanding","wonderful","superb"],"interesting":["engaging","fascinating","intriguing","compelling"],
  "look":["appear","seem","glance","observe"],"work":["function","operate","perform","labor"],
  "give":["provide","offer","supply","grant"],"keep":["retain","maintain","preserve","hold"],
  "build":["construct","develop","assemble","create"],"like":["enjoy","appreciate","favor","prefer"]
};
function paraphraseSentence(text, strength){
  const odds = strength === 1 ? 0.3 : strength === 2 ? 0.6 : 0.9;
  return text.replace(/[A-Za-z']+/g, (word)=>{
    const lower = word.toLowerCase();
    const list = PARA_SYNONYMS[lower];
    if(!list) return word;
    if(Math.random() > odds) return word;
    let repl = list[Math.floor(Math.random()*list.length)];
    if(word[0] === word[0].toUpperCase()){
      repl = repl.charAt(0).toUpperCase() + repl.slice(1);
    }
    return repl;
  });
}
function runParaphrase(){
  const input = document.getElementById('paraIn').value;
  if(!input.trim()){ showResult('paraResult', 'Type or paste a sentence above first.'); return; }
  const strength = parseInt(document.getElementById('paraStrength').value);
  const out = paraphraseSentence(input, strength);
  showResult('paraResult', out);
}

/* ================================================================
   DOCUMENTS: RESUME BUILDER
================================================================ */
let resumeExp = [], resumeEdu = [];
function uid(){ return 'id'+Math.random().toString(36).slice(2,9); }
function initResumeBuilder(){
  resumeExp = [
    { id: uid(), role:'Senior Product Designer', company:'Lumora Tech', dates:'2022 — Present', desc:'Led design for the core dashboard, improving task completion by 28%.' },
    { id: uid(), role:'Product Designer', company:'Nimbus Labs', dates:'2019 — 2022', desc:'Owned end-to-end design for onboarding and billing flows.' }
  ];
  resumeEdu = [
    { id: uid(), degree:'B.Des, Communication Design', school:'NID Ahmedabad', dates:'2015 — 2019' }
  ];
  renderExpInputs(); renderEduInputs(); renderResume();
}
function addExperience(){ resumeExp.push({ id: uid(), role:'', company:'', dates:'', desc:'' }); renderExpInputs(); renderResume(); }
function removeExperience(id){ resumeExp = resumeExp.filter(e=>e.id!==id); renderExpInputs(); renderResume(); }
function addEducation(){ resumeEdu.push({ id: uid(), degree:'', school:'', dates:'' }); renderEduInputs(); renderResume(); }
function removeEducation(id){ resumeEdu = resumeEdu.filter(e=>e.id!==id); renderEduInputs(); renderResume(); }

function renderExpInputs(){
  const wrap = document.getElementById('rExpList');
  wrap.innerHTML = resumeExp.map(e=>`
    <div class="repeat-block">
      <button type="button" class="rm" onclick="removeExperience('${e.id}')" aria-label="Remove">&times;</button>
      <div class="row">
        <div class="field" style="margin-top:0;"><label>Role</label><input type="text" value="${escAttr(e.role)}" oninput="updateExp('${e.id}','role',this.value)"></div>
        <div class="field" style="margin-top:0;"><label>Company</label><input type="text" value="${escAttr(e.company)}" oninput="updateExp('${e.id}','company',this.value)"></div>
      </div>
      <div class="field"><label>Dates</label><input type="text" value="${escAttr(e.dates)}" oninput="updateExp('${e.id}','dates',this.value)"></div>
      <div class="field"><label>Description</label><textarea style="min-height:60px;" oninput="updateExp('${e.id}','desc',this.value)">${escHtml(e.desc)}</textarea></div>
    </div>`).join('');
}
function renderEduInputs(){
  const wrap = document.getElementById('rEduList');
  wrap.innerHTML = resumeEdu.map(e=>`
    <div class="repeat-block">
      <button type="button" class="rm" onclick="removeEducation('${e.id}')" aria-label="Remove">&times;</button>
      <div class="field" style="margin-top:0;"><label>Degree</label><input type="text" value="${escAttr(e.degree)}" oninput="updateEdu('${e.id}','degree',this.value)"></div>
      <div class="row">
        <div class="field"><label>School</label><input type="text" value="${escAttr(e.school)}" oninput="updateEdu('${e.id}','school',this.value)"></div>
        <div class="field"><label>Dates</label><input type="text" value="${escAttr(e.dates)}" oninput="updateEdu('${e.id}','dates',this.value)"></div>
      </div>
    </div>`).join('');
}
function updateExp(id, key, val){ const e = resumeExp.find(x=>x.id===id); if(e){ e[key]=val; renderResume(); } }
function updateEdu(id, key, val){ const e = resumeEdu.find(x=>x.id===id); if(e){ e[key]=val; renderResume(); } }

function escHtml(s){ return (s||'').replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function escAttr(s){ return escHtml(s).replace(/"/g,'&quot;'); }

function renderResume(){
  const name = document.getElementById('rFullName').value;
  const title = document.getElementById('rTitle').value;
  const email = document.getElementById('rEmail').value;
  const phone = document.getElementById('rPhone').value;
  const location = document.getElementById('rLocation').value;
  const summary = document.getElementById('rSummary').value;
  const skills = document.getElementById('rSkills').value.split(',').map(s=>s.trim()).filter(Boolean);

  const expHtml = resumeExp.map(e=>`
    <div class="entry">
      <b>${escHtml(e.role)}${e.company ? ' — '+escHtml(e.company) : ''}</b>
      <span>${escHtml(e.dates)}</span>
      <p>${escHtml(e.desc)}</p>
    </div>`).join('');
  const eduHtml = resumeEdu.map(e=>`
    <div class="entry">
      <b>${escHtml(e.degree)}</b>
      <span>${escHtml(e.school)}${e.dates ? ' · '+escHtml(e.dates) : ''}</span>
    </div>`).join('');
  const skillsHtml = skills.map(s=>`<span class="skill-tag">${escHtml(s)}</span>`).join('');

  document.getElementById('resumePreview').innerHTML = `
    <h2>${escHtml(name) || 'Your Name'}</h2>
    <div class="role">${escHtml(title)}</div>
    <div class="meta">${[location, email, phone].filter(Boolean).map(escHtml).join(' · ')}</div>
    <p>${escHtml(summary)}</p>
    ${resumeExp.length ? `<h3>Experience</h3>${expHtml}` : ''}
    ${resumeEdu.length ? `<h3>Education</h3>${eduHtml}` : ''}
    ${skills.length ? `<h3>Skills</h3>${skillsHtml}` : ''}
  `;
}
function exportResumePdf(){
  const el = document.getElementById('resumePreview');
  const name = (document.getElementById('rFullName').value || 'resume').trim().replace(/\s+/g,'-').toLowerCase();
  html2pdf().set({
    margin: 10,
    filename: `${name}-resume.pdf`,
    html2canvas: { scale: 2, backgroundColor: '#ffffff' },
    jsPDF: { unit:'mm', format:'a4', orientation:'portrait' }
  }).from(el).save().then(()=>{
    showResult('resumeResult', '✅ Resume PDF downloaded.');
  });
}

/* ================================================================
   DOCUMENTS: INVOICE GENERATOR
================================================================ */
let invoiceItems = [];
function initInvoiceGenerator(){
  invoiceItems = [
    { id: uid(), desc:'UI design — homepage', qty:1, price:25000 },
    { id: uid(), desc:'Design system setup', qty:1, price:15000 }
  ];
  renderInvoiceItemInputs(); renderInvoice();
}
function addInvoiceItem(){ invoiceItems.push({ id: uid(), desc:'', qty:1, price:0 }); renderInvoiceItemInputs(); renderInvoice(); }
function removeInvoiceItem(id){ invoiceItems = invoiceItems.filter(i=>i.id!==id); renderInvoiceItemInputs(); renderInvoice(); }
function updateInvoiceItem(id, key, val){
  const it = invoiceItems.find(i=>i.id===id);
  if(!it) return;
  it[key] = (key==='qty'||key==='price') ? (parseFloat(val)||0) : val;
  renderInvoice();
}
function renderInvoiceItemInputs(){
  const wrap = document.getElementById('invItemList');
  wrap.innerHTML = invoiceItems.map(it=>`
    <div class="item-row">
      <div class="field" style="margin-top:0;"><label>Description</label><input type="text" value="${escAttr(it.desc)}" oninput="updateInvoiceItem('${it.id}','desc',this.value)"></div>
      <div class="field" style="margin-top:0;"><label>Qty</label><input type="number" min="0" step="1" value="${it.qty}" oninput="updateInvoiceItem('${it.id}','qty',this.value)"></div>
      <div class="field" style="margin-top:0;"><label>Price</label><input type="number" min="0" step="0.01" value="${it.price}" oninput="updateInvoiceItem('${it.id}','price',this.value)"></div>
      <button type="button" class="rm-item" onclick="removeInvoiceItem('${it.id}')" aria-label="Remove item">&times;</button>
    </div>`).join('');
}
function renderInvoice(){
  const from = document.getElementById('iFrom').value;
  const to = document.getElementById('iTo').value;
  const number = document.getElementById('iNumber').value;
  const date = document.getElementById('iDate').value;
  const taxRate = parseFloat(document.getElementById('iTax').value) || 0;

  const subtotal = invoiceItems.reduce((s,it)=>s + (it.qty*it.price), 0);
  const tax = subtotal * (taxRate/100);
  const total = subtotal + tax;

  const rowsHtml = invoiceItems.map(it=>`
    <tr>
      <td>${escHtml(it.desc) || '—'}</td>
      <td class="num">${it.qty}</td>
      <td class="num">${it.price.toFixed(2)}</td>
      <td class="num">${(it.qty*it.price).toFixed(2)}</td>
    </tr>`).join('');

  document.getElementById('invoicePreview').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
      <div>
        <div style="font-size:16px; font-weight:700; color:#111;">${escHtml(from) || 'Your Business'}</div>
        <div style="color:#777; margin-top:2px;">Invoice ${escHtml(number)}</div>
        <div style="color:#777;">${date ? new Date(date).toLocaleDateString() : ''}</div>
      </div>
      <div style="text-align:right;">
        <div style="color:#777; font-size:10.5px; text-transform:uppercase;">Bill to</div>
        <div style="font-weight:600; color:#111;">${escHtml(to) || 'Client Name'}</div>
      </div>
    </div>
    <table class="inv-table">
      <thead><tr><th>Description</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="4" style="color:#999;">No items yet</td></tr>'}</tbody>
    </table>
    <div class="inv-totals">
      <div><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
      <div><span>Tax (${taxRate}%)</span><span>${tax.toFixed(2)}</span></div>
      <div class="grand"><span>Total</span><span>${total.toFixed(2)}</span></div>
    </div>
  `;
}
function exportInvoicePdf(){
  const el = document.getElementById('invoicePreview');
  const number = (document.getElementById('iNumber').value || 'invoice').trim().replace(/\s+/g,'-').toLowerCase();
  html2pdf().set({
    margin: 10,
    filename: `${number}.pdf`,
    html2canvas: { scale: 2, backgroundColor: '#ffffff' },
    jsPDF: { unit:'mm', format:'a4', orientation:'portrait' }
  }).from(el).save().then(()=>{
    showResult('invoiceResult', '✅ Invoice PDF downloaded.');
  });
}

/* ============ shared result display ============ */
function showResult(id, html, isHtml){
  const r = document.getElementById(id);
  if(!r) return;
  r.classList.add('active');
  r.innerHTML = html;
}
