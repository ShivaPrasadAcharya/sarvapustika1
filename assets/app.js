/* sarvapustika1 catalogue. All file names and remarks are rendered as text. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const folders = [
    {key:'all', label:'All files', icon:'folder'},
    {key:'pdf', label:'PDFs', icon:'file'},
    {key:'images', label:'Images', icon:'image'},
    {key:'docs', label:'Documents', icon:'file'},
    {key:'spreadsheet', label:'Spreadsheets', icon:'grid'},
    {key:'powerpoints', label:'PowerPoints', icon:'slides'},
    {key:'video', label:'Videos', icon:'video'}
  ];
  const data = window.RAYA_INDEX || {files:[], generatedAt:null};
  const clean = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
  // Nepali character mappings supplied for optional, space-insensitive search.
  const NepaliNormalizer = {
    vowelMap: {'ी':'ि', 'ू':'ु', 'ृ':'ि', 'ऋ':'रि'},
    sibilantMap: {'श':'स', 'ष':'स'},
    nasalMap: {'ङ':'न', 'ण':'न', 'ञ':'न', 'ं':'न्'},
    vaBaMap: {'व':'ब'},
    numberMap: {'०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9'},
    _isDropped(ch, ignoreSpaces) {
      if (ch === '\u200D' || ch === '\u200C') return true;
      if (ignoreSpaces && /\s/.test(ch)) return true;
      return false;
    },
    _transformChar(ch) {
      let s = ch;
      for (const [f,t] of Object.entries(this.vowelMap)) if (s === f) s = t;
      for (const [f,t] of Object.entries(this.sibilantMap)) if (s === f) s = t;
      for (const [f,t] of Object.entries(this.nasalMap)) if (s === f) s = t;
      for (const [f,t] of Object.entries(this.vaBaMap)) if (s === f) s = t;
      for (const [f,t] of Object.entries(this.numberMap)) if (s === f) s = t;
      return s;
    },
    normalize(text, opts = {}) {
      if (!text) return '';
      return this._normalizeWithMap(text, opts).text;
    },
    _normalizeWithMap(text, opts = {}) {
      const ignoreSpaces = !!opts.ignoreSpaces;
      const src = text.normalize('NFC');
      let out = '';
      const indexMap = [];
      for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (this._isDropped(ch, ignoreSpaces)) continue;
        const mapped = this._transformChar(ch);
        for (const outCh of mapped) {out += outCh; indexMap.push(i);}
      }
      return {text:out, indexMap};
    },
    isDevanagari(text) {return /[\u0900-\u097F]/.test(text);},
    mapToOriginal(normPos, original, normalized, opts = {}) {
      const {indexMap} = this._normalizeWithMap(original, opts);
      if (normPos <= 0) return 0;
      if (normPos >= indexMap.length) return original.length;
      return indexMap[normPos];
    },
    search(query, text) {
      if (!query || !text) return [];
      const normQuery = this._normalizeWithMap(query, {ignoreSpaces:true}).text;
      const {text:normText, indexMap} = this._normalizeWithMap(text, {ignoreSpaces:true});
      if (!normQuery) return [];
      const matches = [];
      let fromIndex = 0;
      while (fromIndex <= normText.length) {
        const idx = normText.indexOf(normQuery, fromIndex);
        if (idx === -1) break;
        const startOrig = indexMap[idx];
        const endOrig = indexMap[idx + normQuery.length - 1] + 1;
        matches.push({start:startOrig, end:endOrig});
        fromIndex = idx + 1;
      }
      return matches;
    },
    matches(query, text) {return this.search(query, text).length > 0;}
  };
  const collator = new Intl.Collator(undefined, {numeric:true, sensitivity:'base'});
  // Any file in any folder under Files/ is shown; loose files directly in Files/ belong to the "root" group.
  const files = (Array.isArray(data.files) ? data.files : []).filter(f => {
    if (!f || typeof f.path !== 'string' || !f.path.startsWith('Files/')) return false;
    const segments = f.path.split('/');
    return segments.length >= 2 && !segments.some(s => !s || s === '.' || s === '..' || /[\\\u0000-\u001f]/.test(s));
  }).map(f => {
    const segments = f.path.split('/'), name = String(f.name || segments[segments.length - 1]);
    return {...f, folder:segments.length >= 3 ? segments[1] : 'root', name, remarks:String(f.remarks || ''), extension:String(f.extension ?? (name.includes('.') ? name.split('.').pop() : '')).toLocaleLowerCase()};
  });
  for (const key of [...new Set(files.map(f => f.folder))].sort(collator.compare)) {
    if (!folders.some(f => f.key === key)) folders.push({key, label:key === 'root' ? 'Other files' : key.charAt(0).toLocaleUpperCase() + key.slice(1), icon:'folder'});
  }
  const state = {folder:'all', page:1, filtered:[]};
  const advancedIds = ['match-mode','search-field','extension','name-filter','remarks-filter','exclude-filter','has-remarks'];
  const defaults = {'match-mode':'all','search-field':'all','extension':'','name-filter':'','remarks-filter':'','exclude-filter':'','has-remarks':false};
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('aria-hidden','true');
    const use = document.createElementNS('http://www.w3.org/2000/svg','use');
    use.setAttribute('href',`#i-${name}`); svg.append(use); return svg;
  }
  function element(tag, className, text) {
    const e = document.createElement(tag); if (className) e.className = className;
    if (text !== undefined) e.textContent = text; return e;
  }
  function encodedPath(path) { return path.split('/').map(encodeURIComponent).join('/'); }
  function tokens(value) { return (clean(value).match(/"[^"]+"|[^\s,]+/g) || []).map(t => t.replace(/^"|"$/g,'')); }
  function advancedCount() {return advancedIds.filter(id => ($(id).type === 'checkbox' ? $(id).checked : $(id).value) !== defaults[id]).length;}
  function fileUrl(file) {return new URL(encodedPath(file.path), document.baseURI).href;}
  function bytes(n) { if (!Number.isFinite(n)) return ''; if (n < 1024) return `${n} B`; if (n < 1048576) return `${(n/1024).toFixed(1)} KB`; return `${(n/1048576).toFixed(1)} MB`; }
  function shortDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'});
  }
  function sizeAndDate(file) {return [bytes(file.size), shortDate(file.updatedAt)].filter(Boolean).join(' · ');}
  // Remarks are plain text, except http(s):// and www. addresses which become safe links.
  function linkedText(text) {
    const fragment = document.createDocumentFragment(), pattern = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
    let last = 0, match;
    while ((match = pattern.exec(text))) {
      let url = match[0], trail = '';
      const stripped = url.match(/[.,;:!?)\]}'"।]+$/);
      if (stripped) {trail = stripped[0]; url = url.slice(0, -trail.length);}
      if (!url || /^(?:https?:\/\/|www\.)$/i.test(url)) continue;
      fragment.append(document.createTextNode(text.slice(last, match.index)));
      const a = element('a','remark-link',url);
      a.href = /^www\./i.test(url) ? `https://${url}` : url;
      a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
      fragment.append(a);
      last = match.index + url.length;
      pattern.lastIndex = last;
    }
    fragment.append(document.createTextNode(text.slice(last)));
    return fragment;
  }
  function remarkElement(text) {const e = element('span','remarks'); e.append(linkedText(text)); return e;}
  function folderNavigation() {
    const nav = $('folders'); nav.replaceChildren();
    for (const folder of folders) {
      const count = folder.key === 'all' ? files.length : files.filter(f => f.folder === folder.key).length;
      const b = element('button',`folder-button${folder.key===state.folder?' active':''}`);
      b.type = 'button'; b.setAttribute('aria-pressed', String(folder.key===state.folder));
      b.append(icon(folder.icon), element('span','',folder.label), element('span','folder-count',String(count)));
      b.addEventListener('click', () => {state.folder=folder.key; state.page=1; folderNavigation(); render();});
      nav.append(b);
    }
  }
  const standardExtensions = ['pdf','jpg','jpeg','png','webp','gif','svg','heic','heif','mp4','webm','mov','m4v','doc','docx','odt','rtf','txt','md','xls','xlsx','ods','csv','tsv','ppt','pptx','odp'];
  const extensions = [...new Set([...standardExtensions, ...files.map(f=>f.extension)])].sort();
  for (const ext of extensions) {$('extension').append(new Option(ext.toUpperCase(), ext));}
  function getFiltered() {
    const normalized = $('nepali-normalized')?.checked ?? true;
    const searchText = value => normalized ? NepaliNormalizer.normalize(clean(value), {ignoreSpaces:true}) : clean(value);
    // Split words before removing spaces so All words and Any word keep their meaning.
    const query = searchText($('search').value), queryTokens = tokens($('search').value).map(searchText).filter(Boolean), mode = $('match-mode').value;
    const field = $('search-field').value, ext = $('extension').value;
    const name = searchText($('name-filter').value), remarks = searchText($('remarks-filter').value), excluded = tokens($('exclude-filter').value).map(searchText).filter(Boolean);
    const result = files.filter(file => {
      if (state.folder !== 'all' && file.folder !== state.folder) return false;
      if (ext && file.extension !== ext) return false;
      if (name && !searchText(file.name).includes(name)) return false;
      if (remarks && !searchText(file.remarks).includes(remarks)) return false;
      if ($('has-remarks').checked && !file.remarks.trim()) return false;
      const full = searchText(`${file.name} ${file.folder} ${folders.find(f=>f.key===file.folder).label} ${file.remarks}`);
      if (excluded.some(word=>full.includes(word))) return false;
      const haystack = field === 'all' ? full : field === 'folder' ? searchText(`${file.folder} ${folders.find(f=>f.key===file.folder).label}`) : searchText(file[field]);
      if (!query) return true;
      if (mode === 'phrase') return haystack.includes(query.replace(/^"|"$/g,''));
      return mode === 'any' ? queryTokens.some(word=>haystack.includes(word)) : queryTokens.every(word=>haystack.includes(word));
    });
    const sort = $('sort').value;
    result.sort((a,b) => {
      if (sort === 'folder-asc') return collator.compare(a.folder,b.folder) || collator.compare(a.name,b.name);
      return (sort === 'name-desc' ? -1 : 1) * collator.compare(a.name,b.name) || collator.compare(a.path,b.path);
    });
    return result;
  }
  const imageTypes = ['png','jpg','jpeg','gif','webp','avif','bmp','svg','heic','heif'];
  const videoTypes = ['mp4','webm','mov','m4v','ogv'];
  function previewKind(file) {
    if (file.extension === 'pdf') return 'pdf';
    if (imageTypes.includes(file.extension)) return 'image';
    if (videoTypes.includes(file.extension)) return 'video';
    return '';
  }
  function link(file, kind) {
    const label = file.extension.toUpperCase() || 'file';
    const a = element('a',kind === 'download' ? 'download-link' : 'open-link');
    const text = kind === 'download' ? (file.downloadText || `Download ${label}`) : (file.openText || `Open ${label}`);
    a.append(icon(kind === 'download' ? 'download' : 'eye'), element('span','',text));
    a.href = fileUrl(file); a.setAttribute('aria-label',`${text}: ${file.name}`);
    if (kind === 'download') {a.download=file.name; return a;}
    a.target='_blank'; a.rel='noopener noreferrer';
    if (previewKind(file)) {
      a.addEventListener('click',e => {if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; e.preventDefault(); preview(file);});
    } else if (['doc','docx','xls','xlsx','ppt','pptx'].includes(file.extension) && /^https?:/.test(location.protocol)) {
      a.href = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl(file))}`;
      a.title='Open with Microsoft Office web viewer';
    } else {a.title='Open original file; your browser may download this format';}
    return a;
  }
  // Files whose first two name sections match (sections split by . - or _) share one row,
  // e.g. dn49.20830513.cover and dn49.20830513.raya.
  function groupFiles(items, sort) {
    const groups = new Map();
    for (const file of items) {
      const extensionStart = file.name.lastIndexOf('.');
      const stem = extensionStart > 0 ? file.name.slice(0, extensionStart) : file.name;
      const prefix = (stem.match(/^[._-]*[^._-]+[._-]+[^._-]+/) || [stem])[0];
      const name = prefix.replace(/^[._-]+/, '');
      const category = stem.slice(prefix.length).replace(/^[._-]+/, '');
      const directory = file.path.split('/').slice(2, -1).join('/');
      const key = `${directory}\u0000${name.toLocaleLowerCase().replace(/[._-]+/g, '.')}`;
      if (!groups.has(key)) groups.set(key, {name, directory, files: [], size: 0, uploadedAt: null});
      const group = groups.get(key);
      group.files.push({file, category});
      if (Number.isFinite(file.size)) group.size += file.size;
      const uploadedAt = Date.parse(file.uploadedAt);
      if (Number.isFinite(uploadedAt) && (group.uploadedAt === null || uploadedAt > group.uploadedAt)) {
        group.uploadedAt = uploadedAt;
      }
    }
    const rows = [...groups.values()];
    if (sort.startsWith('size-') || sort.startsWith('upload-')) {
      const field = sort.startsWith('size-') ? 'size' : 'uploadedAt';
      const direction = sort.endsWith('-asc') ? 1 : -1;
      rows.sort((a, b) => {
        if (a[field] === b[field]) return 0;
        if (a[field] === null) return 1;
        if (b[field] === null) return -1;
        return direction * (a[field] - b[field]);
      });
    }
    return rows;
  }
  function variantLabel(entry) {
    const extension = entry.file.extension.toUpperCase();
    return entry.category ? `${entry.category} (${extension})` : extension;
  }
  function row(fileGroup, index) {
    const entries = fileGroup.files, grouped = entries.length > 1, file = entries[0].file;
    const tr = document.createElement('tr');
    const sn = element('td','sn',String(index));
    const nameCell = element('td','name-cell');
    const title = grouped ? fileGroup.name : file.name.replace(/\.[^.]+$/, '') || file.name;
    nameCell.append(element('span','file-title',title));
    const folders = new Set(entries.map(({file}) => file.path.split('/').slice(1,-1).join('/') || 'root'));
    const folderLine = element('div','catalogue-folders');
    folderLine.append(icon('folder'),document.createTextNode([...folders].join(' · ')));
    nameCell.append(folderLine);

    const linkCell = element('td','link-cell');
    for (const entry of entries) {
      const item = entry.file;
      const date = item.uploadedAt ? shortDate(item.uploadedAt) : '';
      const details = [bytes(item.size),date].filter(Boolean).join(' · ');
      nameCell.append(element('div','file-meta',details));

      const actions = element('div','file-links catalogue-actions');
      const open = link(item,'open');
      const label = grouped ? variantLabel(entry) : item.extension.toUpperCase();
      open.replaceChildren(icon('eye'),element('span','',label || 'File'));
      const download = link(item,'download');
      download.replaceChildren(icon('download'));
      download.title = download.getAttribute('aria-label');
      actions.append(open,download);
      linkCell.append(actions);
    }
    const remarksCell=element('td','remarks-cell');
    const remarkList=element('div','remark-list');
    for (const entry of entries) {
      const text=entry.file.remarks;
      if (text.trim()) remarkList.append(remarkElement(text));
    }
    if (remarkList.childElementCount) remarksCell.append(remarkList);
    tr.append(sn,nameCell,linkCell,remarksCell);return tr;
  }
  function render() {
    state.filtered=getFiltered();const n=state.filtered.length,groups=groupFiles(state.filtered, $('sort').value),rowCount=groups.length,size=Number($('page-size').value),pages=Math.max(1,Math.ceil(rowCount/size));state.page=Math.min(state.page,pages);
    const start=(state.page-1)*size,end=Math.min(start+size,rowCount),fragment=document.createDocumentFragment();
    for(let i=start;i<end;i++)fragment.append(row(groups[i],i+1));$('file-rows').replaceChildren(fragment);
    const folder=folders.find(f=>f.key===state.folder);$('view-title').textContent=folder.label;
    $('view-description').textContent=state.folder==='all'?'PDFs, images, documents, spreadsheets, presentations and videos.':`Files / ${folder.key === 'root' ? '' : folder.key}`;
    $('total-pill').textContent=`${files.length} ${files.length===1?'file':'files'}`;
    $('result-summary').textContent=n===files.length?`${n} ${n===1?'file':'files'} in the catalogue`:`${n} of ${files.length} files match`;
    const count=advancedCount();$('filter-count').hidden=!count;$('filter-count').textContent=count;
    const filtered=!!($('search').value.trim()||count||state.folder!=='all');$('clear-all').hidden=!filtered;
    $('empty-state').hidden=n>0;$('empty-reset').hidden=!files.length;
    $('empty-title').textContent=files.length?'No matching files':'No files added yet';
    $('empty-description').textContent=files.length?'Try a different search or clear your filters.':'Your catalogue is ready. Add files to the PDF, images, docs, spreadsheet or powerpoints folders.';
    $('page-summary').textContent=rowCount?`Rows ${start+1}–${end} of ${rowCount} · Page ${state.page} of ${pages}`:'0 rows';
    $('previous').disabled=state.page<=1;$('next').disabled=state.page>=pages;
    updateScrollButtons();
  }
  function resetAdvanced() {for(const id of advancedIds){if($(id).type==='checkbox')$(id).checked=defaults[id];else $(id).value=defaults[id];}state.page=1;render();}
  function resetAll() {$('search').value='';state.folder='all';resetAdvanced();folderNavigation();$('search').focus();}
  function updateScrollButtons() {
    const previewOpen=$('preview').open,nearBottom=window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-300;
    $('go-top').hidden=window.scrollY<300 || previewOpen;
    $('go-bottom').hidden=nearBottom || previewOpen;
  }
  function scrollToEdge(edge) {
    const reducedMotion=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top:edge==='top'?0:document.documentElement.scrollHeight,behavior:reducedMotion?'auto':'smooth'});
  }
  window.addEventListener('scroll',updateScrollButtons,{passive:true});
  window.addEventListener('resize',updateScrollButtons,{passive:true});
  new MutationObserver(updateScrollButtons).observe($('catalogue-app'),{attributes:true,attributeFilter:['hidden']});
  $('go-top')?.addEventListener('click',()=>scrollToEdge('top'));
  $('go-bottom')?.addEventListener('click',()=>scrollToEdge('bottom'));
  updateScrollButtons();
  let nativePreviewFullscreen=false;
  function previewIsFullscreen() {return !!$('preview-shell') && document.fullscreenElement===$('preview-shell');}
  function setPreviewExpanded(expanded) {
    if(!$('preview-fullscreen'))return;
    $('preview').classList.toggle('preview-expanded',expanded);
    const button=$('preview-fullscreen'),label=expanded?'Exit fullscreen':'Enter fullscreen';
    button.setAttribute('aria-pressed',String(expanded));button.setAttribute('aria-label',label);button.title=label;
    button.querySelector('use').setAttribute('href',expanded?'#i-collapse':'#i-expand');
    button.querySelector('span').textContent=expanded?'Exit full screen':'Full screen';
  }
  $('preview-fullscreen')?.addEventListener('click',async()=>{
    const dialog=$('preview'),shell=$('preview-shell'),button=$('preview-fullscreen');
    if(!dialog.open)return;
    button.disabled=true;
    try {
      if(dialog.classList.contains('preview-expanded')) {
        if(document.fullscreenElement===shell && document.exitFullscreen)await document.exitFullscreen();
        setPreviewExpanded(document.fullscreenElement===shell);
      } else {
        setPreviewExpanded(true);
        // Keep a full-window view when the browser cannot enter native fullscreen.
        if(shell.requestFullscreen && document.fullscreenEnabled) {
          try {await shell.requestFullscreen();}catch {/* The full-window view remains available. */}
        }
        if(!dialog.open && document.fullscreenElement===shell && document.exitFullscreen)await document.exitFullscreen();
        if(!dialog.open)setPreviewExpanded(false);
      }
    } catch {/* A browser-controlled fullscreen exit can be retried with Escape. */}
    finally {button.disabled=false;}
  });
  document.addEventListener('fullscreenchange',()=>{
    const active=previewIsFullscreen();
    if(active || nativePreviewFullscreen)setPreviewExpanded(active);
    nativePreviewFullscreen=active;
  });
  $('preview').addEventListener('cancel',event=>{
    if(!$('preview').classList.contains('preview-expanded'))return;
    event.preventDefault();
    if(previewIsFullscreen() && document.exitFullscreen)document.exitFullscreen().catch(()=>{});
    else setPreviewExpanded(false);
  });
  let heicLoader;
  function loadHeicConverter() {
    heicLoader ||= new Promise((resolve, reject) => {
      if (window.heic2any) return resolve(window.heic2any);
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
      script.onload = () => window.heic2any ? resolve(window.heic2any) : reject(new Error('heic2any missing'));
      script.onerror = () => {heicLoader = null; reject(new Error('heic2any unavailable'));};
      document.head.append(script);
    });
    return heicLoader;
  }
  function previewFailed(content) {
    const box = element('div','preview-fallback'); box.append(element('p','','Preview unavailable in this browser. Use Download to save the file.'));
    content.replaceChildren(box);
  }
  function preview(file) {
    const dialog=$('preview'),kind=previewKind(file);setPreviewExpanded(false);$('preview-title').textContent=file.name;
    $('preview-note').textContent=kind==='pdf'?'PDF preview · If a preview is unavailable, use Download.':kind==='video'?'Video preview':'Image preview';
    $('preview-download').href=fileUrl(file);$('preview-download').download=file.name;
    const content=$('preview-content');content.replaceChildren();
    if(kind==='pdf'){const frame=document.createElement('iframe');frame.title=`PDF preview: ${file.name}`;frame.src=fileUrl(file);content.append(frame);}
    else if(kind==='video'){const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.title=file.name;video.src=fileUrl(file);video.addEventListener('error',()=>previewFailed(content),{once:true});content.append(video);}
    else {
      const img=document.createElement('img');img.alt=file.name;img.src=fileUrl(file);
      img.addEventListener('error',async()=>{
        // Chrome, Firefox and Edge cannot draw HEIC natively: convert it in the browser (Safari shows it directly).
        if(['heic','heif'].includes(file.extension)){
          content.replaceChildren(element('p','preview-fallback','Converting HEIC image…'));
          try{
            const [convert,blob]=await Promise.all([loadHeicConverter(),fetch(fileUrl(file)).then(r=>{if(!r.ok)throw new Error('fetch');return r.blob();})]);
            const out=await convert({blob,toType:'image/jpeg',quality:.85}),result=Array.isArray(out)?out[0]:out,converted=document.createElement('img');
            if(!dialog.open)return;
            converted.alt=file.name;converted.src=URL.createObjectURL(result);converted.addEventListener('load',()=>URL.revokeObjectURL(converted.src),{once:true});content.replaceChildren(converted);
          }catch{if(dialog.open)previewFailed(content);}
        } else previewFailed(content);
      },{once:true});
      content.append(img);
    }
    dialog.showModal();$('preview-close').focus();updateScrollButtons();
  }
  $('preview-close').addEventListener('click',()=>$('preview').close());
  $('preview').addEventListener('close',()=>{
    if(previewIsFullscreen() && document.exitFullscreen)document.exitFullscreen().catch(()=>{});
    setPreviewExpanded(false);$('preview-content').replaceChildren();updateScrollButtons();
  });
  $('preview').addEventListener('click',e=>{if(e.target===$('preview')){const r=$('preview').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('preview').close();}});
  $('advanced-toggle').addEventListener('click',()=>{const open=$('advanced').hidden;$('advanced').hidden=!open;$('advanced-toggle').setAttribute('aria-expanded',String(open));});
  let timer; for(const id of ['search','nepali-normalized',...advancedIds]){const control=$(id);control?.addEventListener(control.tagName==='SELECT'||control.type==='checkbox'?'change':'input',()=>{clearTimeout(timer);timer=setTimeout(()=>{state.page=1;render();},100);});}
  $('reset-advanced').addEventListener('click',resetAdvanced);$('clear-all').addEventListener('click',resetAll);$('empty-reset').addEventListener('click',resetAll);
  $('sort').addEventListener('change',()=>{state.page=1;render();});
  $('sort-folder').addEventListener('click',()=>{$('sort').value='folder-asc';state.page=1;render();});
  $('sort-name').addEventListener('click',()=>{$('sort').value=$('sort').value==='name-asc'?'name-desc':'name-asc';state.page=1;render();});
  $('page-size').addEventListener('change',()=>{state.page=1;render();});$('previous').addEventListener('click',()=>{if(state.page>1)state.page--;render();});$('next').addEventListener('click',()=>{state.page++;render();});
  document.addEventListener('keydown',e=>{const editing=['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable;if(e.key==='/'&&!editing&&!e.ctrlKey&&!e.metaKey&&!$('preview').open){e.preventDefault();$('search').focus();}if(e.key==='Escape'&&e.target===$('search')){$('search').value='';state.page=1;render();}});
  if(data.generatedAt){const date=new Date(data.generatedAt);if(!Number.isNaN(date.valueOf()))$('updated-at').textContent=`Catalogue updated ${date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}`;}
  const note=document.querySelector('.folder-note span');if(note)note.textContent=`Files are organised in ${folders.length-1} folders.`;
  folderNavigation();render();
  if(!window.RAYA_INDEX){$('result-summary').textContent='Catalogue index could not load. Please refresh the page.';$('empty-title').textContent='Catalogue unavailable';$('empty-description').textContent='Please refresh the page or check that files-index.js is available.';}
})();

/* Template: point "Add files" at this site's own GitHub repo (owner.github.io/repo -> github.com/owner/repo). */
(() => {
  const link = document.getElementById('add-files');
  const owner = location.hostname.endsWith('.github.io') ? location.hostname.split('.')[0] : '';
  const repo = location.pathname.split('/')[1];
  if (link && owner && repo) link.href = `https://github.com/${owner}/${repo}`;
})();

/* Template: favicon shows the repo number (sarvapustika7 -> "7"); stays "N" when none is found. */
(async () => {
  const match = (location.pathname.split('/')[1] || '').match(/(\d+)$/);
  const icon = document.querySelector('link[rel="icon"]');
  if (!match || !icon) return;
  try {
    const number = match[1];
    const size = number.length === 1 ? 30 : number.length === 2 ? 22 : 16;
    const response = await fetch(icon.getAttribute('href'));
    if (!response.ok) return;
    const svg = (await response.text())
      .replace('font-size="30"', `font-size="${size}"`)
      .replace('>N</text>', `>${number}</text>`);
    icon.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  } catch { /* keep the static "N" favicon */ }
})();
