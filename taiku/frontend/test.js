
let data = [];
let filtered = [];
let currentBrand = null;
let currentModel = null;
let searchTerm = '';
let brandCache = {};

let lbIdx = -1;
let lbItems = [];
let lbZoom = 1;
let lbRotate = 0;
let lbAnnotMode = false;
let annotColor = '#ff4444';
let annotSize = 3;
let annotTool = 'free';
let annotHistory = [];
let isDrawing = false;
let startX, startY;
let freePoints = null;
let editMode = false;
let selectedAnnot = -1;

let appMode = localStorage.getItem('app_mode') || 'local';
let baiduClientId = localStorage.getItem('baidu_client_id') || 'e7YWOrooVeE6TMeXINOqakRpfErFLGTk';
let baiduClientSecret = localStorage.getItem('baidu_client_secret') || '';
let baiduRootPath = localStorage.getItem('baidu_root_path') || '/来自：本地电脑/7维德软件备份/ERS Tech手机短接图和ISP图';
let baiduAccessToken = localStorage.getItem('baidu_access_token') || '';
let baiduRefreshToken = localStorage.getItem('baidu_refresh_token') || '';

let baiduFileCache = {}; // key: "brand/model/file" -> fs_id
let baiduMetadataFsId = null;

function invoke(cmd, args) {
  return window.__TAURI_INTERNALS__.invoke(cmd, args || {});
}

async function init() {
  appMode = localStorage.getItem('app_mode') || 'local';
  baiduClientId = localStorage.getItem('baidu_client_id') || 'e7YWOrooVeE6TMeXINOqakRpfErFLGTk';
  baiduClientSecret = localStorage.getItem('baidu_client_secret') || '';
  baiduRootPath = localStorage.getItem('baidu_root_path') || '/来自：本地电脑/7维德软件备份/ERS Tech手机短接图和ISP图';
  baiduAccessToken = localStorage.getItem('baidu_access_token') || '';
  baiduRefreshToken = localStorage.getItem('baidu_refresh_token') || '';

  document.getElementById('setting-mode').value = appMode;
  document.getElementById('setting-client-id').value = baiduClientId;
  document.getElementById('setting-client-secret').value = baiduClientSecret;
  document.getElementById('setting-root-path').value = baiduRootPath;
  updateBaiduStatus();

  try {
    document.getElementById('stats').textContent = '正在加载数据...';
    if (appMode === 'local') {
      const json = await invoke('get_metadata');
      const cleanJson = json.replace(/^\uFEFF/, '');
      data = JSON.parse(cleanJson);
      document.getElementById('stats').textContent = `${data.length} 个型号 · ${data.reduce((s, e) => s + e.fileCount, 0)} 张图片`;
    } else {
      data = await loadCloudMetadata();
      document.getElementById('stats').textContent = `${data.length} 个型号 (云端) · ${data.reduce((s, e) => s + e.fileCount, 0)} 张图片`;
    }
    buildBrandSidebar();
  } catch (e) {
    document.getElementById('stats').textContent = '加载失败';
    document.getElementById('empty').innerHTML = '<div class="big">⚠️</div><div>数据加载失败<br><small>' + (e.message || e) + '</small></div>';
  }
}

async function loadCloudMetadata() {
  if (!baiduAccessToken) {
    throw new Error('未检测到百度网盘授权，请在“设置”中完成登录授权。');
  }
  const listJson = await invoke('baidu_list_files', { accessToken: baiduAccessToken, path: baiduRootPath });
  const listData = JSON.parse(listJson);
  if (listData.errno !== 0) {
    let msg = `网盘返回错误码 (errno: ${listData.errno})。`;
    if (listData.errno === 31066 || listData.errno === 31064 || listData.errno === -9) {
      msg += `<br><br><b>💡 排查建议:</b><br>` +
             `您的百度开放平台应用可能为默认的 <b>【应用数据 (App Folder)】</b> 类型。<br>` +
             `该类型应用<b>无权访问</b>沙盒目录以外的文件夹（如 "/来自：本地电脑/..."）。<br><br>` +
             `<b>如何解决：</b><br>` +
             `1. 在百度网盘中，将图纸和 metadata.json 移动到网盘的 <code>/应用/您的应用名称/</code> 目录下。<br>` +
             `2. 在软件设置中，将“网盘根目录路径”修改为 <code>/apps/您的应用名称</code> 并保存重载。`;
    } else {
      msg += `请检查根目录路径是否正确，或者重新进行登录授权。`;
    }
    throw new Error(msg);
  }
  const files = listData.list || [];
  const metaFile = files.find(f => f.server_filename === 'metadata.json');
  if (!metaFile) {
    const foundNames = files.map(f => f.server_filename).join(', ');
    throw new Error(`在目录 ${baiduRootPath} 下未找到 metadata.json 文件！<br><br><b>📁 该目录下检测到的文件/文件夹有:</b><br>[ ${foundNames || '空目录' } ]`);
  }
  baiduMetadataFsId = String(metaFile.fs_id);
  const metaText = await invoke('baidu_get_text_file', { accessToken: baiduAccessToken, fsId: baiduMetadataFsId });
  const cleanText = metaText.replace(/^\uFEFF/, '');
  return JSON.parse(cleanText);
}

