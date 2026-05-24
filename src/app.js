const DB_NAME = 'kaoyan11408_notes_db_v2';
    const STORE_NAME = 'kv';
    const DATA_KEY = 'notes-data';
    const SUBJECTS = [
      { id: 'gaoshu', name: '高数', short: '高' },
      { id: 'xiandai', name: '线代', short: '线' },
      { id: 'gailun', name: '概率论', short: '概' },
      { id: 'ds', name: '数据结构', short: '数' },
      { id: 'co', name: '计算机组成原理', short: '组' },
      { id: 'os', name: '操作系统', short: '操' },
      { id: 'cn', name: '计算机网络', short: '网' },
      { id: 'english', name: '英语', short: '英' },
      { id: 'politics', name: '政治', short: '政' }
    ];

    let state = { activeSubjectId: 'gaoshu', activeNodeId: null, expanded: {}, uiMode: 'preview', htmlVisible: true, subjects: [] };
    let mindPan = { x: 0, y: 0, scale: 1, dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0, moved: false };
    let saveTimer = null;
    let modalResolve = null;

    const $ = s => document.querySelector(s);
    const els = {
      app: $('#app'), subjectList: $('#subjectList'), tree: $('#tree'), treeTitle: $('#treeTitle'),
      breadcrumb: $('#breadcrumb'), titleInput: $('#titleInput'), mdEditor: $('#mdEditor'), htmlEditor: $('#htmlEditor'),
      preview: $('#preview'), saveState: $('#saveState'), globalSearch: $('#globalSearch'), searchResults: $('#searchResults'),
      sidebar: $('#sidebar'), outlineOverlay: $('#outlineOverlay'), mindmap: $('#mindmap'), outlineTitle: $('#outlineTitle'),
      modalMask: $('#modalMask'), modalTitle: $('#modalTitle'), modalInput: $('#modalInput'),
      importMask: $('#importMask'), importText: $('#importText'),
      htmlCenterMask: $('#htmlCenterMask'), htmlCenterPanel: $('#htmlCenterPanel'), htmlCenterFrame: $('#htmlCenterFrame'),
      toast: $('#toast')
    };

    function uid(prefix='n') { return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
    function createNode(title, level=1, md='') { return { id: uid(), title, level, md, html: '', assets: [], children: [], createdAt: Date.now(), updatedAt: Date.now() }; }

    function defaultData() {
      const subjects = SUBJECTS.map(s => ({ ...s, nodes: [] }));
      const gaoshu = subjects.find(s => s.id === 'gaoshu');
      const c1 = createNode('第一章 函数、极限、连续', 1, '# 第一章 函数、极限、连续\n\n## 公式示例\n行内公式：$\\lim_{x\\to 0}\\frac{\\sin x}{x}=1$\n\n块公式：\n$$\n\\int_0^1 x^2\\,dx=\\frac{1}{3}\n$$\n\n## 本章核心\n- 极限计算\n- 无穷小比较\n- 连续与间断点');
      c1.children.push(createNode('1.1 函数与基本性质', 2));
      c1.children.push(createNode('1.2 极限计算', 2));
      c1.children.push(createNode('1.3 连续与间断点', 2));
      const c2 = createNode('第二章 一元函数微分学', 1, '# 第二章 一元函数微分学\n\n看到“切线、单调、极值、凹凸、拐点、证明不等式”，优先想到导数工具。');
      c2.children.push(createNode('2.1 导数定义与计算', 2)); c2.children.push(createNode('2.2 中值定理', 2)); c2.children.push(createNode('2.3 导数应用', 2));
      gaoshu.nodes = [c1, c2];
      const ds = subjects.find(s => s.id === 'ds');
      const d1 = createNode('第一章 绪论与复杂度', 1, '# 数据结构第一章\n\n## 408要点\n- 时间复杂度\n- 空间复杂度\n- 抽象数据类型\n\n复杂度公式示例：$T(n)=O(n\\log n)$');
      d1.children.push(createNode('1.1 时间复杂度', 2)); d1.children.push(createNode('1.2 空间复杂度', 2));
      const d2 = createNode('第二章 线性表', 1); d2.children.push(createNode('2.1 顺序表', 2)); d2.children.push(createNode('2.2 单链表', 2));
      ds.nodes = [d1, d2];
      const co = subjects.find(s => s.id === 'co');
      const co1 = createNode('第一章 计算机系统概述', 1); const co2 = createNode('第二章 数据的表示和运算', 1);
      co2.children.push(createNode('2.1 进位计数制', 2)); co2.children.push(createNode('2.2 定点数与浮点数', 2)); co.nodes = [co1, co2];
      for (const s of subjects) if (!s.nodes.length) { const first = createNode('第一章 请在这里建立本书框架', 1, `# ${s.name} 笔记\n\n## 今日任务\n- 建立章节目录\n- 写清本章核心考点\n- 记录错题和条件反射`); first.children.push(createNode('1.1 新建小节', 2)); s.nodes.push(first); }
      return { activeSubjectId: 'gaoshu', activeNodeId: gaoshu.nodes[0].id, expanded: {}, uiMode: 'preview', htmlVisible: true, subjects };
    }

    function openDB() { return new Promise((resolve, reject) => { const req = indexedDB.open(DB_NAME, 1); req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME); }; req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
    async function idbGet(key) { const db = await openDB(); return new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, 'readonly'); const req = tx.objectStore(STORE_NAME).get(key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
    async function idbSet(key, value) { const db = await openDB(); return new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, 'readwrite'); const req = tx.objectStore(STORE_NAME).put(value, key); req.onsuccess = () => resolve(true); req.onerror = () => reject(req.error); }); }

    function getActiveSubject() { return state.subjects.find(s => s.id === state.activeSubjectId); }
    function walk(nodes, cb, parent=null, path=[]) { for (let i=0;i<nodes.length;i++) { const node = nodes[i]; cb(node, parent, i, path.concat(node)); if (node.children?.length) walk(node.children, cb, node, path.concat(node)); } }
    function findNodeById(id, subject=getActiveSubject()) { let found = null; if (!subject) return null; walk(subject.nodes, (node, parent, index, path) => { if (node.id === id) found = { node, parent, index, path }; }); return found; }
    function flattenSubject(subject=getActiveSubject()) { const arr=[]; if (!subject) return arr; walk(subject.nodes, (node, parent, index, path) => arr.push({node,parent,index,path})); return arr; }

    function ensureNodeAssets(node) {
      if (!node) return [];
      if (!Array.isArray(node.assets)) node.assets = [];
      return node.assets;
    }

    function addImageAsset(node, name, src) {
      const assets = ensureNodeAssets(node);
      const id = uid('img');
      assets.push({
        id,
        name: name || '图片',
        type: 'image',
        src,
        createdAt: Date.now()
      });
      return id;
    }

    function getImageAsset(node, id) {
      const assets = ensureNodeAssets(node);
      return assets.find(asset => asset.id === id);
    }

    function shortImageLabel(name) {
      const clean = String(name || '').trim();
      return clean ? `图片:${clean}` : '图片';
    }

    function compactInlineBase64Images(node) {
      if (!node || typeof node.md !== 'string') return;
      ensureNodeAssets(node);
      node.md = node.md.replace(/!\[([^\]]*)\]\((data:image\/[a-zA-Z0-9.+-]+;base64,[^)]+)\)/g, (full, alt, src) => {
        const id = addImageAsset(node, alt || '图片', src);
        return `[[图片:${id}]]`;
      });
    }


    function applyMode() {
      els.app.classList.toggle('read-mode', state.uiMode === 'preview');
      $('#modeToggleBtn').textContent = state.uiMode === 'preview' ? '编辑' : '预览';
      $('#modeToggleBtn').className = state.uiMode === 'preview' ? 'primary' : 'soft';
    }

    function currentHasHtml() {
      const info = findNodeById(state.activeNodeId);
      return !!(info && typeof info.node.html === 'string' && info.node.html.trim().length > 0);
    }

    function updateHtmlGlobalButton() {
      const btn = $('#htmlGlobalBtn');
      if (!btn) return;
      const hasHtml = currentHasHtml();
      btn.disabled = !hasHtml;
      btn.textContent = hasHtml ? '显示HTML' : '无HTML';
      btn.className = hasHtml ? 'soft' : 'ghost';
    }

    function renderAll() { applyMode(); renderSubjects(); renderTree(); renderEditor(); runSearch(); updateHtmlGlobalButton(); }

    function renderSubjects() {
      els.subjectList.innerHTML = '';
      for (const s of state.subjects) {
        const item = document.createElement('div');
        item.className = 'subject-item' + (s.id === state.activeSubjectId ? ' active' : '');
        item.innerHTML = `<div class="subject-badge">${escapeHtml(s.short)}</div><div class="subject-name">${escapeHtml(s.name)}</div>`;
        item.onclick = () => { saveCurrentNode(); state.activeSubjectId = s.id; const first = flattenSubject(s)[0]; state.activeNodeId = first ? first.node.id : null; els.sidebar.classList.remove('show'); renderAll(); scheduleSave(); };
        els.subjectList.appendChild(item);
      }
    }

    function renderTree() {
      const subject = getActiveSubject();
      els.treeTitle.textContent = subject ? subject.name + '目录' : '章节目录';
      els.tree.innerHTML = '';
      if (!subject || !subject.nodes.length) { els.tree.innerHTML = '<div class="empty"><div><h2>暂无章节</h2><p>点击“+章”开始建立框架。</p></div></div>'; return; }
      const renderNode = (node, level) => {
        const hasChild = node.children && node.children.length;
        const expanded = state.expanded[node.id] !== false;
        const row = document.createElement('div');
        row.className = 'node-row' + (node.id === state.activeNodeId ? ' active' : '');
        row.style.setProperty('--level', level);
        row.innerHTML = `<span class="caret">${hasChild ? (expanded ? '▾' : '▸') : '•'}</span><span class="node-title" title="${escapeAttr(node.title)}">${escapeHtml(node.title)}</span><span class="node-actions"><button class="small ghost" title="添加子节">＋</button></span>`;
        row.querySelector('.caret').onclick = e => { e.stopPropagation(); if (hasChild) { state.expanded[node.id] = !expanded; renderTree(); scheduleSave(); } };
        row.querySelector('.node-actions button').onclick = async e => { e.stopPropagation(); await addChild(node.id); };
        row.onclick = () => selectNode(node.id);
        els.tree.appendChild(row);
        if (hasChild && expanded) node.children.forEach(child => renderNode(child, level + 1));
      };
      subject.nodes.forEach(n => renderNode(n, 0));
    }

    function renderEditor() {
      const info = findNodeById(state.activeNodeId);
      const hasNode = !!info;
      els.titleInput.disabled = !hasNode || state.uiMode === 'preview';
      els.mdEditor.disabled = !hasNode;
      els.htmlEditor.disabled = !hasNode;
      ['addSiblingBtn','addChildBtn','deleteNodeBtn','moveUpBtn','moveDownBtn','prevBtn','nextBtn'].forEach(id => $('#' + id).disabled = !hasNode);
      if (!hasNode) {
        els.breadcrumb.textContent = '请选择或创建一个小节'; els.titleInput.value = ''; els.mdEditor.value = ''; els.htmlEditor.value = '';
        els.preview.innerHTML = '<div class="empty"><div><h2>还没有选择小节</h2><p>从左侧目录选择，或点击“+章”创建。</p></div></div>'; updateHtmlGlobalButton(); return;
      }
      const { node, path } = info;
      els.breadcrumb.textContent = getActiveSubject().name + ' / ' + path.map(p => p.title).join(' / ');
      els.titleInput.value = node.title; els.mdEditor.value = node.md || ''; els.htmlEditor.value = node.html || '';
      renderPreview(node.md || '', node.html || '');
      updatePrevNextState();
    }

    function renderPreview(md, html) {
      const base = mdToHtml(md || '');
      els.preview.innerHTML = base;
      if (els.htmlCenterMask?.classList.contains('show')) {
        const info = findNodeById(state.activeNodeId);
        const htmlCode = info?.node?.html || html || '';
        if (htmlCode.trim()) els.htmlCenterFrame.srcdoc = htmlDoc(htmlCode);
        else closeHtmlCenter();
      }
      typesetMath();
      updateHtmlGlobalButton();
    }

    function openHtmlCenter() {
      const info = findNodeById(state.activeNodeId);
      const htmlCode = info?.node?.html || '';
      if (!htmlCode.trim()) { showToast('当前小节还没有 HTML 代码'); return; }
      els.htmlCenterFrame.srcdoc = htmlDoc(htmlCode);
      els.htmlCenterMask.classList.add('show');
      state.htmlVisible = true;
      updateHtmlGlobalButton();
    }

    function closeHtmlCenter() {
      els.htmlCenterMask.classList.remove('show');
      els.htmlCenterFrame.srcdoc = 'about:blank';
      updateHtmlGlobalButton();
    }

    function htmlDoc(html) {
      const cfg = `<script>window.MathJax={tex:{inlineMath:[['$','$'],['\\\\(','\\\\)']],displayMath:[['$$','$$'],['\\\\[','\\\\]']],processEscapes:true},svg:{fontCache:'global'}};<\/script><script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"><\/script>`;
      const body = (html || '').trim() ? html : '';
      return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${cfg}<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',Arial,sans-serif;padding:16px;line-height:1.7;color:#172033}img{max-width:100%;border-radius:12px}pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:12px;overflow:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #e5e7eb;padding:8px}</style></head><body>${body}</body></html>`;
    }

    function typesetMath() {
      if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetClear?.([els.preview]);
        window.MathJax.typesetPromise([els.preview]).catch(() => {});
      }
    }

    function updatePrevNextState() {
      const arr = flattenSubject();
      const idx = arr.findIndex(x => x.node.id === state.activeNodeId);
      $('#prevBtn').disabled = idx <= 0;
      $('#nextBtn').disabled = idx < 0 || idx >= arr.length - 1;
      const info = findNodeById(state.activeNodeId);
      const list = info ? (info.parent ? info.parent.children : getActiveSubject().nodes) : [];
      const canUp = !!info && info.index > 0;
      const canDown = !!info && info.index < list.length - 1;
      const upBtn = $('#moveUpBtn');
      const downBtn = $('#moveDownBtn');
      if (upBtn) upBtn.disabled = !canUp;
      if (downBtn) downBtn.disabled = !canDown;
    }
    function selectNode(id) { saveCurrentNode(); closeHtmlCenter(); state.activeNodeId = id; const info = findNodeById(id); if (info) info.path.forEach(p => state.expanded[p.id] = true); els.sidebar.classList.remove('show'); renderTree(); renderEditor(); scheduleSave(); }
    function saveCurrentNode() { const info = findNodeById(state.activeNodeId); if (!info) return; info.node.title = els.titleInput.value.trim() || '未命名小节'; info.node.md = els.mdEditor.value; info.node.html = els.htmlEditor.value; ensureNodeAssets(info.node); compactInlineBase64Images(info.node); if (els.mdEditor.value !== info.node.md) els.mdEditor.value = info.node.md; info.node.updatedAt = Date.now(); }
    function scheduleSave() { clearTimeout(saveTimer); if (els.saveState) els.saveState.textContent = '正在保存……'; saveTimer = setTimeout(async () => { saveCurrentNode(); await idbSet(DATA_KEY, state); if (els.saveState) els.saveState.textContent = '已保存到浏览器本地 IndexedDB · ' + new Date().toLocaleTimeString(); }, 300); }
    function showToast(msg) { els.toast.textContent = msg; els.toast.classList.add('show'); setTimeout(() => els.toast.classList.remove('show'), 1600); }

    function promptModal(title, placeholder='请输入名称', value='') { els.modalTitle.textContent = title; els.modalInput.placeholder = placeholder; els.modalInput.value = value; els.modalMask.classList.add('show'); setTimeout(() => els.modalInput.focus(), 50); return new Promise(resolve => modalResolve = resolve); }
    function closeModal(result=null) { els.modalMask.classList.remove('show'); if (modalResolve) modalResolve(result); modalResolve = null; }
    async function addRoot() { const title = await promptModal('新建章', '例如：第三章 一元函数积分学'); if (!title) return; const node = createNode(title, 1); getActiveSubject().nodes.push(node); state.activeNodeId = node.id; state.expanded[node.id] = true; renderAll(); scheduleSave(); }
    async function addChild(parentId=state.activeNodeId) { const info = findNodeById(parentId); if (!info) return; const title = await promptModal('新建子节', '例如：2.1 中值定理的使用条件'); if (!title) return; const node = createNode(title, (info.node.level || 1) + 1); info.node.children = info.node.children || []; info.node.children.push(node); state.expanded[info.node.id] = true; state.activeNodeId = node.id; renderAll(); scheduleSave(); }
    async function addSibling() { const info = findNodeById(state.activeNodeId); if (!info) return; const title = await promptModal('新建同级小节', '例如：下一节标题'); if (!title) return; const node = createNode(title, info.node.level || 1); const list = info.parent ? info.parent.children : getActiveSubject().nodes; list.splice(info.index + 1, 0, node); state.activeNodeId = node.id; renderAll(); scheduleSave(); }
    function deleteNode() { const info = findNodeById(state.activeNodeId); if (!info) return; if (!confirm(`确定删除“${info.node.title}”以及它下面的所有子节吗？`)) return; const list = info.parent ? info.parent.children : getActiveSubject().nodes; list.splice(info.index, 1); const arr = flattenSubject(); state.activeNodeId = arr[Math.min(info.index, arr.length - 1)]?.node.id || null; renderAll(); scheduleSave(); }
    function goPrevNext(delta) { saveCurrentNode(); const arr = flattenSubject(); const idx = arr.findIndex(x => x.node.id === state.activeNodeId); const next = arr[idx + delta]; if (next) selectNode(next.node.id); }

    function moveActiveNode(delta) {
      const info = findNodeById(state.activeNodeId);
      if (!info) return;
      const list = info.parent ? info.parent.children : getActiveSubject().nodes;
      const nextIndex = info.index + delta;
      if (nextIndex < 0 || nextIndex >= list.length) return;
      const temp = list[info.index];
      list[info.index] = list[nextIndex];
      list[nextIndex] = temp;
      renderAll();
      scheduleSave();
      showToast(delta < 0 ? '已上移当前小节' : '已下移当前小节');
    }

    function insertAtCursor(text, wrap=false) {
      const ta = els.mdEditor; if (ta.disabled) return;
      const start = ta.selectionStart, end = ta.selectionEnd, selected = ta.value.slice(start, end);
      let insert = text, cursor = start + text.length;
      if (wrap) { const [before, after] = text.split('|'); insert = before + selected + after; cursor = start + before.length + selected.length; }
      else if (text.includes('|')) { insert = text.replace('|', selected); cursor = start + text.indexOf('|') + selected.length; }
      ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end); ta.focus(); ta.selectionStart = ta.selectionEnd = cursor; onEditorInput();
    }
    function onEditorInput() { saveCurrentNode(); const info = findNodeById(state.activeNodeId); renderPreview(info?.node.md || els.mdEditor.value, info?.node.html || els.htmlEditor.value); renderTree(); scheduleSave(); }

    function mdToHtml(md) {
      if (!md.trim()) return '<div class="empty"><div><h2>开始写这一小节</h2><p>点击顶部“编辑”进入双栏编辑；默认页面只优先显示渲染结果。</p></div></div>';
      const codeBlocks = [];
      md = md.replace(/```([\s\S]*?)```/g, (_, code) => { const id = `@@CODE${codeBlocks.length}@@`; const firstLine = code.split('\n')[0].trim(); let body = code; if (/^[a-zA-Z0-9#+-]+$/.test(firstLine)) body = code.split('\n').slice(1).join('\n'); codeBlocks.push(`<pre><code>${escapeHtml(body.trim())}</code></pre>`); return id; });
      let html = escapeHtml(md)
        .replace(/^###### (.*)$/gm, '<h6>$1</h6>').replace(/^##### (.*)$/gm, '<h5>$1</h5>').replace(/^#### (.*)$/gm, '<h4>$1</h4>').replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[\[图片:([^\]]+)\]\]/g, (full, id) => {
          const info = findNodeById(state.activeNodeId);
          const asset = info ? getImageAsset(info.node, id) : null;
          return asset?.src ? `<img alt="${escapeAttr(asset.name || '图片')}" src="${escapeAttr(asset.src)}" />` : '<span style="color:#ef4444">[图片丢失]</span>';
        })
        .replace(/!\[([^\]]*)\]\(asset:([^)]+)\)/g, (full, alt, id) => {
          const info = findNodeById(state.activeNodeId);
          const asset = info ? getImageAsset(info.node, id) : null;
          return asset?.src ? `<img alt="${escapeAttr(alt || asset.name || '图片')}" src="${escapeAttr(asset.src)}" />` : '<span style="color:#ef4444">[图片丢失]</span>';
        })
        .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, '<img alt="$1" src="$2" />')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      const lines = html.split('\n'); const out = []; let inUl=false, inQuote=false, tableBuffer=[];
      const flushUl=()=>{ if(inUl){out.push('</ul>'); inUl=false;} }; const flushQuote=()=>{ if(inQuote){out.push('</blockquote>'); inQuote=false;} };
      const flushTable=()=>{ if(!tableBuffer.length) return; if(tableBuffer.length>=2 && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(tableBuffer[1])) { const rows = tableBuffer.filter((_,i)=>i!==1).map(row=>row.replace(/^\||\|$/g,'').split('|').map(x=>x.trim())); const head = rows.shift() || []; out.push('<table><thead><tr>'+head.map(c=>`<th>${c}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>`<td>${c}</td>`).join('')+'</tr>').join('')+'</tbody></table>'); } else out.push(...tableBuffer.map(x=>`<p>${x}</p>`)); tableBuffer=[]; };
      for (const raw of lines) {
        const line = raw.trimEnd();
        if (line.startsWith('@@CODE')) { flushUl(); flushQuote(); flushTable(); out.push(line); continue; }
        if (/^\|.*\|$/.test(line.trim())) { flushUl(); flushQuote(); tableBuffer.push(line.trim()); continue; } else flushTable();
        if (/^[-*+]\s+/.test(line.trim())) { flushQuote(); if(!inUl){out.push('<ul>'); inUl=true;} out.push(`<li>${line.trim().replace(/^[-*+]\s+/, '')}</li>`); continue; } else flushUl();
        if (/^&gt;\s?/.test(line.trim())) { if(!inQuote){out.push('<blockquote>'); inQuote=true;} out.push(line.trim().replace(/^&gt;\s?/, '') + '<br>'); continue; } else flushQuote();
        if (/^<h\d|^<img|^<pre|^<table/.test(line.trim())) out.push(line); else if (line.trim()==='') out.push(''); else out.push(`<p>${line}</p>`);
      }
      flushUl(); flushQuote(); flushTable(); html = out.join('\n'); codeBlocks.forEach((block,i)=> html = html.replace(`@@CODE${i}@@`, block)); return html;
    }

    function escapeHtml(str) { return String(str).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }
    function escapeAttr(str) { return escapeHtml(str).replace(/'/g, '&#39;'); }

    function runSearch() {
      const q = els.globalSearch.value.trim(); if (!q) { els.searchResults.classList.remove('show'); els.searchResults.innerHTML=''; return; }
      const results=[];
      for (const subject of state.subjects) walk(subject.nodes, (node,parent,index,path) => { const content = [node.title,node.md,node.html].join('\n'); const pos = content.toLowerCase().indexOf(q.toLowerCase()); if(pos>=0){ const start=Math.max(0,pos-36), end=Math.min(content.length,pos+q.length+80); results.push({subject,node,path,snippet:content.slice(start,end)}); } });
      els.searchResults.innerHTML = results.length ? results.slice(0,50).map(r => `<div class="result-item" data-subject="${r.subject.id}" data-node="${r.node.id}"><div class="result-title">${highlight(r.node.title,q)}</div><div class="result-path">${escapeHtml(r.subject.name)} / ${r.path.map(p=>escapeHtml(p.title)).join(' / ')}</div><div class="result-snippet">${highlight(r.snippet.replace(/\n+/g,' '),q)}</div></div>`).join('') : '<div class="empty"><div><h2>没搜到</h2><p>换个关键词试试，例如“极限”“Cache”“死锁”。</p></div></div>';
      els.searchResults.classList.add('show');
      els.searchResults.querySelectorAll('.result-item').forEach(item => item.onclick = () => { saveCurrentNode(); state.activeSubjectId = item.dataset.subject; state.activeNodeId = item.dataset.node; const info = findNodeById(state.activeNodeId, getActiveSubject()); if (info) info.path.forEach(p => state.expanded[p.id] = true); els.globalSearch.value=''; els.searchResults.classList.remove('show'); renderAll(); showToast('已跳转到搜索结果所在小节'); });
    }
    function highlight(text,q){ const safe=escapeHtml(text); const reg=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig'); return safe.replace(reg,m=>`<mark>${m}</mark>`); }

    function renderMindmap() {
      const subject = getActiveSubject();
      els.outlineTitle.textContent = subject.name + ' · 全书思维框架';
      const levelName = ['章', '节', '小节', '点'];

      function titleMetrics(title, depth, childCount) {
        const chars = Array.from(String(title || ''));
        const weight = chars.reduce((sum, ch) => sum + (/[^\x00-\xff]/.test(ch) ? 1.65 : 0.9), 0);
        const baseFont = [17, 16, 15, 14][Math.min(depth, 3)];
        const font = Math.max(11, Math.min(baseFont, baseFont - Math.max(0, weight - 14) * 0.32));
        const extra = childCount ? 38 : 22;
        const minByDepth = [260, 230, 210, 180][Math.min(depth, 3)];
        const maxByDepth = [520, 480, 440, 380][Math.min(depth, 3)];
        const width = Math.round(Math.min(maxByDepth, Math.max(minByDepth, weight * font * 0.72 + 82 + extra)));
        return { font, width };
      }

      const make = (node, depth = 0) => {
        const div = document.createElement('div');
        const childCount = node.children?.length || 0;
        const m = titleMetrics(node.title, depth, childCount);
        div.className = 'mind-node depth-' + Math.min(depth, 3) + (childCount >= 3 ? ' has-many-children' : '');
        div.style.setProperty('--node-w', m.width + 'px');
        div.style.setProperty('--node-min-w', Math.max(160, m.width - 18) + 'px');
        const title = document.createElement('div');
        title.className = 'mind-node-title';
        title.dataset.level = levelName[Math.min(depth, levelName.length - 1)];
        title.title = '点击跳转到：' + node.title;
        title.style.fontSize = m.font + 'px';
        const text = document.createElement('span');
        text.className = 'mind-title-text';
        text.textContent = node.title;
        title.appendChild(text);
        title.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          els.outlineOverlay.classList.remove('show');
          selectNode(node.id);
        });
        div.appendChild(title);
        if (childCount) {
          const childBox = document.createElement('div');
          childBox.className = 'mind-children';
          node.children.forEach(c => childBox.appendChild(make(c, depth + 1)));
          div.appendChild(childBox);
        }
        return div;
      };
      const viewport = document.createElement('div');
      viewport.className = 'mindmap-viewport';
      const level = document.createElement('div');
      level.className = 'mind-level';
      level.style.setProperty('--mind-cols', Math.min(Math.max(subject.nodes.length, 1), 4));
      subject.nodes.forEach(n => level.appendChild(make(n, 0)));
      viewport.appendChild(level);
      els.mindmap.innerHTML = '';
      els.mindmap.appendChild(viewport);
    }

    function applyMindPan() {
      const viewport = els.mindmap.querySelector('.mindmap-viewport');
      if (!viewport) return;
      viewport.style.transform = `translate(${mindPan.x}px, ${mindPan.y}px) scale(${mindPan.scale})`;
    }

    function centerMindmap() {
      const viewport = els.mindmap.querySelector('.mindmap-viewport');
      if (!viewport) return;
      mindPan.scale = 1;
      const viewW = viewport.offsetWidth;
      const viewH = viewport.offsetHeight;
      mindPan.x = Math.round((els.mindmap.clientWidth - viewW) / 2);
      mindPan.y = Math.round(Math.max(12, (els.mindmap.clientHeight - viewH) / 2));
      mindPan.moved = false;
      applyMindPan();
    }

    function bindMindmapPan() {
      const map = els.mindmap;
      if (!map || map.dataset.panBound) return;
      map.dataset.panBound = '1';
      map.addEventListener('pointerdown', e => {
        if (!els.outlineOverlay.classList.contains('show')) return;
        if (e.target.closest('button') || e.target.closest('.mind-node-title')) return;
        mindPan.dragging = true;
        mindPan.moved = false;
        mindPan.startX = e.clientX;
        mindPan.startY = e.clientY;
        mindPan.baseX = mindPan.x;
        mindPan.baseY = mindPan.y;
        map.classList.add('dragging');
        map.setPointerCapture?.(e.pointerId);
      });
      map.addEventListener('pointermove', e => {
        if (!mindPan.dragging) return;
        const dx = e.clientX - mindPan.startX;
        const dy = e.clientY - mindPan.startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) mindPan.moved = true;
        mindPan.x = mindPan.baseX + dx;
        mindPan.y = mindPan.baseY + dy;
        applyMindPan();
      });
      const stopDrag = e => {
        if (!mindPan.dragging) return;
        mindPan.dragging = false;
        map.classList.remove('dragging');
        try { map.releasePointerCapture?.(e.pointerId); } catch (err) {}
        setTimeout(() => { mindPan.moved = false; }, 80);
      };
      map.addEventListener('pointerup', stopDrag);
      map.addEventListener('pointercancel', stopDrag);
      map.addEventListener('pointerleave', stopDrag);
      map.addEventListener('wheel', e => {
        if (!els.outlineOverlay.classList.contains('show')) return;
        e.preventDefault();
        const rect = map.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const oldScale = mindPan.scale;
        const nextScale = Math.min(1.35, Math.max(0.72, oldScale * (e.deltaY < 0 ? 1.06 : 0.94)));
        mindPan.x = px - (px - mindPan.x) * (nextScale / oldScale);
        mindPan.y = py - (py - mindPan.y) * (nextScale / oldScale);
        mindPan.scale = nextScale;
        applyMindPan();
      }, { passive: false });
    }
    function toggleFullscreen(target=document.documentElement){ if(!document.fullscreenElement) target.requestFullscreen?.(); else document.exitFullscreen?.(); }
    function exportData(){
      saveCurrentNode();
      const backup = {
        app: '11408-notes-web-app',
        version: 3,
        exportedAt: new Date().toISOString(),
        data: state
      };
      const text = JSON.stringify(backup, null, 2);
      const filename = '11408-notes-full-backup-' + new Date().toISOString().slice(0,10) + '.json';
      openExportDownloadPanel(filename, text, true);
    }

    function openExportDownloadPanel(filename, text, autoDownload = false) {
      const oldPanel = document.getElementById('exportDownloadMask');
      if (oldPanel) oldPanel.remove();

      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const mask = document.createElement('div');
      mask.id = 'exportDownloadMask';
      mask.style.cssText = 'position:fixed;inset:0;z-index:180;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.46);backdrop-filter:blur(10px);';

      const panel = document.createElement('div');
      panel.style.cssText = 'width:min(520px,94vw);background:#fff;border:1px solid #e5e7eb;border-radius:22px;box-shadow:0 30px 90px rgba(15,23,42,.28);padding:18px;color:#172033;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",Arial,sans-serif;';

      panel.innerHTML = `
        <div style="font-size:18px;font-weight:900;margin-bottom:6px;">备份文件已生成</div>
        <div style="font-size:13px;line-height:1.7;color:#64748b;margin-bottom:14px;">
          如果浏览器没有自动下载，请点下面的“下载JSON备份”。手机浏览器有时会把文件保存到“下载/文件”App里。
        </div>
        <a id="exportRealDownloadLink"
           download="${escapeAttr(filename)}"
           href="${url}"
           style="display:block;text-align:center;text-decoration:none;background:#2563eb;color:#fff;border-radius:14px;padding:12px 14px;font-weight:900;margin-bottom:10px;">
          下载JSON备份
        </a>
        <button id="exportCopyBackupBtn"
                style="width:100%;border:0;border-radius:14px;padding:11px 14px;background:#eff6ff;color:#2563eb;font-weight:800;margin-bottom:10px;">
          复制JSON文本到剪贴板
        </button>
        <button id="exportCloseBtn"
                style="width:100%;border:0;border-radius:14px;padding:10px 14px;background:#f8fafc;color:#172033;">
          关闭
        </button>
      `;

      mask.appendChild(panel);
      document.body.appendChild(mask);

      const link = panel.querySelector('#exportRealDownloadLink');
      const close = () => {
        URL.revokeObjectURL(url);
        mask.remove();
      };

      panel.querySelector('#exportCloseBtn').onclick = close;
      mask.addEventListener('click', (e) => { if (e.target === mask) close(); });

      panel.querySelector('#exportCopyBackupBtn').onclick = async () => {
        try {
          await navigator.clipboard.writeText(text);
          showToast('已复制JSON文本');
        } catch (err) {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          try {
            document.execCommand('copy');
            showToast('已复制JSON文本');
          } catch (copyErr) {
            alert('复制失败，请使用“下载JSON备份”按钮。');
          }
          ta.remove();
        }
      };

      if (autoDownload) {
        setTimeout(() => {
          try {
            link.click();
            showToast('备份已生成，请检查浏览器下载记录或点击弹窗按钮下载');
          } catch (err) {
            showToast('自动下载被浏览器拦截，请点击弹窗里的下载按钮');
          }
        }, 80);
      }
    }

    function normalizeImportedData() {
      for (const subject of state.subjects || []) {
        walk(subject.nodes || [], node => {
          if (typeof node.html !== 'string') node.html = '';
          if (typeof node.md !== 'string') node.md = '';
          ensureNodeAssets(node);
          compactInlineBase64Images(node);
          const htmlText = node.html.trim();
          if (htmlText.includes('HTML 渲染窗口示例') && htmlText.includes('a^2+b^2=c^2')) node.html = '';
        });
      }
    }

    function bindEvents() {
      bindMindmapPan();
      $('#modeToggleBtn').onclick = () => { saveCurrentNode(); state.uiMode = state.uiMode === 'preview' ? 'edit' : 'preview'; applyMode(); renderEditor(); scheduleSave(); };
      $('#mobileMenuBtn').onclick = () => els.sidebar.classList.toggle('show');
      $('#htmlGlobalBtn').onclick = openHtmlCenter;
      $('#htmlCenterCloseBtn').onclick = closeHtmlCenter;
      $('#htmlCenterFullBtn').onclick = () => toggleFullscreen(els.htmlCenterPanel);
      els.htmlCenterMask.addEventListener('click', e => { if (e.target === els.htmlCenterMask) closeHtmlCenter(); });
      $('#addRootBtn').onclick = addRoot; $('#addChildBtn').onclick = () => addChild(); $('#addSiblingBtn').onclick = addSibling; $('#moveUpBtn').onclick = () => moveActiveNode(-1); $('#moveDownBtn').onclick = () => moveActiveNode(1); $('#deleteNodeBtn').onclick = deleteNode;
      $('#prevBtn').onclick = () => goPrevNext(-1); $('#nextBtn').onclick = () => goPrevNext(1);
      $('#fullscreenBtn').onclick = () => toggleFullscreen(document.documentElement);
      $('#outlineBtn').onclick = () => { renderMindmap(); els.outlineOverlay.classList.add('show'); requestAnimationFrame(centerMindmap); };
      $('#closeOutlineBtn').onclick = () => els.outlineOverlay.classList.remove('show'); $('#outlineCenterBtn').onclick = centerMindmap; $('#outlineFullBtn').onclick = () => toggleFullscreen(document.querySelector('.outline-shell'));
      $('#focusEditBtn').onclick = () => toggleFullscreen(document.querySelector('.editor-card')); $('#focusPreviewBtn').onclick = () => toggleFullscreen(document.querySelector('.preview-card'));
      $('#exportBtn').onclick = exportData; $('#importBtn').onclick = () => { els.importText.value=''; els.importMask.classList.add('show'); };
      $('#importCancel').onclick = () => els.importMask.classList.remove('show');
      $('#importFileBtn').onclick = () => $('#importFileInput').click();
      $('#importFileInput').onchange = e => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const raw = JSON.parse(reader.result);
            const data = raw.data && raw.data.subjects ? raw.data : raw;
            if(!data.subjects || !Array.isArray(data.subjects)) throw new Error('格式不正确');
            state = data;
            state.uiMode ||= 'preview';
            state.htmlVisible = state.htmlVisible !== false;
            normalizeImportedData();
            await idbSet(DATA_KEY,state);
            els.importMask.classList.remove('show');
            renderAll();
            showToast('已从 JSON 文件导入完整备份');
          } catch(err) {
            alert('导入失败：JSON 文件格式不正确');
          }
        };
        reader.readAsText(file, 'utf-8');
        e.target.value = '';
      };
      $('#importOk').onclick = async () => {
        try {
          const raw = JSON.parse(els.importText.value);
          const data = raw.data && raw.data.subjects ? raw.data : raw;
          if(!data.subjects || !Array.isArray(data.subjects)) throw new Error('格式不正确');
          state=data;
          state.uiMode ||= 'preview';
          state.htmlVisible = state.htmlVisible !== false;
          normalizeImportedData();
          await idbSet(DATA_KEY,state);
          els.importMask.classList.remove('show');
          renderAll();
          showToast('导入成功，已恢复文字、图片和HTML代码');
        } catch(e){ alert('导入失败：JSON 格式不正确'); }
      };
      els.titleInput.addEventListener('input', () => { onEditorInput(); renderTree(); }); els.mdEditor.addEventListener('input', onEditorInput); els.htmlEditor.addEventListener('input', onEditorInput); els.globalSearch.addEventListener('input', runSearch);
      document.addEventListener('click', e => { if(!els.searchResults.contains(e.target) && !els.globalSearch.contains(e.target)) els.searchResults.classList.remove('show'); });
      $('#toolbar').addEventListener('click', e => { const btn=e.target.closest('button'); if(!btn) return; if(btn.dataset.md) insertAtCursor(btn.dataset.md); if(btn.dataset.wrap) insertAtCursor(btn.dataset.wrap,true); if(btn.dataset.block) insertAtCursor(btn.dataset.block); });
      $('#imageBtn').onclick = () => $('#imageInput').click();
      $('#imageInput').onchange = e => { const file=e.target.files[0]; if(!file) return; const info = findNodeById(state.activeNodeId); if(!info) return; const reader=new FileReader(); reader.onload=()=>{ const id = addImageAsset(info.node, file.name, reader.result); insertAtCursor(`
[[图片:${id}]]
`); showToast('图片已插入：编辑区只显示短标签，原图已保存到备份数据'); }; reader.readAsDataURL(file); e.target.value=''; };
      $('#modalCancel').onclick = () => closeModal(null); $('#modalOk').onclick = () => closeModal(els.modalInput.value.trim()); els.modalInput.addEventListener('keydown', e => { if(e.key==='Enter') closeModal(els.modalInput.value.trim()); });
      els.modalMask.addEventListener('click', e => { if(e.target===els.modalMask) closeModal(null); }); els.outlineOverlay.addEventListener('click', e => { if(e.target===els.outlineOverlay) els.outlineOverlay.classList.remove('show'); });
      window.addEventListener('beforeunload', () => saveCurrentNode());
      document.addEventListener('keydown', e => {
        if(e.key === 'Escape' && els.htmlCenterMask.classList.contains('show')) closeHtmlCenter();
        if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){ e.preventDefault(); saveCurrentNode(); idbSet(DATA_KEY,state); showToast('已手动保存'); }
        if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){ e.preventDefault(); els.globalSearch.focus(); }
      });
    }

    async function init() {
      bindEvents();
      const saved = await idbGet(DATA_KEY).catch(() => null);
      state = saved || defaultData();
      state.uiMode ||= 'preview'; state.htmlVisible = state.htmlVisible !== false;
      normalizeImportedData();
      for (const subject of state.subjects) walk(subject.nodes, node => { if (state.expanded[node.id] === undefined) state.expanded[node.id] = true; });
      renderAll(); await idbSet(DATA_KEY, state);
    }
    init();
