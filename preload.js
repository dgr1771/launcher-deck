/* Launcher Deck preload — 最小 IPC 面 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deck', {
  getApps: () => ipcRenderer.invoke('deck:get-apps'),
  launch: (appInfo) => ipcRenderer.invoke('deck:launch', appInfo),
  refresh: () => ipcRenderer.invoke('deck:refresh'),
  hide: () => ipcRenderer.invoke('deck:hide'),
  suspendHide: (v) => ipcRenderer.invoke('deck:suspend-hide', v),
  getHotkey: () => ipcRenderer.invoke('deck:get-hotkey'),
  setHotkey: (acc) => ipcRenderer.invoke('deck:set-hotkey', acc),
  openExeDir: (exePath) => ipcRenderer.invoke('deck:open-exe-dir', exePath),
  onAppsUpdated: (cb) => ipcRenderer.on('deck:apps-updated', () => cb()),
  onShown: (cb) => ipcRenderer.on('deck:shown', () => cb()),
});