async function prefetchCloudModelFiles(brand, model) {
  const cacheKeyFolder = `${brand}/${model}`;
  if (baiduFileCache[cacheKeyFolder]) return;
  baiduFileCache[cacheKeyFolder] = 'loading';
  try {
    const modelPath = `${baiduRootPath}/${brand}/${model}`.replace(/\/+/g, '/');
    const listJson = await invoke('baidu_list_files', { accessToken: baiduAccessToken, path: modelPath });
    const listData = JSON.parse(listJson);
    if (listData.errno === 0) {
      const files = listData.list || [];
      files.forEach(f => {
        const key = `${brand}/${model}/${f.server_filename}`;
        baiduFileCache[key] = String(f.fs_id);
      });
      baiduFileCache[cacheKeyFolder] = 'loaded';
    } else {
      baiduFileCache[cacheKeyFolder] = null;
    }
  } catch (e) {
    console.error(e);
    baiduFileCache[cacheKeyFolder] = null;
  }
}

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

async function getImageUrl(brand, model, file) {
  if (appMode === 'local') {
    try {
      return await invoke('read_image_base64', { brand, model, file });
    } catch (e) {
      console.error(e);
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140"><rect fill="%23161b22" width="200" height="140"/><text fill="%238b949e" font-size="12" x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">加载失败</text></svg>';
    }
  } else {
    try {
      const cacheKey = `${brand}/${model}/${file}`;
      let fsId = baiduFileCache[cacheKey];
      if (!fsId) {
        const cacheKeyFolder = `${brand}/${model}`;
        if (baiduFileCache[cacheKeyFolder] === 'loading') {
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 200));
            fsId = baiduFileCache[cacheKey];
            if (fsId) break;
          }
        }
        if (!fsId) {
          await prefetchCloudModelFiles(brand, model);
          fsId = baiduFileCache[cacheKey];
        }
      }
      if (!fsId) {
        throw new Error('文件不存在');
      }
      return await invoke('baidu_get_image', { accessToken: baiduAccessToken, fsId: fsId });
    } catch (e) {
      console.error(e);
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140"><rect fill="%23161b22" width="200" height="140"/><text fill="%238b949e" font-size="12" x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">云端加载失败</text></svg>';
    }
  }
}

function buildBrandSidebar(searchOnly) {
  const sidebar = document.getElementById('sidebar');
  const brands = {};
  data.forEach(item => {
    if (!brands[item.brand]) brands[item.brand] = { models: [], total: 0 };
    if (!brands[item.brand].models.includes(item.model)) brands[item.brand].models.push(item.model);
    brands[item.brand].total += item.fileCount;
  });

  if (searchOnly && searchTerm) {
    const term = searchTerm.toLowerCase();
    for (const b in brands) {
      let hasMatch = false;
      for (const m of brands[b].models) {
        if (b.toLowerCase().includes(term) || m.toLowerCase().includes(term)) { hasMatch = true; break }
        const entry = data.find(d => d.brand === b && d.model === m);
        if (entry && entry.files.some(f => f.toLowerCase().includes(term))) { hasMatch = true; break }
      }
      if (!hasMatch) delete brands[b];
    }
  }

  const sorted = Object.keys(brands).sort();
  brandCache = brands;
  sidebar.innerHTML = '';

  sorted.forEach(brand => {
    const b = brands[brand];
    const isActive = brand === currentBrand;
    const div = document.createElement('div');
    div.className = 'brand' + (isActive ? ' active' : '');
    div.innerHTML = `<span class="arrow ${isActive ? 'open' : ''}">▶</span><span>${brand}</span><span class="count">${b.models.length}</span>`;
    div.onclick = () => selectBrand(brand);
    sidebar.appendChild(div);

    if (isActive) {
      b.models.sort().forEach(model => {
        const md = document.createElement('div');
        md.className = 'model' + (model === currentModel ? ' active' : '');
        const entry = data.find(d => d.brand === brand && d.model === model);
        const fc = entry ? entry.fileCount : 0;
        md.innerHTML = `<span class="icon">📄</span>${model} <span class="count">${fc}</span>`;
        md.onclick = (e) => { e.stopPropagation(); selectModel(brand, model) };
        sidebar.appendChild(md);
      });
    }
  });
}

