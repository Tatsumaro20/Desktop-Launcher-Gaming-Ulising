'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const IS_WINDOWS = process.platform === 'win32';
const EXTERNAL_PROTOCOLS = ['steam:', 'com.epicgames.launcher:', 'uplay:', 'origin:', 'origin2:', 'battlenet:', 'riotclient:', 'http:', 'https:'];

let mainWindow = null;

// ---------- Armazenamento simples em JSON ----------
const dataDir = () => app.getPath('userData');
const storeFile = () => path.join(dataDir(), 'launcher-data.json');
const backupFile = () => path.join(dataDir(), 'windows-style-backup.json');
const wallpaperDir = () => path.join(dataDir(), 'wallpapers');

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
  } catch {
    return {};
  }
}

function writeStore(data) {
  fs.mkdirSync(dataDir(), { recursive: true });
  const tmp = storeFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, storeFile());
}

// ---------- PowerShell ----------
function scriptPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'scripts', 'apply-style.ps1')
    : path.join(__dirname, 'scripts', 'windows', 'apply-style.ps1');
}

function runStyleScript(config) {
  return new Promise((resolve) => {
    if (!IS_WINDOWS) {
      resolve({ ok: false, error: 'A aplicação de estilos só funciona no Windows 10/11. A pré-visualização continua disponível.' });
      return;
    }
    fs.mkdirSync(dataDir(), { recursive: true });
    const cfgPath = path.join(dataDir(), `style-job-${Date.now()}.json`);
    fs.writeFileSync(cfgPath, JSON.stringify(config), 'utf8');

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath(), '-ConfigPath', cfgPath],
      { windowsHide: true, timeout: 90_000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        fs.rm(cfgPath, { force: true }, () => {});
        const lines = String(stdout || '').trim().split(/\r?\n/).filter(Boolean);
        const last = lines[lines.length - 1];
        try {
          resolve(JSON.parse(last));
        } catch {
          resolve({ ok: false, error: (stderr || (err && err.message) || 'Falha ao executar o PowerShell.').toString().trim() });
        }
      }
    );
  });
}

function saveWallpaper(dataUrl, themeId) {
  const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Imagem de papel de parede inválida.');
  const dir = wallpaperDir();
  fs.mkdirSync(dir, { recursive: true });
  const safeId = String(themeId || 'tema').replace(/[^a-z0-9_-]/gi, '');
  const ext = match[1] === 'png' ? 'png' : 'jpg';
  const file = path.join(dir, `${safeId}-${Date.now()}.${ext}`);
  fs.writeFileSync(file, Buffer.from(match[2], 'base64'));
  // Mantém apenas os 6 papéis de parede gerados mais recentes.
  const files = fs.readdirSync(dir)
    .map((name) => ({ name, time: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  files.slice(6).forEach((f) => fs.rm(path.join(dir, f.name), { force: true }, () => {}));
  return file;
}

async function ensureBackup() {
  if (fs.existsSync(backupFile())) return { ok: true, skipped: true };
  return runStyleScript({ mode: 'backup', backupPath: backupFile() });
}

// ---------- Janela ----------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1040,
    minHeight: 680,
    frame: false,
    backgroundColor: '#07060b',
    show: false,
    title: 'Ulising Launcher',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

// ---------- IPC ----------
ipcMain.handle('system:info', () => {
  const display = screen.getPrimaryDisplay();
  return {
    platform: process.platform,
    isWindows: IS_WINDOWS,
    display: {
      width: Math.round(display.size.width * display.scaleFactor),
      height: Math.round(display.size.height * display.scaleFactor),
    },
    backupExists: fs.existsSync(backupFile()),
    version: app.getVersion(),
  };
});

ipcMain.handle('store:get', () => readStore());
ipcMain.handle('store:set', (_e, key, value) => {
  const data = readStore();
  data[key] = value;
  writeStore(data);
  return true;
});

ipcMain.handle('style:apply', async (_e, payload) => {
  try {
    const backup = await ensureBackup();
    if (!backup.ok) return { ok: false, error: 'Não foi possível criar o backup do estilo atual: ' + (backup.error || '') };

    const config = { mode: 'apply', restartExplorer: !!payload.restartExplorer };
    if (payload.wallpaper) {
      const file = payload.wallpaper.filePath && fs.existsSync(payload.wallpaper.filePath)
        ? payload.wallpaper.filePath
        : saveWallpaper(payload.wallpaper.dataUrl, payload.themeId);
      config.wallpaper = { path: file, style: payload.wallpaper.style || 'fill' };
    }
    if (payload.colors) config.colors = payload.colors;
    if (payload.taskbar) config.taskbar = payload.taskbar;
    return await runStyleScript(config);
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('style:backup', async () => {
  fs.rmSync(backupFile(), { force: true });
  return ensureBackup();
});

ipcMain.handle('style:restore', async () => {
  if (!fs.existsSync(backupFile())) return { ok: false, error: 'Nenhum backup encontrado. Aplique um tema ou crie um backup primeiro.' };
  return runStyleScript({ mode: 'restore', backupPath: backupFile(), restartExplorer: true });
});

ipcMain.handle('wallpaper:export', async (_e, dataUrl, suggestedName) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar papel de parede',
    defaultPath: path.join(app.getPath('pictures'), `${suggestedName || 'wallpaper'}.png`),
    filters: [{ name: 'Imagem PNG', extensions: ['png'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  const base64 = String(dataUrl).split(',')[1] || '';
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return { ok: true, filePath };
});

ipcMain.handle('wallpaper:pick', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolher imagem de papel de parede',
    properties: ['openFile'],
    filters: [{ name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'webp'] }],
  });
  if (canceled || !filePaths.length) return null;
  const filePath = filePaths[0];
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  const preview = `data:image/${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
  return { filePath, name: path.basename(filePath), preview };
});

ipcMain.handle('games:pick', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Adicionar jogos',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Jogos e atalhos', extensions: ['exe', 'lnk', 'url', 'bat', 'cmd'] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
  });
  if (canceled) return [];
  const games = [];
  for (const target of filePaths) {
    let icon = null;
    try {
      icon = (await app.getFileIcon(target, { size: 'large' })).toDataURL();
    } catch { /* sem ícone */ }
    games.push({ name: path.basename(target, path.extname(target)), target, icon });
  }
  return games;
});

ipcMain.handle('games:launch', async (_e, target) => {
  const value = String(target || '').trim();
  if (!value) return { ok: false, error: 'Destino vazio.' };
  try {
    const protocol = (/^([a-z][a-z0-9+.-]*:)/i.exec(value) || [])[1];
    if (protocol && protocol.length > 2 && EXTERNAL_PROTOCOLS.includes(protocol.toLowerCase())) {
      await shell.openExternal(value);
      return { ok: true };
    }
    if (!fs.existsSync(value)) return { ok: false, error: 'Arquivo não encontrado: ' + value };
    const error = await shell.openPath(value);
    return error ? { ok: false, error } : { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('games:reveal', (_e, target) => {
  if (target && fs.existsSync(target)) shell.showItemInFolder(target);
});

ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow && mainWindow.close());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
