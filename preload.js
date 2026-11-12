'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  systemInfo: () => ipcRenderer.invoke('system:info'),
  storeGet: () => ipcRenderer.invoke('store:get'),
  storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),

  applyStyle: (payload) => ipcRenderer.invoke('style:apply', payload),
  backupStyle: () => ipcRenderer.invoke('style:backup'),
  restoreStyle: () => ipcRenderer.invoke('style:restore'),

  exportWallpaper: (dataUrl, name) => ipcRenderer.invoke('wallpaper:export', dataUrl, name),
  pickWallpaper: () => ipcRenderer.invoke('wallpaper:pick'),

  pickGames: () => ipcRenderer.invoke('games:pick'),
  launchGame: (target) => ipcRenderer.invoke('games:launch', target),
  revealGame: (target) => ipcRenderer.invoke('games:reveal', target),

  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
});