function selectBrand(brand) {
  if (brand === currentBrand) {
    currentBrand = null;
    currentModel = null;
    closeViewer();
    document.getElementById('grid').style.display = 'none';
    document.getElementById('empty').style.display = 'flex';
    document.getElementById('empty').innerHTML = '<div class="big">📱</div><div>选择一个品牌开始浏览</div>';
    buildBrandSidebar(!!searchTerm);
    return;
  }
  currentBrand = brand;
  currentModel = null;
  const b = brandCache[brand];
  if (b && b.models.length > 0) {
    selectModel(brand, b.models.sort()[0]);
  }
  buildBrandSidebar(!!searchTerm);
}

function selectModel(brand, model) {
  closeViewer();
  currentBrand = brand;
  currentModel = model;
  renderGrid(brand, model);
  buildBrandSidebar(!!searchTerm);
}

async function renderGrid(brand, model) {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  grid.style.display = 'none';
  empty.style.display = 'flex';
  empty.innerHTML = '<div class="big">⏳</div><div>正在加载列表中...</div>';

  if (appMode === 'cloud' && brand && model) {
    await prefetchCloudModelFiles(brand, model);
  }

  let items = [];
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    const seen = new Set();
    data.forEach(entry => {
      const b = entry.brand.toLowerCase();
      const m = entry.model.toLowerCase();
      const brandMatch = b.includes(term);
      const modelMatch = m.includes(term);
      entry.files.forEach(f => {
        const fm = f.toLowerCase();
        if (brandMatch || modelMatch || fm.includes(term)) {
          const k = `${entry.brand}|${entry.model}|${f}`;
          if (!seen.has(k)) { seen.add(k); items.push({ brand: entry.brand, model: entry.model, file: f }); }
        }
      });
    });
  } else if (brand && model) {
    const entry = data.find(d => d.brand === brand && d.model === model);
    if (entry) items = entry.files.map(f => ({ brand, model, file: f }));
  } else if (brand) {
    data.filter(d => d.brand === brand).forEach(entry => {
      entry.files.forEach(f => items.push({ brand: entry.brand, model: entry.model, file: f }));
    });
  }

  if (items.length === 0) {
    empty.style.display = 'flex';
    empty.innerHTML = searchTerm ? `<div class="big">🔍</div><div>未找到匹配 "${searchTerm}"</div>` : '<div class="big">📱</div><div>请选择一个型号</div>';
    return;
  }

  empty.style.display = 'none';
  grid.style.display = 'grid';
  lbItems = items;

  const frag = document.createDocumentFragment();
  items.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<img class="thumb" src="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22140%22><rect fill=%22%23161b22%22 width=%22200%22 height=%22140%22/></svg>" alt="${item.file}">
      <div class="info"><div class="model-name">${item.model}</div><div class="file-name">${item.file}</div></div>`;
    card.onclick = () => openViewer(idx);
    frag.appendChild(card);
    getImageUrl(item.brand, item.model, item.file).then(url => {
      card.querySelector('.thumb').src = url;
    });
  });
  grid.innerHTML = '';
  grid.appendChild(frag);
}

document.getElementById('search').addEventListener('input', function() {
  searchTerm = this.value.trim();
  if (searchTerm) {
    currentBrand = null;
    currentModel = null;
    buildBrandSidebar(true);
    const term = searchTerm.toLowerCase();
    const seen = new Set();
    const items = [];
    data.forEach(entry => {
      const b = entry.brand.toLowerCase();
      const m = entry.model.toLowerCase();
      const brandMatch = b.includes(term);
      const modelMatch = m.includes(term);
      entry.files.forEach(f => {
        const fm = f.toLowerCase();
        if (brandMatch || modelMatch || fm.includes(term)) {
          const k = `${entry.brand}|${entry.model}|${f}`;
          if (!seen.has(k)) { seen.add(k); items.push({ brand: entry.brand, model: entry.model, file: f }); }
        }
      });
    });
    if (items.length > 0) {
      lbItems = items;
      document.getElementById('grid').style.display = 'none';
      document.getElementById('empty').style.display = 'none';
      document.getElementById('viewer').style.display = 'flex';
      openViewer(0);
    } else {
      document.getElementById('grid').style.display = 'none';
      document.getElementById('viewer').style.display = 'none';
      document.getElementById('empty').style.display = 'flex';
      document.getElementById('empty').innerHTML = `<div class="big">🔍</div><div>未找到匹配 "${searchTerm}"</div>`;
    }
  } else {
    searchTerm = '';
    buildBrandSidebar();
    document.getElementById('grid').style.display = 'none';
    document.getElementById('viewer').style.display = 'none';
    document.getElementById('empty').style.display = 'flex';
    document.getElementById('empty').innerHTML = '<div class="big">📱</div><div>选择一个品牌开始浏览</div>';
  }
});

function openViewer(idx) {
  lbIdx = idx;
  lbZoom = 1;
  lbRotate = 0;
  const item = lbItems[idx];
  if (!item) return;
  
  document.getElementById('grid').style.display = 'none';
  document.getElementById('empty').style.display = 'none';
  document.getElementById('viewer').style.display = 'flex';
  
  // Set the info
  const vtitle = document.getElementById('v-title');
  if(vtitle) vtitle.textContent = `${item.brand} > ${item.model} > ${item.file} (${idx + 1}/${lbItems.length})`;
  
  document.getElementById('main-title').style.display = 'none';
  document.getElementById('stats').style.display = 'none';
  document.getElementById('search').style.display = 'none';
  document.getElementById('header-viewer-tools').style.display = 'flex';
  
  const img = document.getElementById('v-img');
  const canvas = document.getElementById('v-canvas');
  img.style.transform = '';
  canvas.classList.remove('active');
  annotHistory = [];
  lbAnnotMode = false;
  document.getElementById('v-annot-btn').classList.remove('active');
  document.getElementById('annot-tools').classList.remove('show');
  document.getElementById('v-filename').textContent = item.file;
  updateNavOverlay();

  const setupCanvas = () => {
    requestAnimationFrame(() => {
      const rect = img.getBoundingClientRect();
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      loadAnnotations();
    });
  };

  img.onload = setupCanvas;
  getImageUrl(item.brand, item.model, item.file).then(url => {
    img.src = url;
  });
}

function fitCanvasToScreen() {
  const img = document.getElementById('v-img');
  const canvas = document.getElementById('v-canvas');
  const rect = img.getBoundingClientRect();
  if (rect.width > 0) {
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }
}

function closeViewer() {
  document.getElementById('viewer').style.display = 'none';
  document.getElementById('grid').style.display = '';
  document.getElementById('main-title').style.display = 'block';
  document.getElementById('search').style.display = 'block';
  document.getElementById('stats').style.display = 'block';
  document.getElementById('header-viewer-tools').style.display = 'none';
  lbAnnotMode = false;
  document.getElementById('v-annot-btn').classList.remove('active');
  document.getElementById('annot-tools-inline').style.display = 'none';
}

function zoomIn() { lbZoom = Math.min(lbZoom + 0.25, 5); applyTransform() }
function zoomOut() { lbZoom = Math.max(lbZoom - 0.25, 0.25); applyTransform() }
function resetView() { lbZoom = 1; lbRotate = 0; applyTransform() }
function rotateImg(deg) { lbRotate = (lbRotate + deg) % 360; applyTransform() }
function applyTransform() {
  document.getElementById('v-img').style.transform = `scale(${lbZoom}) rotate(${lbRotate}deg)`;
  const badge = document.getElementById('v-zoom-badge');
  if (badge) {
    badge.textContent = Math.round(lbZoom * 100) + '%';
    badge.classList.add('show');
    clearTimeout(badge._hide);
    badge._hide = setTimeout(() => badge.classList.remove('show'), 1500);
  }
}

function prevImage() {
  if (!currentBrand || !currentModel) return;
  const models = (brandCache[currentBrand] && brandCache[currentBrand].models) || [];
  const sorted = models.slice().sort();
  const idx = sorted.indexOf(currentModel);
  if (idx > 0) {
    const prevModel = sorted[idx - 1];
    currentModel = prevModel;
    const entry = data.find(d => d.brand === currentBrand && d.model === prevModel);
    if (entry && entry.files.length > 0) {
      lbItems = entry.files.map(f => ({ brand: currentBrand, model: prevModel, file: f }));
      openViewer(0);
      updateNavOverlay();
      buildBrandSidebar(!!searchTerm);
      scrollSidebarToModel(prevModel);
    }
  }
}
function nextImage() {
  if (!currentBrand || !currentModel) return;
  const models = (brandCache[currentBrand] && brandCache[currentBrand].models) || [];
  const sorted = models.slice().sort();
  const idx = sorted.indexOf(currentModel);
  if (idx < sorted.length - 1) {
    const nextModel = sorted[idx + 1];
    currentModel = nextModel;
    const entry = data.find(d => d.brand === currentBrand && d.model === nextModel);
    if (entry && entry.files.length > 0) {
      lbItems = entry.files.map(f => ({ brand: currentBrand, model: nextModel, file: f }));
      openViewer(0);
      updateNavOverlay();
      buildBrandSidebar(!!searchTerm);
      scrollSidebarToModel(nextModel);
    }
  }
}

function scrollSidebarToModel(modelName) {
  const models = document.querySelectorAll('#sidebar .model');
  for (const m of models) {
    if (m.textContent.includes(modelName)) {
      m.scrollIntoView({ block: 'center', behavior: 'smooth' });
      break;
    }
  }
}

function updateNavOverlay() {
  const prevBtn = document.getElementById('v-nav-prev');
  const nextBtn = document.getElementById('v-nav-next');
  if (!currentBrand || !currentModel) return;
  const models = (brandCache[currentBrand] && brandCache[currentBrand].models) || [];
  const sorted = models.slice().sort();
  const idx = sorted.indexOf(currentModel);
  if (prevBtn) prevBtn.classList.toggle('disabled', idx <= 0);
  if (nextBtn) nextBtn.classList.toggle('disabled', idx >= sorted.length - 1);
}

function openImageInNewTab() {
  const img = document.getElementById('v-img');
  if (img && img.src) window.open(img.src, '_blank');
}

document.getElementById('v-body').addEventListener('wheel', e => {
  if (e.deltaY < 0) zoomIn(); else zoomOut();
  e.preventDefault();
}, { passive: false });

function toggleAnnot() {
  lbAnnotMode = !lbAnnotMode;
  const btn = document.getElementById('v-annot-btn');
  const tools = document.getElementById('annot-tools-inline');
  const canvas = document.getElementById('v-canvas');
  btn.classList.toggle('active');
  tools.style.display = lbAnnotMode ? 'flex' : 'none';
  canvas.classList.toggle('active');
  if (!lbAnnotMode) { editMode = false; document.getElementById('v-edit-btn').classList.remove('edit-active'); canvas.classList.remove('edit-mode'); }
  if (lbAnnotMode) {
    fitCanvasToScreen();
  }
}

function setAnnotColor(v) { annotColor = v }
function setAnnotSize(v) { annotSize = v }
function setTool(tool) { annotTool = tool;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tool-btn[data-tool="${tool}"]`).classList.add('active');
}

