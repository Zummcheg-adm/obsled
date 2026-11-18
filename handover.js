'use strict';

// Сдача — отдельная запись в хранилище обследований. Снимки бригады хранятся в исходном виде.
const Delivery = (() => {
  const kinds = {air: 'Опора', kan: 'Колодец'};
  const groupSlots = {air: ['Общий вид', 'Крепление'], kan: ['Люк и номер', 'Кабель и каналы'], cable: ['Начальная метка', 'Конечная метка']};
  const button = (action, label, data = '', style = '') => `<button type="button" class="btn ${style}" data-a="delivery-${action}" ${data}>${esc(label)}</button>`;
  const attrId = id => `data-id="${esc(id)}"`;
  const option = (id, name, active) => `<option value="${esc(id)}"${active === id ? ' selected' : ''}>${esc(name)}</option>`;
  const input = (k, label, value = '', attrs = '') => `<label>${esc(label)}<input name="${k}" value="${esc(value)}" ${attrs}></label>`;
  const sel = (k, label, opts) => `<label>${esc(label)}<select name="${k}">${opts}</select></label>`;
  const data = () => S.survey.delivery;
  const labelOf = (d, id) => d.nodes.find(n => n.id === id)?.name || '—';
  const length = c => c.start == null || c.end == null ? null : Math.abs(c.end - c.start);
  const measure = v => v == null ? '—' : v.toLocaleString('ru-RU', {maximumFractionDigits: 3}) + ' м';
  function row(action, id, title, sub) {
    return `<button type="button" class="it" data-a="delivery-${action}" ${attrId(id)}><span class="tx"><span class="t1">${esc(title)}</span><br><span class="t2">${esc(sub)}</span></span><span aria-hidden="true">›</span></button>`;
  }
  function home(reports) {
    if (!reports.length) return '';
    return '<h2>Сдача объектов</h2><div class="delivery-list">' + reports.map(s => row('open', s.id, s.name, `${fmtD(s.upd)} · точек ${s.delivery.nodes.length}`)).join('') + '</div>';
  }
  function checklist(d) {
    const issues = [];
    if (!d.nodes.length) issues.push('Добавьте точки фактической трассы');
    if (d.nodes.length > 1 && !d.nodes.some(n => n.prev)) issues.push('Между точками не указан ни один пролёт или прогон');
    for (const n of d.nodes) {
      const pair = `${labelOf(d, n.prev)} → ${n.name}`;
      if (n.prev && n.m == null) issues.push(`${pair} — нет замера`);
      if (n.prev && n.kind === 'kan' && (!n.channel || !n.channels)) issues.push(`${pair} — уточнить канал и число каналов`);
      for (const slot of groupSlots[n.kind]) if (!n.photos.some(f => f.slot === slot)) issues.push(`${n.name} — нет фото «${slot}»`);
    }
    if (!d.cables.length) issues.push('Добавьте отрезок кабеля и его метровые метки');
    for (const c of d.cables) {
      const pair = `${labelOf(d, c.from)} → ${labelOf(d, c.to)}`;
      if (c.start == null || c.end == null) issues.push(`${pair} — нужны обе метровые метки`);
      else if (c.start === c.end) issues.push(`${pair} — начальная и конечная метки совпали`);
      for (const slot of groupSlots.cable) if (!c.photos.some(f => f.slot === slot)) issues.push(`${pair} — нет фото «${slot}»`);
    }
    return issues;
  }
  function overview() {
    const d = data(), unused = remaining(d), issues = checklist(d);
    const nodes = d.nodes.map(n => row('node', n.id, n.name, (n.prev ? `От ${labelOf(d, n.prev)} · ${measure(n.m)}` : 'Начало участка') + ` · фото ${n.photos.length}`)).join('');
    const cables = d.cables.map(c => row('cable', c.id, `${labelOf(d,c.from)} → ${labelOf(d,c.to)}`, `${c.brand || 'Кабель'} · по меткам ${measure(length(c))}`)).join('');
    return hdr(S.survey.name, true, '', false) + `<main class="delivery-list"><h2>Сдача объекта</h2>
      <div class="card small">${d.source ? 'По обследованию «' + esc(d.source) + '»' : 'По фактической трассе'} · ${fmtD(S.survey.cr)}</div>
      <h2>Фактическая трасса</h2>${nodes}<div class="grid">
      ${unused.length ? button('plan', 'Выбрать точку обследования (' + unused.length + ')') : ''}
      <div class="row">${button('new-node','+ Опора','data-kind="air"')}${button('new-node','+ Колодец','data-kind="kan"')}</div></div>
      <h2>Отрезки кабеля</h2>${cables}${button('new-cable','+ Отрезок кабеля',d.nodes.length < 2 ? 'disabled title="Сначала добавьте две точки"' : '')}
      <h2>Итоговый отчёт</h2>${issues.length ? '<details class="card"><summary>Что осталось заполнить ('+issues.length+')</summary><ul>'+issues.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul></details>' : '<div class="card">Замеры, метки и фотографии заполнены</div>'}
      ${S.zip ? '<div class="card small">'+esc(S.zip.name)+' · '+fmtMB(S.zip.blob.size)+'</div><div class="row"><button class="btn pri" data-a="share">Отправить архив</button><button class="btn" data-a="save">Сохранить ZIP</button></div>' : button('export','Собрать один архив','','pri big')}
      <p>${button('delete','Удалить эту сдачу',attrId(S.sid),'red big')}</p></main>`;
  }
  const remaining = d => d.plan.filter(p => !d.nodes.some(n => n.planId === p.id));
  function planFrom(o) {
    if (o?.app !== 'rnd-obsled' || !o.survey?.name || !Array.isArray(o.points)) throw Error('Нужен ZIP обследования или файл obsledovanie.json из него');
    const plan = [];
    for (const p of o.points) {
      if (p.excluded === true) continue;
      const kind = p.type === 'kolodec' || p.line === 'канализация' ? 'kan' : ['opora','nov','kv','trub','bs'].includes(p.type) || p.line === 'подвес' ? 'air' : null;
      if (!kind) continue;
      const coord = p.positionStatus !== 'unconfirmed' && Number.isFinite(p.poleLat) && Number.isFinite(p.poleLon) ? {lat:p.poleLat, lon:p.poleLon, source:'обследование'} : null;
      const tag = String(p.fields?.nom || p.fields?.tab || '').trim();
      plan.push({id:uid(), code:String(p.code || ''), name:`${p.typeName || kinds[kind]} ${p.code || p.n || plan.length+1}${tag ? ' · '+tag : ''}`, kind, coord});
    }
    return {source:String(o.survey.name), plan};
  }
  async function readSurvey(file) {
    if (/\.json$/i.test(file.name)) return JSON.parse(await file.text());
    // В штатном ZIP программы JSON записан без сжатия с размерами в локальном заголовке.
    let at = 0;
    while (at + 30 <= file.size) {
      const h = new DataView(await file.slice(at, at+30).arrayBuffer());
      if (h.getUint32(0,true) !== 0x04034b50 || (h.getUint16(6,true) & 9)) break;
      const size = h.getUint32(18,true), names = h.getUint16(26,true);
      const name = await file.slice(at+30,at+30+names).text();
      const start = at+30+names+h.getUint16(28,true);
      if (start+size > file.size) break;
      if (name === 'obsledovanie.json' && !h.getUint16(8,true)) {
        const bytes = new Uint8Array(await file.slice(start,start+size).arrayBuffer());
        if (crc32(bytes) !== h.getUint32(14,true)) throw Error('Файл обследования повреждён');
        return JSON.parse(new TextDecoder().decode(bytes));
      }
      at = start+size;
    }
    throw Error('Выберите исходный ZIP из программы или извлечённый obsledovanie.json');
  }
  async function create(source = '', plan = []) {
    closeSheet();
    const name = prompt('Название объекта для сдачи', source);
    if (!name?.trim()) return;
    const now = Date.now(), s = {id:uid(), name:name.trim(), cr:now, upd:now, delivery:{revision:0, source, plan, nodes:[], cables:[]}};
    await DB.put('surveys',s);
    await openSurvey(s.id);
  }
  async function fromPhone(id) {
    await flushSave();
    const s = await DB.get('surveys',id);
    if (!s || s.delivery) throw Error('Обследование не найдено');
    const pts = (await DB.by('points','survey',id)).sort((a,b)=>a.n-b.n);
    const {source,plan} = planFrom({app:'rnd-obsled',survey:s,points:pts.map(p=>{
      const q = pos(p,pts);
      return {code:code(p),type:p.type,typeName:TT(p).name,line:GRP_NAME[grp(p)],fields:p.f,excluded:p.excluded,poleLat:q?.lat,poleLon:q?.lon};
    })});
    await create(source,plan);
  }
  async function startMenu() {
    const sv = (await DB.all('surveys')).filter(s=>!s.delivery).sort((a,b)=>b.upd-a.upd);
    sheet(`<h3>Начать сдачу объекта</h3><div class="grid">${button('blank','С нуля','','pri')}<label class="btn" for="inDelivery">Из архива обследования</label></div>`+
      (sv.length ? '<h2>Обследования на телефоне</h2><div class="delivery-list">'+sv.map(s=>row('source',s.id,s.name,fmtD(s.upd))).join('')+'</div>' : ''));
  }
  function photosForm(record, kind) {
    return groupSlots[kind].map((slot,i)=>{
      const old = (record?.photos || []).filter(f=>f.slot === slot);
      return `<fieldset><legend>${esc(slot)}</legend><label>Снять фото<input type="file" name="camera${i}" accept="image/*" capture="environment"></label><label>Из галереи<input type="file" name="photo${i}" accept="image/*,.heic,.heif" multiple></label></fieldset>`+
        old.map(f=>`<label class="small delivery-files"><input type="checkbox" style="display:inline;width:auto" name="remove" value="${esc(f.id)}"> Убрать ${esc(f.original)}</label>`).join('');
    }).join('');
  }
  function mount(title, html, onSave) {
    sheet(`<h3>${esc(title)}</h3><form class="delivery-form">${html}<div class="row"><button class="btn pri" type="submit">Сохранить</button>${button('cancel','Отмена')}</div></form>`);
    const form = $('#sheet form');
    form.onsubmit = async e=>{
      e.preventDefault();
      const btn = form.querySelector('[type=submit]');
      if (btn.disabled) return;
      btn.disabled = true;
      try { await onSave(form); closeSheet(); rr(); }
      catch (err) { toast(errMsg(err),6500); }
      finally { btn.disabled = false; }
    };
    return form;
  }
  function number(form,k) {
    const v = form.elements[k].value.trim().replace(',','.');
    if (!v) return null;
    if (!/^\d+(\.\d{1,3})?$/.test(v) || !Number.isSafeInteger(Math.round(Number(v)*1000))) throw Error('Введите число в метрах, например 32,5');
    return Number(v);
  }
  const metric = 'inputmode="decimal"';
  const integer = 'inputmode="numeric" pattern="[0-9]+"';
  function fileChanges(form,record,kind) {
    const removed = Array.from(form.querySelectorAll('input[name=remove]:checked'),el=>el.value);
    const photos = (record?.photos || []).filter(f=>!removed.includes(f.id)), added = [];
    groupSlots[kind].forEach((slot,i)=>{
      for (const f of [...form.elements['camera'+i].files, ...form.elements['photo'+i].files]) {
        if (!f.size) throw Error('Пустой файл фотографии');
        const id = uid(), ext = f.name.match(/\.(jpe?g|png|heic|heif|webp|gif|avif|bmp|tiff?)$/i)?.[1]?.toLowerCase() || 'img';
        photos.push({id,slot,original:f.name,mime:f.type,file:`foto/${record.id}_${id}.${ext}`});
        added.push({id, survey:S.sid, point:record.id, data:f});
      }
    });
    return {photos,added,removed};
  }
  // Форма и её вложения фиксируются одной транзакцией. Проверка версии защищает черновик при двух открытых вкладках.
  async function commit(sid,revision,group,record,changes) {
    if (S.sid !== sid) throw Error('Объект изменился. Откройте карточку заново');
    const s = await new Promise((resolve,reject)=>{
      const tx = DB.d.transaction(['surveys','files'],'readwrite'), surveys = tx.objectStore('surveys'), files = tx.objectStore('files');
      const req = surveys.get(sid);
      let current, conflict = false;
      req.onsuccess = ()=>{
        current = req.result;
        if (current?.delivery?.revision !== revision) { conflict = true; tx.abort(); return; }
        const list = current.delivery[group], i = list.findIndex(v=>v.id===record.id);
        if (i === -1) list.push(record); else list[i] = record;
        changes.added.forEach(f=>files.put(f));
        changes.removed.forEach(id=>files.delete(id));
        current.delivery.revision++; current.upd = Date.now(); surveys.put(current);
      };
      tx.oncomplete = ()=>resolve(current);
      tx.onabort = ()=>reject(conflict ? Error('Сдачу уже изменили. Закройте форму и откройте объект снова') : tx.error || Error('Не удалось сохранить запись'));
    });
    if (S.sid === sid) { S.survey = s; S.zip = null; }
  }
  function nodeForm(kind, existing, plan) {
    const d = data(), sid = S.sid, revision = d.revision;
    const prevNodes = existing ? d.nodes.slice(0,d.nodes.indexOf(existing)) : d.nodes;
    const last = prevNodes.at(-1);
    const n = existing || {id:uid(), kind, name:plan?.name || '', planId:plan?.id || null, prev:last?.kind===kind ? last.id : '', coord:plan?.coord || null, photos:[]};
    let coord = n.coord;
    const opts = option('','Начало отдельного участка',n.prev)+prevNodes.filter(p=>p.kind===kind).map(p=>option(p.id,p.name,n.prev)).join('');
    const fields = input('name',kind==='air'?'Номер или название опоры':'Номер или название колодца',n.name,'required maxlength="120"')+
      sel('prev','Откуда проложен кабель',opts)+`<div id="run">`+
      input('metres',kind==='air'?'Замер между опорами, м':'Замер от колодца до колодца, м',n.m,metric)+
      (kind==='kan'?'<div class="row">'+input('channel','Канал №',n.channel,integer)+input('channels','Всего каналов',n.channels,integer)+'</div>':'')+'</div>'+
      button('gps','Записать GPS здесь')+'<p class="small mut" id="deliveryCoord"></p>'+
      input('note','Что изменилось / примечание',n.note)+photosForm(n,kind);
    const form = mount(existing ? n.name : kinds[kind],fields,async f=>{
      const e = f.elements, prev = e.prev.value, name = e.name.value.trim();
      if (!name) throw Error('Укажите название точки');
      const m = prev ? number(f,'metres') : null;
      if (m===0) throw Error('Замер должен быть больше нуля');
      const channel = prev && kind==='kan' ? number(f,'channel') : null, channels = prev && kind==='kan' ? number(f,'channels') : null;
      if (channel===0 || channels===0 || (channel && channels && channel>channels)) throw Error('Проверьте номер и общее число каналов');
      const changes = fileChanges(f,n,kind);
      await commit(sid,revision,'nodes',{...n,name,prev,m,channel,channels,coord,note:e.note.value.trim(),photos:changes.photos},changes);
    });
    const updateRun = ()=>{form.querySelector('#run').hidden = !form.elements.prev.value;};
    form.elements.prev.onchange = ()=>{ for(const key of ['metres','channel','channels']) if(form.elements[key]) form.elements[key].value=''; updateRun(); };
    updateRun();
    const display = ()=>{form.querySelector('#deliveryCoord').textContent = coord ? `${coord.source} · ${coord.lat.toFixed(6)}, ${coord.lon.toFixed(6)}${Number.isFinite(coord.acc)?' · ±'+Math.round(coord.acc)+' м':''}` : 'Координаты ещё не записаны';};
    display();
    form.querySelector('[data-a=delivery-gps]').onclick = e=>{
      const btn = e.currentTarget;
      if (!navigator.geolocation) { toast('GPS недоступен'); return; }
      btn.disabled = true; btn.textContent = 'Определяю координаты…';
      const reset = ()=>{btn.disabled=false;btn.textContent='Записать GPS здесь';};
      navigator.geolocation.getCurrentPosition(p=>{reset();coord={lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy,source:'GPS бригады'};display();},
        err=>{reset();toast('GPS: '+err.message,5000);},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
    };
  }
  function cableForm(existing) {
    const d = data(), sid = S.sid, revision = d.revision;
    if (d.nodes.length<2) return;
    const c = existing || {id:uid(),from:d.nodes[0].id,to:d.nodes.at(-1).id,photos:[]};
    const opts = id=>d.nodes.map(n=>option(n.id,n.name,id)).join('');
    const form = mount('Отрезок кабеля',sel('from','Начало отрезка',opts(c.from))+sel('to','Конец отрезка',opts(c.to))+
      input('brand','Марка кабеля / барабан',c.brand)+input('start','Метровая метка начала',c.start,integer)+input('end','Метровая метка конца',c.end,integer)+
      '<p id="deliveryLength" class="small"></p>'+input('note','Примечание',c.note)+photosForm(c,'cable'),async f=>{
      const e=f.elements, from=e.from.value, to=e.to.value;
      if(from===to) throw Error('Выберите две разные точки');
      const changes=fileChanges(f,c,'cable');
      await commit(sid,revision,'cables',{...c,from,to,start:number(f,'start'),end:number(f,'end'),brand:e.brand.value.trim(),note:e.note.value.trim(),photos:changes.photos},changes);
    });
    const display=()=>{const a=form.elements.start.value,b=form.elements.end.value;
      form.querySelector('#deliveryLength').textContent='По меткам: '+measure(/^\d+$/.test(a)&&/^\d+$/.test(b)?Math.abs(Number(a)-Number(b)):null);};
    form.oninput=display; display();
  }
  const htmlCell = x=>`<td>${esc(x ?? '—')}</td>`;
  function table(head,rows) {
    return '<table><thead><tr>'+head.map(s=>'<th>'+esc(s)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(cells=>'<tr>'+cells.join('')+'</tr>').join('')+'</tbody></table>';
  }
  const pics = r => '<td>'+r.photos.map(f=>`<a href="${esc(f.file)}">${esc(f.slot)} · ${esc(f.original)}</a>`).join('<br>')+'</td>';
  function reportHTML(o) {
    const d = o.delivery;
    const nodes = table(['Точка','Координаты и источник','Примечание','Фотографии'],d.nodes.map(n=>{
      const gps=n.coord;
      return [htmlCell(n.name),htmlCell(gps ? `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)} (${gps.source})` : null),htmlCell(n.note),pics(n)];
    }));
    const spans=table(['Способ','Откуда','Куда','Замер бригады','Канал № / всего'],d.nodes.filter(n=>n.prev).map(n=>[
      n.kind==='kan'?'Канализация':'Подвес',labelOf(d,n.prev),n.name,measure(n.m),n.kind==='kan'?`${n.channel??'—'}/${n.channels??'—'}`:'—'].map(htmlCell)));
    const cables=table(['Откуда → куда','Марка / барабан','Метка начала','Метка конца','По меткам','Примечание','Фотографии'],d.cables.map(c=>[
      ...[labelOf(d,c.from)+' → '+labelOf(d,c.to),c.brand,c.start,c.end,measure(length(c)),c.note].map(htmlCell),pics(c)]));
    const missing=o.checks.length ? '<h2>Осталось заполнить</h2><ul>'+o.checks.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>' : '';
    const unused=remaining(d);
    return `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.name)} — сдача</title><style>body{font:16px/1.5 system-ui,sans-serif;color:#172b3c;max-width:1100px;margin:2em auto;padding:0 1em}table{border-collapse:collapse;font-size:.93em}th,td{border:1px solid #b7c1cd;padding:.45em;text-align:left;vertical-align:top}th{background:#edf2f6}a{color:#175893}h2{margin-top:1.4em}section{overflow:auto}</style><h1>Сдача объекта · ${esc(o.name)}</h1><p>Выгрузка ${esc(new Date(o.exported).toLocaleString('ru-RU'))}${d.source?' · Обследование «'+esc(d.source)+'»':''}</p>${missing}<section><h2>Точки трассы</h2>${nodes}<h2>Пролёты и прогоны</h2>${spans}<h2>Кабель по метровым меткам</h2>${cables}</section>${unused.length?'<h2>Точки обследования вне фактической трассы</h2><p>'+unused.map(p=>esc(p.name)).join(', ')+'</p>':''}</html>`;
  }
  async function build(s) {
    const d=s.delivery, checks=checklist(d);
    const o={app:'rnd-sdacha',schema:1,name:s.name,id:s.id,exported:new Date().toISOString(),
      delivery:{...d,cables:d.cables.map(c=>({...c,lengthM:length(c)}))},checks};
    const files=[{name:'Отчёт.html',data:reportHTML(o)},{name:'sdacha.json',data:JSON.stringify(o,null,2)}];
    for (const r of [...d.nodes,...d.cables]) {
      for (const f of r.photos) {
        const item=await DB.get('files',f.id);
        if (!item?.data?.size || item.survey!==s.id) throw Error(`Не найдено фото «${f.original}»`);
        files.push({name:f.file,data:item.data});
      }
    }
    const blob=await makeZip(files);
    const current=await DB.get('surveys',s.id);
    if(current?.delivery?.revision!==d.revision) throw Error('Данные изменились. Откройте сдачу снова и соберите архив');
    const safe=s.name.replace(/[\\/:*?"<>|]/g,' ').trim().slice(0,70);
    return {blob,name:`Сдача_${safe}_${fmtD(Date.now())}_р${d.revision}.zip`,full:true};
  }
  async function exportReport(el) {
    if (S.busy) return;
    const s=S.survey, issues=checklist(s.delivery);
    if (issues.length && !await ask(`Осталось заполнить: ${issues.length}. Приложить перечень пропусков к архиву?`, 'Собрать с пропусками',false,'Вернуться')) return;
    el.disabled=true; S.busy=true; el.textContent='Собираю архив…';
    try {
      const result=await build(s);
      if(S.sid===s.id && S.survey.delivery.revision===s.delivery.revision){S.zip=result;rr();}
    } finally {el.disabled=false;S.busy=false;el.textContent='Собрать один архив';}
  }
  async function deleteDelivery(el) {
    const s = S.survey, id = el.dataset.id;
    if (!s?.delivery || s.id !== id || S.sid !== id || S.busy) return;
    const warning = 'Будут удалены записи и фотографии этой сдачи. Исходное обследование и его фотографии сохранятся.';
    if (!await ask(`Удалить сдачу «${s.name}»?\n\n${warning}`, 'Удалить сдачу', true)) return;
    if (S.sid !== id) return;
    await new Promise((resolve, reject) => {
      const tx = DB.d.transaction(['surveys', 'files'], 'readwrite');
      const surveys = tx.objectStore('surveys'), files = tx.objectStore('files');
      let conflict;
      const lookup = surveys.get(id);
      lookup.onsuccess = () => {
        const current = lookup.result;
        if (!current) return; // Уже удалена в другой вкладке.
        if (!current.delivery || current.delivery.revision !== s.delivery.revision) {
          conflict = new Error('Запись изменилась. Откройте сдачу заново и проверьте её перед удалением.');
          tx.abort();
          return;
        }
        const owned = files.index('survey').getAllKeys(id);
        owned.onsuccess = () => {
          for (const key of owned.result) files.delete(key);
          surveys.delete(id);
        };
      };
      tx.oncomplete = resolve;
      tx.onabort = () => reject(conflict || tx.error || new Error('Не удалось удалить сдачу'));
    });
    if (S.sid === id) go('home', {sid:null, survey:null, pts:[], pid:null, zip:null}, false);
    toast('Сдача удалена');
  }
  function install() {
    Object.assign(ACT,{
      'delivery-start':startMenu,'delivery-blank':()=>create(),'delivery-source':el=>fromPhone(el.dataset.id || S.sid),
      'delivery-open':el=>openSurvey(el.dataset.id),'delivery-cancel':closeSheet,'delivery-delete':deleteDelivery,
      'delivery-plan':()=>sheet('<h3>Точки обследования</h3><div class="delivery-list">'+remaining(data()).map(p=>row('pick',p.id,p.name,'Добавить в фактическую трассу')).join('')+'</div>'),
      'delivery-pick':el=>{const p=remaining(data()).find(n=>n.id===el.dataset.id); if(p)nodeForm(p.kind,null,p);},
      'delivery-new-node':el=>nodeForm(el.dataset.kind),'delivery-node':el=>{const n=data().nodes.find(p=>p.id===el.dataset.id);if(n)nodeForm(n.kind,n);},
      'delivery-new-cable':()=>cableForm(),'delivery-cable':el=>cableForm(data().cables.find(c=>c.id===el.dataset.id)),
      'delivery-export':exportReport
    });
    $('#inDelivery').addEventListener('change',async e=>{
      const file=e.target.files[0];e.target.value=''; if (!file)return;
      try {const {source,plan}=planFrom(await readSurvey(file));await create(source,plan);}
      catch(err){toast(errMsg(err),6500);}
    });
  }
  return {home,overview,install};
})();
