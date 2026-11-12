(function () {
  'use strict';

  const { CATEGORIES, THEMES } = window.ThemeCatalog;
  const W = window.Wallpapers;
  const api = window.api || createBrowserFallback();

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 16)));

  const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
  const SWATCHES = ['#ff1f4b', '#ff2bd6', '#9b51e0', '#5b7cfa', '#0091ea', '#00b3a4', '#00c853', '#ffb300', '#ef7d57', '#c8643b', '#6b7280'];
  const ICONS = {
    bolt: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M3 6h6l2 2h10v11H3z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>',
    pad: '<svg viewBox="0 0 24 24"><path d="M6 8h12a4 4 0 0 1 4 4v1.5A3.5 3.5 0 0 1 15.8 15l-.8-1H9l-.8 1A3.5 3.5 0 0 1 2 13.5V12a4 4 0 0 1 4-4z"/><path d="M7 11v3M5.5 12.5h3"/></svg>',
  };

  const state = {
    info: { isWindows: false, display: { width: 1920, height: 1080 }, backupExists: false, platform: 'web', version: '1.0.0' },
    customThemes: [],
    activeThemeId: null,
    activeSeed: null,
    filter: 'all',
    view: 'themes',
    editor: null,
    games: [],
    gameQuery: '',
    thumbs: new Map(),
  };

  // ======================================================================
  // Utilidades
  // ======================================================================
  function allThemes() {
    return THEMES.concat(state.customThemes);
  }
  function findTheme(id) {
    return allThemes().find((t) => t.id === id);
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function persist(key, value) {
    return api.storeSet(key, value).catch((err) => console.error('store', err));
  }
  function toast(message, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = message;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 4200);
    setTimeout(() => el.remove(), 4700);
  }
  function busy(text) {
    $('#busyText').textContent = text || '';
    $('#busy').hidden = !text;
  }
  function hashColor(str) {
    let h = 0;
    for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `hsl(${h % 360} 75% 55%)`;
  }
  function timeAgo(ts) {
    if (!ts) return 'Nunca jogado';
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'Jogado agora';
    if (m < 60) return `Jogado há ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `Jogado há ${h} h`;
    return `Jogado há ${Math.round(h / 24)} dia(s)`;
  }

  // ======================================================================
  // Miniaturas e tema da interface
  // ======================================================================
  function isImageTheme(theme) {
    return theme.wallpaper && theme.wallpaper.type === 'image';
  }
  function thumbFor(theme, seed, size) {
    if (isImageTheme(theme)) return theme.wallpaper.thumb || '';
    const s = seed == null ? theme.wallpaper.seed : seed;
    const big = size === 'large';
    const key = `${theme.id}:${s}:${big ? 'L' : 'S'}`;
    if (!state.thumbs.has(key)) {
      const url = W.renderToDataUrl(theme.wallpaper, big ? 1280 : 480, big ? 720 : 270, s, 'image/jpeg', big ? 0.88 : 0.82);
      state.thumbs.set(key, url);
    }
    return state.thumbs.get(key);
  }

  function setUiColors(ui, accentOverride) {
    const root = document.documentElement;
    ['bg', 'surface', 'accent2', 'text', 'muted'].forEach((k) => root.style.setProperty('--' + k, ui[k]));
    root.style.setProperty('--accent', accentOverride || ui.accent);
    root.classList.toggle('light', !!ui.light);
  }

  function activeTheme() {
    return findTheme(state.activeThemeId) || THEMES[0];
  }

  function refreshChrome() {
    const theme = activeTheme();
    const seed = state.activeThemeId ? state.activeSeed : null;
    if (state.view !== 'editor') setUiColors(theme.ui);
    $('#appBg').style.backgroundImage = `url("${thumbFor(theme, seed)}")`;
    $('#activeBadge').innerHTML = state.activeThemeId
      ? `<span><span class="dot"></span>Tema ativo: <b>${escapeHtml(theme.name)}</b></span>`
      : '<span>Nenhum tema aplicado ainda</span>';
  }

  // ======================================================================
  // Galeria
  // ======================================================================
  function renderChips() {
    const hasCustom = state.customThemes.length > 0;
    $('#categoryChips').innerHTML = CATEGORIES.filter((c) => c.id !== 'custom' || hasCustom)
      .map((c) => `<button class="chip ${state.filter === c.id ? 'active' : ''}" data-cat="${c.id}">${c.label}</button>`)
      .join('');
  }

  function renderHero() {
    const theme = activeTheme();
    const isActive = !!state.activeThemeId;
    const seed = isActive ? state.activeSeed : null;
    const hero = $('#hero');
    hero.style.backgroundImage = `url("${isImageTheme(theme) ? theme.wallpaper.thumb : thumbFor(theme, seed, 'large')}")`;
    hero.innerHTML = `
      <div class="hero-info">
        <span class="eyebrow">${isActive ? 'Tema ativo' : 'Destaque'} · ${escapeHtml(CATEGORY_LABEL[theme.category] || '')}</span>
        <h1>${escapeHtml(theme.name)}</h1>
        <p>${escapeHtml(theme.tagline || '')}</p>
      </div>
      <div class="hero-actions">
        <button class="btn ghost" data-hero="edit">Personalizar</button>
        <button class="btn primary" data-hero="apply">${ICONS.bolt} ${isActive ? 'Reaplicar' : 'Aplicar agora'}</button>
      </div>`;
    hero.dataset.themeId = theme.id;
  }

  function renderGrid() {
    const list = allThemes().filter((t) => state.filter === 'all' || t.category === state.filter);
    const grid = $('#themeGrid');
    grid.innerHTML = list.map((t) => {
      const cached = isImageTheme(t) ? t.wallpaper.thumb : state.thumbs.get(`${t.id}:${t.wallpaper.seed}:S`);
      const isActive = t.id === state.activeThemeId;
      const accent = t.windows.accent;
      return `
        <article class="theme-card" data-id="${t.id}" style="--card-accent:${accent}">
          <div class="thumb" ${cached ? `style="background-image:url('${cached}')"` : ''} data-pending="${cached ? '' : '1'}">
            <div class="mini-taskbar ${t.taskbar.align === 'left' ? 'left' : ''}" style="background:${t.windows.accentOnTaskbar && t.windows.darkMode ? W.rgba(W.mix(accent, '#000000', 0.45), 0.85) : t.windows.darkMode ? 'rgba(20,20,22,.8)' : 'rgba(240,240,240,.85)'}">
              <i></i><i></i><i></i><i></i><i></i>
            </div>
          </div>
          ${isActive ? '<span class="badge active-badge">ATIVO</span>' : `<span class="badge">${escapeHtml(CATEGORY_LABEL[t.category] || '')}</span>`}
          <div class="card-actions">
            <button class="icon-btn" data-action="apply" title="Aplicar agora">${ICONS.bolt}</button>
            ${t.category === 'custom' ? `<button class="icon-btn danger" data-action="delete" title="Excluir tema">${ICONS.trash}</button>` : ''}
          </div>
          <div class="meta">
            <div class="names"><strong>${escapeHtml(t.name)}</strong><span>${escapeHtml(t.tagline || '')}</span></div>
            <div class="swatch-dots"><i style="background:${t.ui.accent}"></i><i style="background:${t.ui.accent2}"></i><i style="background:${t.ui.bg}"></i></div>
          </div>
        </article>`;
    }).join('');
    fillPendingThumbs();
  }

  // Renderiza as miniaturas aos poucos para não travar a interface.
  let thumbJob = 0;
  function fillPendingThumbs() {
    const job = ++thumbJob;
    const pending = $$('.thumb[data-pending="1"]');
    const step = () => {
      if (job !== thumbJob) return;
      const el = pending.shift();
      if (!el) return;
      const theme = findTheme(el.closest('.theme-card').dataset.id);
      if (theme) el.style.backgroundImage = `url('${thumbFor(theme)}')`;
      el.dataset.pending = '';
      setTimeout(step, 0);
    };
    setTimeout(step, 30);
  }

  function renderThemesView() {
    renderChips();
    renderHero();
    renderGrid();
  }

  // ======================================================================
  // Editor
  // ======================================================================
  function makeEditor(theme) {
    const image = isImageTheme(theme)
      ? { filePath: theme.wallpaper.filePath, name: theme.wallpaper.name || 'Imagem', preview: theme.wallpaper.thumb }
      : null;
    return {
      baseId: theme.id,
      theme: clone(theme),
      seed: theme.seed != null ? theme.seed : theme.wallpaper.seed,
      source: image ? 'image' : 'generated',
      image,
      style: theme.wallpaperStyle || 'fill',
      apply: { wallpaper: true, colors: true, taskbar: true },
      restartExplorer: !!(state.editor && state.editor.restartExplorer),
    };
  }

  function openEditor(themeId) {
    const theme = findTheme(themeId) || THEMES[0];
    state.editor = makeEditor(theme);
    switchView('editor');
  }

  function populateThemeSelect() {
    const groups = CATEGORIES.filter((c) => c.id !== 'all');
    $('#themeSelect').innerHTML = groups.map((g) => {
      const items = allThemes().filter((t) => t.category === g.id);
      if (!items.length) return '';
      return `<optgroup label="${g.label}">${items.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}</optgroup>`;
    }).join('');
  }

  function syncEditorControls() {
    const e = state.editor;
    const t = e.theme;
    $('#editorCategory').textContent = CATEGORY_LABEL[t.category] || '';
    $('#editorName').textContent = t.name;
    $('#editorTagline').textContent = t.tagline || '';
    populateThemeSelect();
    $('#themeSelect').value = e.baseId;

    $('#applyWallpaper').checked = e.apply.wallpaper;
    $('#applyColors').checked = e.apply.colors;
    $('#applyTaskbar').checked = e.apply.taskbar;
    setSegmented('#wallpaperSource', e.source);
    $('#wallpaperStyle').value = e.style;
    $('#imageName').textContent = e.image ? e.image.name : 'Nenhuma imagem';

    $('#accentColor').value = t.windows.accent;
    $('#darkMode').checked = t.windows.darkMode;
    $('#transparency').checked = t.windows.transparency;
    $('#accentOnTaskbar').checked = t.windows.accentOnTaskbar;
    $('#accentOnTitleBars').checked = t.windows.accentOnTitleBars;

    setSegmented('#taskbarAlign', t.taskbar.align);
    setSegmented('#taskbarSearch', t.taskbar.search);
    $('#autoHide').checked = t.taskbar.autoHide;
    $('#taskView').checked = t.taskbar.taskView;
    $('#widgets').checked = t.taskbar.widgets;
    $('#restartExplorer').checked = e.restartExplorer;

    $('#swatches').innerHTML = [t.ui.accent].concat(SWATCHES.filter((c) => c !== t.ui.accent))
      .slice(0, 10)
      .map((c) => `<button style="background:${c}" data-color="${c}" class="${c.toLowerCase() === t.windows.accent.toLowerCase() ? 'active' : ''}" title="${c}"></button>`)
      .join('');

    $('#platformHint').hidden = state.info.isWindows;
    $('#platformHint').textContent = 'Você não está no Windows: a pré-visualização funciona, mas a aplicação só acontece no Windows 10/11.';
    renderPreview();
    updateMock();
  }

  function setSegmented(sel, value) {
    $$(sel + ' button').forEach((b) => b.classList.toggle('active', b.dataset.value === value));
  }

  function renderPreview() {
    const e = state.editor;
    const canvas = $('#previewCanvas');
    const img = $('#previewImage');
    const screen = $('#screen');
    screen.classList.remove('fit', 'center', 'stretch');
    if (e.source === 'image') {
      canvas.hidden = true;
      img.hidden = !e.image;
      if (e.image) img.src = e.image.preview;
      if (['fit', 'center', 'stretch'].includes(e.style)) screen.classList.add(e.style);
    } else {
      img.hidden = true;
      canvas.hidden = false;
      W.render(canvas, e.theme.wallpaper, e.seed);
    }
  }

  function updateMock() {
    const e = state.editor;
    const win = e.theme.windows;
    const tb = e.theme.taskbar;
    const accent = win.accent;
    const taskbar = $('#mockTaskbar');
    const mockWin = $('#mockWindow');
    const light = !win.darkMode;

    taskbar.className = 'mock-taskbar';
    taskbar.classList.toggle('light', light);
    taskbar.classList.toggle('opaque', !win.transparency);
    taskbar.classList.toggle('align-left', tb.align === 'left');
    taskbar.classList.toggle('autohide', tb.autoHide);
    taskbar.classList.add('search-' + tb.search);
    taskbar.classList.toggle('no-taskview', !tb.taskView);
    taskbar.classList.toggle('no-widgets', !tb.widgets);
    taskbar.style.setProperty('--tb-accent', W.mix(accent, light ? '#000000' : '#ffffff', 0.15));
    const alpha = win.transparency ? 0.82 : 1;
    if (win.accentOnTaskbar && !light) taskbar.style.background = W.rgba(W.mix(accent, '#000000', 0.45), alpha);
    else taskbar.style.background = light ? `rgba(238,238,240,${alpha})` : `rgba(28,28,30,${alpha})`;
    $('#screen').classList.toggle('is-autohide', tb.autoHide);

    mockWin.classList.toggle('light', light);
    mockWin.classList.toggle('opaque', !win.transparency);
    const title = $('.mock-titlebar', mockWin);
    title.style.background = win.accentOnTitleBars ? W.mix(accent, '#000000', 0.25) : 'transparent';
    title.style.color = win.accentOnTitleBars ? '#fff' : '';

    $('#lightHint').hidden = !(light && win.accentOnTaskbar);
    ['Wallpaper', 'Colors', 'Taskbar'].forEach((k) => {
      $('#apply' + k).closest('.panel-group').classList.toggle('disabled', !e.apply[k.toLowerCase()]);
    });
    setUiColors(e.theme.ui, accent);
  }

  function bindEditor() {
    $('#themeSelect').addEventListener('change', (ev) => {
      const keepRestart = state.editor.restartExplorer;
      state.editor = makeEditor(findTheme(ev.target.value));
      state.editor.restartExplorer = keepRestart;
      syncEditorControls();
    });

    const flag = (id, fn) => $(id).addEventListener('change', (ev) => { fn(ev.target.checked); updateMock(); });
    flag('#applyWallpaper', (v) => (state.editor.apply.wallpaper = v));
    flag('#applyColors', (v) => (state.editor.apply.colors = v));
    flag('#applyTaskbar', (v) => (state.editor.apply.taskbar = v));
    flag('#darkMode', (v) => (state.editor.theme.windows.darkMode = v));
    flag('#transparency', (v) => (state.editor.theme.windows.transparency = v));
    flag('#accentOnTaskbar', (v) => (state.editor.theme.windows.accentOnTaskbar = v));
    flag('#accentOnTitleBars', (v) => (state.editor.theme.windows.accentOnTitleBars = v));
    flag('#autoHide', (v) => (state.editor.theme.taskbar.autoHide = v));
    flag('#taskView', (v) => (state.editor.theme.taskbar.taskView = v));
    flag('#widgets', (v) => (state.editor.theme.taskbar.widgets = v));
    flag('#restartExplorer', (v) => (state.editor.restartExplorer = v));

    $('#accentColor').addEventListener('input', (ev) => {
      state.editor.theme.windows.accent = ev.target.value;
      $$('#swatches button').forEach((b) => b.classList.toggle('active', b.dataset.color.toLowerCase() === ev.target.value.toLowerCase()));
      updateMock();
    });
    $('#swatches').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-color]');
      if (!b) return;
      state.editor.theme.windows.accent = b.dataset.color;
      $('#accentColor').value = b.dataset.color;
      $$('#swatches button').forEach((x) => x.classList.toggle('active', x === b));
      updateMock();
    });

    const segmented = (sel, fn) => $(sel).addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-value]');
      if (!b) return;
      setSegmented(sel, b.dataset.value);
      fn(b.dataset.value);
    });
    segmented('#taskbarAlign', (v) => { state.editor.theme.taskbar.align = v; updateMock(); });
    segmented('#taskbarSearch', (v) => { state.editor.theme.taskbar.search = v; updateMock(); });
    segmented('#wallpaperSource', (v) => {
      state.editor.source = v;
      $('#imagePick').hidden = v !== 'image';
      $('#btnReseed').disabled = v === 'image';
      renderPreview();
      if (v === 'image' && !state.editor.image) pickImage();
    });
    $('#wallpaperStyle').addEventListener('change', (ev) => { state.editor.style = ev.target.value; renderPreview(); });

    $('#btnPickImage').addEventListener('click', pickImage);
    $('#btnReseed').addEventListener('click', () => {
      state.editor.seed = Math.floor(Math.random() * 1e9);
      renderPreview();
    });
    $('#btnExport').addEventListener('click', exportWallpaper);
    $('#btnSaveTheme').addEventListener('click', saveCustomTheme);
    $('#btnApply').addEventListener('click', () => applyEditor());
  }

  async function pickImage() {
    const res = await api.pickWallpaper();
    if (!res) {
      if (!state.editor.image) { state.editor.source = 'generated'; syncEditorControls(); }
      return;
    }
    state.editor.image = res;
    state.editor.source = 'image';
    $('#imageName').textContent = res.name;
    setSegmented('#wallpaperSource', 'image');
    renderPreview();
  }

  function targetResolution() {
    let { width, height } = state.info.display || { width: 1920, height: 1080 };
    if (!width || !height) { width = 1920; height = 1080; }
    const scale = Math.min(1, 3840 / width, 2400 / height);
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
  }

  async function exportWallpaper() {
    const e = state.editor;
    if (e.source === 'image') { toast('A imagem própria já está salva no seu computador.'); return; }
    const { width, height } = targetResolution();
    busy(`Gerando imagem ${width}×${height}…`);
    await nextFrame();
    const url = W.renderToDataUrl(e.theme.wallpaper, width, height, e.seed, 'image/png');
    busy(null);
    const res = await api.exportWallpaper(url, `${e.theme.id}-${width}x${height}`);
    if (res && res.ok) toast('Papel de parede salvo em ' + res.filePath, 'success');
  }

  function makeImageThumb(preview) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 480; c.height = 270;
        const ctx = c.getContext('2d');
        const scale = Math.max(c.width / img.width, c.height / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve('');
      img.src = preview;
    });
  }

  async function saveCustomTheme() {
    const e = state.editor;
    const base = e.theme;
    const suggested = base.category === 'custom' ? base.name : `${base.name} (meu)`;
    const name = await promptName(suggested);
    if (!name) return;
    const id = 'custom-' + Date.now();
    const theme = {
      id,
      name,
      category: 'custom',
      tagline: `Baseado em ${findTheme(e.baseId) ? findTheme(e.baseId).name : base.name}.`,
      ui: { ...base.ui, accent: base.windows.accent },
      wallpaper: clone(base.wallpaper),
      seed: e.seed,
      wallpaperStyle: e.style,
      windows: clone(base.windows),
      taskbar: clone(base.taskbar),
    };
    if (e.source === 'image' && e.image) {
      theme.wallpaper = { type: 'image', filePath: e.image.filePath, name: e.image.name, thumb: await makeImageThumb(e.image.preview) };
    } else {
      theme.wallpaper.seed = e.seed;
    }
    state.customThemes.push(theme);
    await persist('customThemes', state.customThemes);
    state.editor.baseId = id;
    state.editor.theme = clone(theme);
    syncEditorControls();
    toast(`Tema "${name}" salvo em Meus temas.`, 'success');
  }

  // O mesmo modal serve para "adicionar link" e para "nome do tema".
  let nameResolver = null;
  function promptName(initial) {
    return new Promise((resolve) => {
      const form = $('#linkForm');
      $('h3', form).textContent = 'Nome do tema';
      $('#linkTarget').closest('.field').hidden = true;
      $('#linkTarget').required = false;
      $('#linkName').value = initial;
      $('#linkModal').hidden = false;
      $('#linkName').select();
      nameResolver = resolve;
    });
  }
  function closeModal(value) {
    $('#linkModal').hidden = true;
    if (nameResolver) {
      const resolve = nameResolver;
      nameResolver = null;
      $('h3', $('#linkForm')).textContent = 'Adicionar jogo por link';
      $('#linkTarget').closest('.field').hidden = false;
      $('#linkTarget').required = true;
      resolve(value);
    }
  }

  async function applyEditor() {
    const e = state.editor;
    if (!e.apply.wallpaper && !e.apply.colors && !e.apply.taskbar) {
      toast('Selecione ao menos uma parte para aplicar (papel de parede, cores ou barra).', 'error');
      return;
    }
    if (!state.info.isWindows) {
      toast('Aplicar estilos só é possível no Windows 10/11. Use "Salvar imagem" para exportar o papel de parede.', 'error');
      return;
    }
    const payload = { themeId: e.theme.id, restartExplorer: e.restartExplorer };
    try {
      if (e.apply.wallpaper) {
        if (e.source === 'image') {
          if (!e.image) { toast('Escolha uma imagem para o papel de parede.', 'error'); return; }
          payload.wallpaper = { filePath: e.image.filePath, style: e.style };
        } else {
          const { width, height } = targetResolution();
          busy(`Gerando papel de parede ${width}×${height}…`);
          await nextFrame();
          payload.wallpaper = { dataUrl: W.renderToDataUrl(e.theme.wallpaper, width, height, e.seed, 'image/jpeg', 0.95), style: e.style };
        }
      }
      if (e.apply.colors) payload.colors = clone(e.theme.windows);
      if (e.apply.taskbar) payload.taskbar = clone(e.theme.taskbar);

      busy('Aplicando estilo no Windows…');
      const res = await api.applyStyle(payload);
      renderLog(res, e.theme.name);
      if (res.ok || res.partial) {
        state.activeThemeId = findTheme(e.baseId) ? e.baseId : null;
        state.activeSeed = e.seed;
        persist('active', { themeId: state.activeThemeId, seed: state.activeSeed });
        state.info.backupExists = true;
        renderSettings();
        refreshChrome();
        if (state.view === 'themes') renderThemesView();
        toast(res.ok ? `"${e.theme.name}" aplicado com sucesso!` : 'Tema aplicado parcialmente — veja os detalhes em Ajustes.', res.ok ? 'success' : '');
        if (!e.restartExplorer && e.apply.taskbar) toast('Dica: algumas mudanças da barra de tarefas aparecem após reiniciar o Explorer.');
      } else {
        toast('Falha ao aplicar: ' + (res.error || 'erro desconhecido'), 'error');
      }
    } catch (err) {
      toast('Erro: ' + err.message, 'error');
    } finally {
      busy(null);
    }
  }

  async function quickApply(themeId) {
    const previous = state.editor;
    state.editor = makeEditor(findTheme(themeId));
    await applyEditor();
    if (state.view !== 'editor' && previous) state.editor = previous;
  }

  // ======================================================================
  // Jogos
  // ======================================================================
  function renderGames() {
    const q = state.gameQuery.trim().toLowerCase();
    const list = state.games
      .filter((g) => !q || g.name.toLowerCase().includes(q))
      .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || a.name.localeCompare(b.name));
    const grid = $('#gameGrid');
    if (!state.games.length) {
      grid.innerHTML = `<div class="empty">${ICONS.pad}<h3>Sua biblioteca está vazia</h3><p class="muted">Clique em <b>+ Adicionar jogo</b> para escolher um .exe ou atalho, ou em <b>+ Link</b> para usar steam://, Epic e outros.</p></div>`;
      return;
    }
    if (!list.length) {
      grid.innerHTML = '<div class="empty"><p class="muted">Nenhum jogo encontrado.</p></div>';
      return;
    }
    grid.innerHTML = list.map((g) => {
      const isFile = !/^[a-z][a-z0-9+.-]*:\/\//i.test(g.target) && !/^https?:/i.test(g.target);
      return `
      <article class="game-card" data-id="${g.id}" style="--game-color:${hashColor(g.name)}">
        <div class="card-actions">
          ${isFile ? `<button class="icon-btn" data-action="reveal" title="Abrir pasta">${ICONS.folder}</button>` : ''}
          <button class="icon-btn danger" data-action="remove" title="Remover">${ICONS.trash}</button>
        </div>
        <div class="game-icon">${g.icon ? `<img src="${g.icon}" alt="" />` : escapeHtml(g.name.charAt(0).toUpperCase())}</div>
        <div><strong title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</strong><p class="muted">${timeAgo(g.lastPlayed)}</p></div>
        <button class="btn primary" data-action="play">${ICONS.play} Jogar</button>
      </article>`;
    }).join('');
  }

  async function addGames(items) {
    const existing = new Set(state.games.map((g) => g.target.toLowerCase()));
    let added = 0;
    items.forEach((it) => {
      if (existing.has(it.target.toLowerCase())) return;
      state.games.push({ id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: it.name, target: it.target, icon: it.icon || null, addedAt: Date.now(), lastPlayed: null });
      added++;
    });
    await persist('games', state.games);
    renderGames();
    if (added) toast(`${added} jogo(s) adicionado(s).`, 'success');
    else if (items.length) toast('Esse jogo já está na biblioteca.');
  }

  function bindGames() {
    $('#btnAddGame').addEventListener('click', async () => addGames(await api.pickGames()));
    $('#btnAddLink').addEventListener('click', () => {
      $('#linkName').value = '';
      $('#linkTarget').value = '';
      $('#linkModal').hidden = false;
      $('#linkName').focus();
    });
    $('#linkCancel').addEventListener('click', () => closeModal(null));
    $('#linkForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const name = $('#linkName').value.trim();
      if (nameResolver) { closeModal(name); return; }
      closeModal(null);
      addGames([{ name, target: $('#linkTarget').value.trim() }]);
    });
    $('#gameSearch').addEventListener('input', (ev) => { state.gameQuery = ev.target.value; renderGames(); });
    $('#gameGrid').addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-action]');
      const card = ev.target.closest('.game-card');
      if (!card) return;
      const game = state.games.find((g) => g.id === card.dataset.id);
      if (!game) return;
      const action = btn ? btn.dataset.action : null;
      if (action === 'remove') {
        state.games = state.games.filter((g) => g !== game);
        await persist('games', state.games);
        renderGames();
      } else if (action === 'reveal') {
        api.revealGame(game.target);
      } else if (action === 'play') {
        const res = await api.launchGame(game.target);
        if (res && res.ok) {
          game.lastPlayed = Date.now();
          await persist('games', state.games);
          renderGames();
          toast(`Iniciando ${game.name}… Bom jogo!`, 'success');
        } else {
          toast('Não foi possível iniciar: ' + ((res && res.error) || 'erro'), 'error');
        }
      }
    });
  }

  // ======================================================================
  // Ajustes
  // ======================================================================
  function renderSettings() {
    $('#backupStatus').innerHTML = state.info.backupExists
      ? '✔ Backup do visual original salvo.'
      : 'Ainda não há backup — ele será criado automaticamente ao aplicar o primeiro tema.';
    const d = state.info.display || {};
    $('#aboutText').textContent = `Ulising Launcher v${state.info.version} · ${state.info.isWindows ? 'Windows' : state.info.platform} · Monitor principal ${d.width}×${d.height} · ${allThemes().length} estilos disponíveis`;
  }

  const STEP_LABELS = {
    wallpaper: 'Papel de parede', darkMode: 'Modo escuro/claro', accentColor: 'Cor de destaque', transparency: 'Transparência',
    accentOnTaskbar: 'Cor na barra de tarefas', accentOnTitleBars: 'Cor nas barras de título', taskbarAlign: 'Alinhamento da barra',
    taskbarAutoHide: 'Ocultar barra automaticamente', taskbarSearch: 'Pesquisa', taskbarTaskView: 'Visão de tarefas',
    taskbarWidgets: 'Widgets', broadcast: 'Notificar o Windows', restartExplorer: 'Reiniciar Explorer', backup: 'Backup',
  };
  function renderLog(res, title) {
    const steps = (res && res.steps) || [];
    const head = `<li><b>${escapeHtml(title || '')}</b>&nbsp;<span class="muted">${new Date().toLocaleTimeString()}</span></li>`;
    const body = steps.map((s) => {
      const label = STEP_LABELS[s.step] || s.step.replace(/^restore:/, 'Restaurar ');
      return `<li><span class="${s.ok ? 'ok' : 'fail'}">${s.ok ? '✔' : '✖'}</span><span>${escapeHtml(label)}${s.ok ? '' : ' — ' + escapeHtml(s.message)}</span></li>`;
    }).join('');
    const err = res && res.error ? `<li><span class="fail">✖</span><span>${escapeHtml(res.error)}</span></li>` : '';
    $('#applyLog').innerHTML = head + body + err;
  }

  function bindSettings() {
    $('#btnRestore').addEventListener('click', async () => {
      if (!state.info.isWindows) { toast('Disponível apenas no Windows.', 'error'); return; }
      busy('Restaurando o visual original do Windows…');
      const res = await api.restoreStyle();
      busy(null);
      renderLog(res, 'Restauração');
      if (res.ok || res.partial) {
        state.activeThemeId = null;
        persist('active', null);
        refreshChrome();
        renderThemesView();
        toast('Visual original restaurado.', 'success');
      } else toast('Falha ao restaurar: ' + (res.error || ''), 'error');
    });
    $('#btnBackup').addEventListener('click', async () => {
      if (!state.info.isWindows) { toast('Disponível apenas no Windows.', 'error'); return; }
      busy('Salvando backup…');
      const res = await api.backupStyle();
      busy(null);
      if (res.ok) { state.info.backupExists = true; renderSettings(); toast('Backup atualizado com o visual atual do Windows.', 'success'); }
      else toast('Falha no backup: ' + (res.error || ''), 'error');
    });
  }

  // ======================================================================
  // Navegação
  // ======================================================================
  function switchView(view) {
    state.view = view;
    $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
    if (view === 'editor') {
      if (!state.editor) state.editor = makeEditor(activeTheme());
      syncEditorControls();
      $('#imagePick').hidden = state.editor.source !== 'image';
      $('#btnReseed').disabled = state.editor.source === 'image';
    } else {
      refreshChrome();
    }
    if (view === 'themes') renderThemesView();
    if (view === 'games') renderGames();
    if (view === 'settings') renderSettings();
  }

  function bindNavigation() {
    $$('.nav-btn').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
    $$('[data-win]').forEach((b) => b.addEventListener('click', () => api[b.dataset.win] && api[b.dataset.win]()));

    $('#categoryChips').addEventListener('click', (ev) => {
      const chip = ev.target.closest('[data-cat]');
      if (!chip) return;
      state.filter = chip.dataset.cat;
      renderChips();
      renderGrid();
    });

    $('#hero').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-hero]');
      if (!b) return;
      const id = $('#hero').dataset.themeId;
      if (b.dataset.hero === 'edit') openEditor(id);
      else quickApply(id);
    });

    $('#themeGrid').addEventListener('click', async (ev) => {
      const card = ev.target.closest('.theme-card');
      if (!card) return;
      const action = ev.target.closest('[data-action]');
      const id = card.dataset.id;
      if (action && action.dataset.action === 'apply') return quickApply(id);
      if (action && action.dataset.action === 'delete') {
        state.customThemes = state.customThemes.filter((t) => t.id !== id);
        await persist('customThemes', state.customThemes);
        if (state.activeThemeId === id) { state.activeThemeId = null; persist('active', null); }
        if (!state.customThemes.length && state.filter === 'custom') state.filter = 'all';
        refreshChrome();
        renderThemesView();
        return;
      }
      openEditor(id);
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !$('#linkModal').hidden) $('#linkCancel').click();
    });
  }

  // ======================================================================
  // Inicialização
  // ======================================================================
  async function init() {
    try { Object.assign(state.info, await api.systemInfo()); } catch (err) { console.error(err); }
    let store = {};
    try { store = (await api.storeGet()) || {}; } catch (err) { console.error(err); }
    state.customThemes = Array.isArray(store.customThemes) ? store.customThemes : [];
    state.games = Array.isArray(store.games) ? store.games : [];
    if (store.active && findTheme(store.active.themeId)) {
      state.activeThemeId = store.active.themeId;
      state.activeSeed = store.active.seed;
    }
    bindNavigation();
    bindEditor();
    bindGames();
    bindSettings();
    refreshChrome();
    renderThemesView();
    renderSettings();
  }

  // Permite abrir o index.html direto no navegador (sem Electron) para pré-visualizar.
  function createBrowserFallback() {
    const KEY = 'ulising-store';
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
    const notAvailable = async () => ({ ok: false, error: 'Disponível apenas no aplicativo para Windows.' });
    return {
      systemInfo: async () => ({ platform: 'browser', isWindows: false, display: { width: screen.width * devicePixelRatio, height: screen.height * devicePixelRatio }, backupExists: false, version: 'web' }),
      storeGet: async () => read(),
      storeSet: async (k, v) => { const d = read(); d[k] = v; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* sem armazenamento */ } return true; },
      applyStyle: notAvailable, backupStyle: notAvailable, restoreStyle: notAvailable,
      exportWallpaper: async (url, name) => { const a = document.createElement('a'); a.href = url; a.download = name + '.png'; a.click(); return { ok: true, filePath: 'Downloads' }; },
      pickWallpaper: async () => null,
      pickGames: async () => [],
      launchGame: notAvailable,
      revealGame: async () => {},
    };
  }

  init();
})();