const canvas = document.getElementById('v-canvas');
const ctx = canvas.getContext('2d');

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('mouseleave', endDraw);
canvas.addEventListener('touchstart', e => { const t = e.touches[0]; startDraw({ offsetX: t.clientX - canvas.getBoundingClientRect().left, offsetY: t.clientY - canvas.getBoundingClientRect().top, preventDefault: () => {} }); e.preventDefault() }, { passive: false });
canvas.addEventListener('touchmove', e => { const t = e.touches[0]; draw({ offsetX: t.clientX - canvas.getBoundingClientRect().left, offsetY: t.clientY - canvas.getBoundingClientRect().top, preventDefault: () => {} }); e.preventDefault() }, { passive: false });
canvas.addEventListener('touchend', endDraw);

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function startDraw(e) {
  if (!lbAnnotMode) return;
  isDrawing = true;
  const pos = e.offsetX !== undefined ? { x: e.offsetX * (canvas.width / canvas.getBoundingClientRect().width), y: e.offsetY * (canvas.height / canvas.getBoundingClientRect().height) } : getCanvasPos(e);
  startX = pos.x; startY = pos.y;
  if (annotTool === 'free') { freePoints = [{ x: pos.x, y: pos.y }] }
  else if (annotTool === 'text') {
    const text = prompt('输入标注文字:');
    if (text) {
      annotHistory.push({ type: 'text', x: startX, y: startY, text, color: annotColor, size: annotSize });
      redrawCanvas(); saveAnnotations();
    }
    isDrawing = false;
  }
}

