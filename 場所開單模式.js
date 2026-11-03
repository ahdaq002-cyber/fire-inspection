/* 場所狀態只存本機；法條仍使用主頁既有年度判斷。 */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), key='fire-inspection-places-v1';
  let db={version:1,active:null,places:[]}, timer, fade, restoring=false, storageBlocked=false;
  const style=document.createElement('style');
  style.textContent=`#save-toast{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:1000;background:#15352f;color:white;padding:12px 20px;border-radius:12px;box-shadow:0 4px 20px #0003;max-width:95vw}#place-list{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}.place-active{background:#176854!important;color:white!important}.equipment-panel{margin:14px 0;border:1px solid #d5e2d9;border-radius:12px;padding:12px}.equipment-panel summary{cursor:pointer;font-weight:800;padding:8px}.equipment-panel .inspection{border:0;padding:8px}.actual-defect{display:none;width:100%;padding:9px;margin-top:9px}.issue-row:has(input:checked) .actual-defect{display:block}#place-name{padding:11px;width:min(100%,430px);border:1px solid #adcabc;border-radius:10px}#place-manager .toolbar{margin-top:10px}`;
  document.head.append(style);
  const toast=document.createElement('div');toast.id='save-toast';toast.className='hidden';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');document.body.prepend(toast);
  const manager=document.createElement('section');manager.id='place-manager';manager.className='card';
  manager.innerHTML='<h2>我的檢查場所</h2><p class="hint">最多五間，資料只保存在這個瀏覽器。刪除場所後無法恢復。</p><div id="place-list"></div><label class="field-label" for="place-name">場所名稱</label><input id="place-name" maxlength="100" placeholder="輸入場所名稱"><div class="toolbar"><button id="add-place" class="primary">新增場所</button><button id="delete-place" class="secondary">刪除此場所</button><button id="save-now" class="secondary">立即暫存</button><span id="offline-state" class="note">本機檢查功能不需連線</span></div>';
  document.querySelector('main').prepend(manager);
  const yearCard=$('year').closest('section');
  document.querySelector('footer .wrap').textContent='場所與檢查資料僅保存在本機瀏覽器，不會上傳。清除網站資料、無痕模式或更換裝置可能無法恢復。法規來源連結需連線查閱。';
  const active=()=>db.places.find(p=>p.id===db.active);
  function status(message,failed=false){clearTimeout(fade);toast.textContent=message;toast.classList.remove('hidden');if(failed){const b=document.createElement('button');b.textContent='重試儲存';b.onclick=()=>save();toast.append(' ',b);}else if(message.startsWith('✓'))fade=setTimeout(()=>toast.classList.add('hidden'),3000);}
  function controls(panel){return [...panel.querySelectorAll('input,select,textarea')];}
  const changedPanels=new Set(['滅火器','室內栓','室外栓','撒水','泡沫','火自報','手報','廣播','避難器具']);
  function fieldKey(el){const row=el.closest('.issue-row'),cb=row?.querySelector('input[data-issue]');if(cb){const id=cb.dataset.issue+'|'+(cb.dataset.variant||'')+'|'+(cb.dataset.variantIndex||'');return 'issue:'+id+':'+(el===cb?'checked':'control-'+[...row.querySelectorAll('input,select,textarea')].indexOf(el));}return 'field:'+(el.id||el.name||'position-'+controls(el.closest('.equipment-panel')).indexOf(el));}
  function snapshot(){const p=active();if(!p||restoring)return;p.name=$('place-name').value;p.equipment=[...document.querySelectorAll('#equipment-grid input:checked')].map(e=>e.value);document.querySelectorAll('.equipment-panel').forEach(panel=>{const name=panel.dataset.key;if(Array.isArray(p.forms[name])){p.legacyForms??={};p.legacyForms[name]=p.forms[name];}p.forms[name]=Object.fromEntries(controls(panel).map(el=>[fieldKey(el),{value:el.value,checked:el.type==='checkbox'?el.checked:undefined}]));});}
  function write(){if(storageBlocked)return false;try{if(db.places.length)localStorage.setItem(key,JSON.stringify(db));else localStorage.removeItem(key);status('✓ 已儲存於本機　'+new Date().toLocaleTimeString('zh-TW'));return true;}catch(e){status('⚠ 儲存失敗，請立即重試',true);return false;}}
  function save(){clearTimeout(timer);snapshot();return write();}
  function queue(){if(restoring||!active())return;status('⏳ 自動儲存中…');clearTimeout(timer);timer=setTimeout(save,650);}
  function invalidate(){$('result').textContent='';$('result-section').classList.add('hidden');}
  function cards(){const list=$('place-list');list.replaceChildren();db.places.forEach(p=>{const b=document.createElement('button');b.className='secondary'+(p.id===db.active?' place-active':'');b.textContent=(p.name||'未命名場所')+' · '+p.year+'年';b.onclick=()=>{save();db.active=p.id;load();write();};list.append(b);});$('add-place').disabled=db.places.length>=5||storageBlocked;$('delete-place').disabled=!active();}
  const renderers={'滅火器':renderExtinguisher,'室內栓':renderHydrant,'室外栓':renderOutdoor,'撒水':renderSprinkler,'泡沫':renderFoam,'火自報':renderFireAlarm,'手報':renderManualAlarm,'廣播':renderBroadcast,'避難器具':renderEvacuation,'連結送水管':renderLinkedStandpipe,'排煙':renderSmoke,'標示':renderSignage,'照明':renderLighting,'緊急發電機':renderGenerator};
  function legacyLabels(name,year){
    const grouped=(items,article,label)=>{const groups=new Map();items.forEach(item=>{const key=article(item)||'single-'+label(item);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(label(item));});return [...groups.values()].map(labels=>labels.join('、'));};
    if(name==='滅火器')return grouped(extinguisherIssues,i=>i.article?.(year),i=>i.label);
    if(name==='室內栓')return grouped(hydrantChoices(year),i=>i.articleNumber,i=>i.label);
    if(name==='室外栓')return grouped(outdoorIssues.filter(i=>!(i.only78&&year!=='78')&&!(i.from85&&year==='78')&&!(i.from93&&Number(year)<93)),i=>i.article(year),i=>typeof i.label==='function'?i.label(year):i.label);
    if(name==='撒水')return grouped(sprinklerEntries(year),i=>i.article,i=>i.label);
    if(name==='泡沫')return foamChoices(year).map(i=>i.label);
    if(name==='火自報')return ['抽查符合',...(year==='78'?fireAlarm78Issues:fireAlarmModernIssues(year)).map(i=>i.label),'其他'];
    if(name==='手報')return ['抽查符合',...manualAlarmIssues(year).map(i=>i.label),'其他'];
    if(name==='廣播')return ['抽查符合',...(year==='78'?broadcast78Issues:broadcastIssues(year)).map(i=>i.label),'其他'];
    if(name==='避難器具')return ['抽查符合',...(year==='78'?evacuation78Issues:evacuationModernIssues(year)).map(i=>i.label),'其他'];
    return [];
  }
  function render(){const p=active();$('inspections').replaceChildren();if(!p)return;
    p.equipment.forEach(name=>{const panel=document.createElement('details');panel.className='equipment-panel';panel.dataset.key=name;const summary=document.createElement('summary');summary.textContent=name;panel.append(summary);const body=document.createElement('div');body.innerHTML=renderers[name]?renderers[name](p.year):renderHistoricalEquipment(name,p.year);if(historicalIssues(name,p.year).length&&p.forms[name]){
        const old=p.forms[name];
        if(Array.isArray(old)){p.legacyForms??={};p.legacyForms[name]=old;delete p.forms[name];}
        else if(Object.keys(old).some(k=>k.startsWith('issue:manual|'))){
          const temp=document.createElement('div');temp.innerHTML=renderUnverified(name);
          body.querySelector('.issue-grid').append(temp.querySelector('.issue-row'));
        }
      }panel.append(body);
      body.querySelectorAll('.issue-row').forEach(row=>{const cb=row.querySelector('input[type=checkbox]');if(row.querySelector('[data-fact-required]'))return;if(!cb||cb.dataset.issue==='pass')return;const fact=row.querySelector('.foam-fact')||row.querySelector('.detail');if(fact){fact.placeholder='必填現場紀錄：例如 B棟17樓、2只、測試結果';fact.setAttribute('aria-label','現場紀錄');}
        const label=row.querySelector('.issue-label')?.textContent||'';
        if(fact&&cb.dataset.issue!=='manual'&&!(['標示','照明','緊急發電機'].includes(name)&&['85','93','102','107','110','113'].includes(p.year)))fact.placeholder='選填：缺失點，例如 B棟17樓';
        if(cb.dataset.groupArticle||cb.dataset.issue==='other'||cb.dataset.issue==='manual'){const input=document.createElement('input');input.className='actual-defect';input.placeholder='必填：本次實際缺失';input.setAttribute('aria-label','本次實際缺失');input.maxLength=350;row.append(input);}
      });
      let saved=p.forms[name];
      if(Array.isArray(saved)&&changedPanels.has(name)){p.legacyForms??={};p.legacyForms[name]=saved;delete p.forms[name];saved=null;}
      if(Array.isArray(saved))controls(panel).forEach((el,i)=>{if(!saved[i])return;el.value=saved[i].value;if(el.type==='checkbox')el.checked=!!saved[i].checked;});
      else if(saved)controls(panel).forEach(el=>{const value=saved[fieldKey(el)];if(!value)return;el.value=value.value;if(el.type==='checkbox')el.checked=!!value.checked;});
      if(p.legacyForms?.[name]){const notice=document.createElement('details');notice.className='followup-field';const old=p.legacyForms[name],labels=legacyLabels(name,p.year);notice.innerHTML='<summary>舊版合併選項紀錄（請核對後重新勾選）</summary><p class="note">舊版資料仍保存在本機。為避免將合併項錯套到拆分後的單項，本區不自動產生違規事實。</p>';const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';let rowIndex=-1;pre.textContent=old.map((entry,i)=>{if(typeof entry.checked==='boolean'){rowIndex++;return entry.checked?'已勾選：'+(labels[rowIndex]||'舊版第'+(rowIndex+1)+'項'):'';}return entry.value&&entry.value.trim()?`原紀錄欄位 ${i+1}：${entry.value}`:'';}).filter(Boolean).join('\n')||'無已勾選項或文字';notice.append(pre);body.prepend(notice);}
      panel.addEventListener('toggle',()=>{if(panel.open)document.querySelectorAll('.equipment-panel').forEach(other=>{if(other!==panel)other.open=false;});});$('inspections').append(panel);
    });counts();$('issues-section').classList.toggle('hidden',!p.equipment.length);invalidate();
  }
  function counts(){document.querySelectorAll('.equipment-panel').forEach(panel=>{const n=panel.querySelectorAll('input[data-issue]:checked:not([data-issue="pass"])').length;panel.querySelector('summary').textContent=panel.dataset.key+'　已選 '+n+' 項缺失';});}
  function load(){restoring=true;const p=active();$('place-name').value=p?.name||'';$('year').value=p?.year||'';$('year').disabled=!!p;$('year-date').textContent=currentVersion()?.date||'';$('next').classList.add('hidden');yearCard.classList.remove('hidden');document.querySelectorAll('#equipment-grid input').forEach(e=>e.checked=!!p?.equipment.includes(e.value));$('equipment-section').classList.toggle('hidden',!p);$('inspect').classList.add('hidden');$('equipment-count').textContent='已選 '+(p?.equipment.length||0)+' 項';render();cards();restoring=false;}
  function confirmRemoval(hasText,description){if(hasText&&!confirm('你正在取消'+description+'，其中已有現場紀錄。按確認繼續。'))return false;return confirm('是否刪除此項勾選？'+description+'將不列入違規事實。'+(hasText?'現場紀錄仍保留，重新選取可恢復。':''));}
  $('add-place').onclick=()=>{if(db.places.length>=5)return;if(active()){save();db.active=null;load();$('place-name').focus();return;}const name=$('place-name').value.trim(),year=$('year').value;if(!name||!year){alert('請先填場所名稱並選擇設置標準年度。');return;}const p={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name,year,equipment:[],forms:{}};db.places.push(p);db.active=p.id;load();write();};
  $('delete-place').onclick=()=>{const p=active();if(!p||!confirm('確定刪除「'+p.name+'」？全部本地紀錄都會清除，刪除後無法恢復。'))return;clearTimeout(timer);const previous=JSON.parse(JSON.stringify(db));db.places=db.places.filter(x=>x.id!==p.id);db.active=db.places[0]?.id||null;if(!write()){db=previous;alert('刪除未能儲存，原紀錄仍保留。');}load();};
  $('save-now').onclick=save;
  $('place-name').addEventListener('input',()=>{queue();if(active()){active().name=$('place-name').value;cards();}});
  $('equipment-grid').addEventListener('change',event=>{if(!active())return;event.stopImmediatePropagation();const input=event.target;if(input.type!=='checkbox')return;const panel=[...document.querySelectorAll('.equipment-panel')].find(p=>p.dataset.key===input.value);if(!input.checked){const hasText=panel&&controls(panel).some(el=>el.type!=='checkbox'&&el.tagName!=='SELECT'&&el.value.trim());if(!confirmRemoval(hasText,'設備「'+input.value+'」')){input.checked=true;return;}}snapshot();render();$('equipment-count').textContent='已選 '+active().equipment.length+' 項';queue();},true);
  $('inspections').addEventListener('change',event=>{const input=event.target;if(input.type==='checkbox'&&!input.checked){const row=input.closest('.issue-row');const text=[...row.querySelectorAll('input:not([type=checkbox]),textarea')].some(el=>el.value.trim());if(!confirmRemoval(text,'這項缺失')){input.checked=true;event.stopImmediatePropagation();return;}}if(input.dataset.issue==='pass'&&input.checked){const others=[...input.closest('.inspection').querySelectorAll('input[type=checkbox]:checked')].filter(e=>e!==input);if(others.length){input.checked=false;event.stopImmediatePropagation();alert('請先逐項取消缺失，再選擇抽查符合。');return;}}invalidate();},true);
  ['input','change'].forEach(type=>$('inspections').addEventListener(type,()=>{counts();queue();}));
  $('generate').addEventListener('click',()=>{save();},true);
  window.addEventListener('pagehide',()=>{if(active())save();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&active())save();});
  window.addEventListener('storage',event=>{if(event.key===key){storageBlocked=true;clearTimeout(timer);status('⚠ 另一分頁已變更資料，請重新整理後繼續。');document.querySelectorAll('main input,main button,main select,main textarea').forEach(e=>e.disabled=true);}});
  window.placeFormatLine=(text,row)=>{
    if(!row)return text;const colon=text.indexOf('：'),name=text.slice(0,colon),detail=(row.querySelector('.foam-fact')||row.querySelector('.detail')).value.trim();
    if(row.dataset.textOnly)return text;
    let body=text.slice(colon+1), reference='條號待查核';
    const match=body.match(/，(第\d+(?:-\d+)?條.*)$/)||body.match(/(§\d+(?:-\d+)?.*)$/);if(match){reference=match[1].replace(/第(\d+(?:-\d+)?)條/g,'§$1');body=body.slice(0,match.index);}else if(body.endsWith('（條號待查核）'))body=body.slice(0,-7);
    body=body.split('（'+detail+'）').join('');
    const custom=row.querySelector('.actual-defect')?.value.trim();
    if(custom)body=custom;else if(body===detail||!body){const label=row.querySelector('.issue-label span')?.cloneNode(true);label?.querySelectorAll('.article').forEach(e=>e.remove());body=label?.textContent.trim()||'缺失待確認';}
    return name+'：'+body+'('+reference+')'+(detail?'，('+detail+')':'');
  };
  window.placeGroupLines=lines=>{const groups=new Map();lines.forEach(line=>{const i=line.indexOf('：'),name=line.slice(0,i);if(!groups.has(name))groups.set(name,[]);groups.get(name).push(line.slice(i+1));});const digit=['','一','二','三','四','五','六','七','八','九'];const numeral=n=>n<10?digit[n]:n<20?'十'+digit[n%10]:n<100?digit[Math.floor(n/10)]+'十'+digit[n%10]:String(n);return [...groups].map(([name,rows],i)=>numeral(i+1)+'、'+name+'：'+rows.join('\n'+'　'.repeat(name.length+3))).join('\n');};
  try{const raw=localStorage.getItem(key);if(raw){const parsed=JSON.parse(raw);if(parsed.version!==1||!Array.isArray(parsed.places)||parsed.places.length>5||!parsed.places.every(p=>typeof p.id==='string'&&typeof p.name==='string'&&versions.some(v=>v.year===p.year)&&Array.isArray(p.equipment)&&p.equipment.every(n=>equipment.includes(n))&&p.forms&&typeof p.forms==='object'))throw Error('invalid');db=parsed;if(!active())db.active=db.places[0]?.id||null;}}catch(e){storageBlocked=true;status('⚠ 無法讀取本機資料，已停止覆寫。請保留目前瀏覽器資料並聯絡協助。');}
  load();if(storageBlocked)document.querySelectorAll('main input,main button,main select').forEach(e=>e.disabled=true);
  if(window.isSecureContext&&location.protocol!=='file:'&&'serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('offline-state').textContent='✓ 離線可用（法規來源連結仍需網路）';}).catch(()=>{$('offline-state').textContent='離線快取未完成，請保持連線後重新開啟。';});}
})();
