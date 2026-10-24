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
  logError: (msg) => ipcRenderer.invoke('deck:log', msg),
  openExeDir: (exePath) => ipcRenderer.invoke('deck:open-exe-dir', exePath),
  getVersion: () => ipcRenderer.invoke('deck:get-version'),
  openExternal: (url) => ipcRenderer.invoke('deck:open-external', url),
  checkUpdates: (force) => ipcRenderer.invoke('deck:check-updates', force),
  upgradeApp: (payload) => ipcRenderer.invoke('deck:upgrade-app', payload),
  upgradeAppAdmin: (payload) => ipcRenderer.invoke('deck:upgrade-app-admin', payload),
  onUpdatesRefresh: (cb) => ipcRenderer.on('deck:updates-refresh', () => cb()),
  onAppsUpdated: (cb) => ipcRenderer.on('deck:apps-updated', () => cb()),
  onShown: (cb) => ipcRenderer.on('deck:shown', () => cb()),
  onShowAbout: (cb) => ipcRenderer.on('deck:show-about', () => cb()),
});