function draw(e) {
  if (!isDrawing || !lbAnnotMode || annotTool === 'text') return;
  const pos = e.offsetX !== undefined ? { x: e.offsetX * (canvas.width / canvas.getBoundingClientRect().width), y: e.offsetY * (canvas.height / canvas.getBoundingClientRect().height) } : getCanvasPos(e);
  redrawCanvas();
  ctx.beginPath();
  ctx.strokeStyle = annotColor;
  ctx.lineWidth = annotSize;
  ctx.fillStyle = annotColor;
  if (annotTool === 'free') {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    freePoints.push({ x: pos.x, y: pos.y });
    if (freePoints.length > 1) {
      ctx.moveTo(freePoints[freePoints.length - 2].x, freePoints[freePoints.length - 2].y);
      ctx.lineTo(pos.x, pos.y);
    }
    ctx.stroke();
  } else if (annotTool === 'arrow') {
    const angle = Math.atan2(pos.y - startY, pos.x - startX);
    const len = Math.sqrt((pos.x - startX) ** 2 + (pos.y - startY) ** 2);
    if (len < 5) return;
    ctx.moveTo(startX, startY); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    const hl = Math.min(15, len * 0.3);
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x - hl * Math.cos(angle - 0.4), pos.y - hl * Math.sin(angle - 0.4));
    ctx.lineTo(pos.x - hl * Math.cos(angle + 0.4), pos.y - hl * Math.sin(angle + 0.4));
    ctx.closePath(); ctx.fill();
  } else if (annotTool === 'line') {
    ctx.moveTo(startX, startY); ctx.lineTo(pos.x, pos.y); ctx.stroke();
  } else if (annotTool === 'circle') {
    const cx = (startX + pos.x) / 2, cy = (startY + pos.y) / 2;
    const rx = Math.abs(pos.x - startX) / 2, ry = Math.abs(pos.y - startY) / 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (annotTool === 'rect') {
    ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
  }
}

function endDraw(e) {
  if (!isDrawing || !lbAnnotMode) return;
  isDrawing = false;
  if (annotTool === 'free' && freePoints && freePoints.length > 1) {
    annotHistory.push({ type: 'free', points: freePoints.slice(), color: annotColor, size: annotSize });
    freePoints = null;
    redrawCanvas(); saveAnnotations();
  } else if (annotTool !== 'text') {
    const pos = e && e.offsetX !== undefined ? { x: e.offsetX * (canvas.width / canvas.getBoundingClientRect().width), y: e.offsetY * (canvas.height / canvas.getBoundingClientRect().height) } : { x: startX, y: startY };
    annotHistory.push({ type: annotTool, x1: startX, y1: startY, x2: pos.x, y2: pos.y, color: annotColor, size: annotSize });
    redrawCanvas(); saveAnnotations();
  }
  freePoints = null;
}

async function saveAnnotations() {
  if (!lbItems[lbIdx]) return;
  const item = lbItems[lbIdx];
  const key = `${item.brand}|${item.model}|${item.file}`;
  const content = JSON.stringify(annotHistory);
  localStorage.setItem('annot_' + key, content);
  try {
    await invoke('save_annotation', { brand: item.brand, model: item.model, file: item.file, content });
  } catch (e) {
    console.error('保存标注文件失败:', e);
  }
}

async function loadAnnotations() {
  if (!lbItems[lbIdx]) return;
  const item = lbItems[lbIdx];
  const key = `${item.brand}|${item.model}|${item.file}`;
  try {
    const content = await invoke('load_annotation', { brand: item.brand, model: item.model, file: item.file });
    if (content && content !== '[]') {
      annotHistory = JSON.parse(content);
    } else {
      const saved = localStorage.getItem('annot_' + key);
      if (saved) {
        annotHistory = JSON.parse(saved);
      } else {
        annotHistory = [];
      }
    }
  } catch (e) {
    console.error('加载标注文件失败:', e);
    const saved = localStorage.getItem('annot_' + key);
    if (saved) {
      try { annotHistory = JSON.parse(saved) } catch(err) { annotHistory = [] }
    } else {
      annotHistory = [];
    }
  }
  redrawCanvas();
}

function undoAnnot() {
  if (annotHistory.length > 0) annotHistory.pop();
  redrawCanvas();
  saveAnnotations();
}

function clearAnnot() {
  if (confirm('清除所有标注?')) {
    annotHistory = [];
    redrawCanvas();
    saveAnnotations();
  }
}

function toggleEditMode() {
  editMode = !editMode;
  const btn = document.getElementById('v-edit-btn');
  
  const canvas = document.getElementById('v-canvas');
  btn.classList.toggle('edit-active');
  canvas.classList.toggle('edit-mode');

  selectedAnnot = -1;
  redrawCanvas();
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function findAnnotation(x, y) {
  const threshold = 15;
  for (let i = annotHistory.length - 1; i >= 0; i--) {
    const a = annotHistory[i];
    if (a.type === 'free' && a.points) {
      for (let j = 1; j < a.points.length; j++) {
        if (distToSegment(x, y, a.points[j-1].x, a.points[j-1].y, a.points[j].x, a.points[j].y) < threshold) return i;
      }
    } else if (a.type === 'text') {
      if (Math.hypot(x - a.x, y - a.y) < threshold) return i;
    } else if (a.x1 !== undefined && a.x2 !== undefined) {
      const cx = (a.x1 + a.x2) / 2, cy = (a.y1 + a.y2) / 2;
      if (Math.hypot(x - cx, y - cy) < threshold || distToSegment(x, y, a.x1, a.y1, a.x2, a.y2) < threshold) return i;
    }
  }
  return -1;
}

function deleteSelected() {
  if (selectedAnnot < 0 || selectedAnnot >= annotHistory.length) return;
  annotHistory.splice(selectedAnnot, 1);
  selectedAnnot = -1;
  redrawCanvas();
  saveAnnotations();
}

function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  annotHistory.forEach((a, i) => {
    const isSel = i === selectedAnnot;
    ctx.strokeStyle = a.color || '#ff4444';
    ctx.lineWidth = (a.size || 3) + (isSel ? 3 : 0);
    ctx.fillStyle = a.color || '#ff4444';
    if (a.type === 'free' && a.points && a.points.length > 1) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      ctx.moveTo(a.points[0].x, a.points[0].y);
      for (let i = 1; i < a.points.length; i++) ctx.lineTo(a.points[i].x, a.points[i].y);
      ctx.stroke();
    } else if (a.type === 'line') {
      ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();
    } else if (a.type === 'circle') {
      const cx = (a.x1 + a.x2) / 2, cy = (a.y1 + a.y2) / 2;
      const rx = Math.abs(a.x2 - a.x1) / 2, ry = Math.abs(a.y2 - a.y1) / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (a.type === 'arrow') {
      const ax1 = a.x1, ay1 = a.y1, ax2 = a.x2, ay2 = a.y2;
      const angle = Math.atan2(ay2 - ay1, ax2 - ax1);
      const len = Math.sqrt((ax2 - ax1) ** 2 + (ay2 - ay1) ** 2);
      ctx.beginPath(); ctx.moveTo(ax1, ay1); ctx.lineTo(ax2, ay2); ctx.stroke();
      const hl = Math.min(15, len * 0.3);
      ctx.beginPath(); ctx.moveTo(ax2, ay2);
      ctx.lineTo(ax2 - hl * Math.cos(angle - 0.4), ay2 - hl * Math.sin(angle - 0.4));
      ctx.lineTo(ax2 - hl * Math.cos(angle + 0.4), ay2 - hl * Math.sin(angle + 0.4));
      ctx.closePath(); ctx.fill();
    } else if (a.type === 'rect') {
      ctx.strokeRect(a.x1, a.y1, a.x2 - a.x1, a.y2 - a.y1);
    } else if (a.type === 'text') {
      ctx.font = `${(a.size || 3) * 5}px sans-serif`;
      ctx.fillText(a.text, a.x, a.y);
    }
    if (isSel) {
      ctx.strokeStyle = '#4fc3f7';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      if (a.type === 'text') {
        ctx.strokeRect(a.x - 20, a.y - 20, 40, 40);
      } else if (a.x1 !== undefined && a.x2 !== undefined) {
        const x = Math.min(a.x1, a.x2), y = Math.min(a.y1, a.y2);
        const w = Math.abs(a.x2 - a.x1), h = Math.abs(a.y2 - a.y1);
        ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
      }
      ctx.setLineDash([]);
    }
  });
}

canvas.addEventListener('click', function(e) {
  if (!lbAnnotMode || !editMode) return;
  const pos = e.offsetX !== undefined ? { x: e.offsetX * (canvas.width / canvas.getBoundingClientRect().width), y: e.offsetY * (canvas.height / canvas.getBoundingClientRect().height) } : { x: 0, y: 0 };
  const idx = findAnnotation(pos.x, pos.y);
  selectedAnnot = idx;
  redrawCanvas();
});

document.addEventListener('keydown', e => {
  if (document.getElementById('viewer').style.display !== 'flex') return;
  if (e.key === 'ArrowLeft') { if (editMode && selectedAnnot >= 0) { e.preventDefault(); nudgeAnnot(-2, 0) } else prevImage() }
  else if (e.key === 'ArrowRight') { if (editMode && selectedAnnot >= 0) { e.preventDefault(); nudgeAnnot(2, 0) } else nextImage() }
  else if (e.key === 'ArrowUp') { if (editMode && selectedAnnot >= 0) { e.preventDefault(); nudgeAnnot(0, -2) } }
  else if (e.key === 'ArrowDown') { if (editMode && selectedAnnot >= 0) { e.preventDefault(); nudgeAnnot(0, 2) } }
  else if (e.key === 'Delete' || e.key === 'Backspace') { if (editMode && selectedAnnot >= 0) { e.preventDefault(); deleteSelected() } }
  if (e.key === '+' || e.key === '=') zoomIn();
  if (e.key === '-') zoomOut();
  if (e.key === 'r') rotateImg(90);
  if (e.key === 'a' && e.ctrlKey) { e.preventDefault(); toggleAnnot() }
});

function nudgeAnnot(dx, dy) {
  const a = annotHistory[selectedAnnot];
  if (!a) return;
  const scale = canvas.width / canvas.getBoundingClientRect().width;
  const sdx = dx * scale, sdy = dy * scale;
  if (a.type === 'free' && a.points) { a.points.forEach(p => { p.x += sdx; p.y += sdy }) }
  else if (a.type === 'text') { a.x += sdx; a.y += sdy }
  else { a.x1 += sdx; a.y1 += sdy; a.x2 += sdx; a.y2 += sdy }
  redrawCanvas();
  saveAnnotations();
}

window.addEventListener('resize', () => {
  if (lbAnnotMode) fitCanvasToScreen();
});

function openSettingsModal() {
  document.getElementById('settings-modal').classList.add('show');
  toggleModeFields();
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.remove('show');
}

function toggleModeFields() {
  const mode = document.getElementById('setting-mode').value;
  document.getElementById('cloud-fields').style.display = mode === 'cloud' ? 'block' : 'none';
}

function updateBaiduStatus() {
  const statusEl = document.getElementById('baidu-login-status');
  if (baiduAccessToken) {
    statusEl.textContent = '已登录';
    statusEl.style.color = '#4fc3f7';
  } else {
    statusEl.textContent = '未登录';
    statusEl.style.color = '#e94560';
  }
}

async function loginBaidu() {
  const clientId = document.getElementById('setting-client-id').value.trim();
  if (!clientId) {
    alert('请先输入 App Key (Client ID)');
    return;
  }
  try {
    await invoke('open_baidu_login_window', { clientId: clientId });
  } catch (e) {
    alert('打开登录窗口失败: ' + e);
  }
}

async function verifyAuthCode() {
  const clientId = document.getElementById('setting-client-id').value.trim();
  const clientSecret = document.getElementById('setting-client-secret').value.trim();
  const code = document.getElementById('setting-auth-code').value.trim();
  if (!clientId || !clientSecret || !code) {
    alert('请确保 App Key, App Secret 和授权码均已填写！');
    return;
  }
  try {
    const statusEl = document.getElementById('baidu-login-status');
    statusEl.textContent = '正在验证并获取 Token...';
    statusEl.style.color = '#ffb74d';
    
    const respText = await invoke('baidu_exchange_token', { clientId: clientId, clientSecret: clientSecret, code });
    const resp = JSON.parse(respText);
    if (resp.error) {
      throw new Error(resp.error_description || resp.error);
    }
    
    baiduAccessToken = resp.access_token;
    baiduRefreshToken = resp.refresh_token;
    
    localStorage.setItem('baidu_client_id', clientId);
    localStorage.setItem('baidu_client_secret', clientSecret);
    localStorage.setItem('baidu_access_token', baiduAccessToken);
    localStorage.setItem('baidu_refresh_token', baiduRefreshToken);
    
    updateBaiduStatus();
    alert('授权登录成功！');
  } catch (e) {
    updateBaiduStatus();
    alert('授权失败: ' + e);
  }
}

function saveSettings() {
  const mode = document.getElementById('setting-mode').value;
  const clientId = document.getElementById('setting-client-id').value.trim();
  const clientSecret = document.getElementById('setting-client-secret').value.trim();
  let rootPath = document.getElementById('setting-root-path').value.trim();
  
  // Sanitization for Baidu Path
  if (rootPath.startsWith('我的网盘/')) {
    rootPath = '/' + rootPath.substring('我的网盘/'.length);
  }
  if (rootPath && !rootPath.startsWith('/')) {
    rootPath = '/' + rootPath;
  }
  if (rootPath.endsWith('/') && rootPath.length > 1) {
    rootPath = rootPath.substring(0, rootPath.length - 1);
  }
  
  if (mode === 'cloud' && !baiduAccessToken) {
    if (!confirm('您选择了云端模式但尚未进行百度网盘授权，是否确认保存？')) {
      return;
    }
  }
  
  localStorage.setItem('app_mode', mode);
  localStorage.setItem('baidu_client_id', clientId);
  localStorage.setItem('baidu_client_secret', clientSecret);
  localStorage.setItem('baidu_root_path', rootPath);
  
  appMode = mode;
  baiduClientId = clientId;
  baiduClientSecret = clientSecret;
  baiduRootPath = rootPath;
  
  baiduFileCache = {};
  baiduMetadataFsId = null;
  
  closeSettingsModal();
  init();
}

function toggleAdvancedSettings() {
  const fields = document.getElementById('advanced-fields');
  const arrow = document.getElementById('adv-arrow');
  if (fields.style.display === 'none') {
    fields.style.display = 'block';
    arrow.textContent = '▼';
  } else {
    fields.style.display = 'none';
    arrow.textContent = '▶';
  }
}

init();
