const { contextBridge, ipcRenderer } = require('electron');

const api = {
  getState: () => ipcRenderer.invoke('pet:get'),
  care: (payload) => ipcRenderer.invoke('pet:care', sanitizePayload(payload)),
  buy: (payload) => ipcRenderer.invoke('pet:buy', sanitizePayload(payload)),
  updateSettings: (payload) => ipcRenderer.invoke('pet:settings', sanitizePayload(payload)),
  onStateUpdate: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('state:update', listener);
    return () => ipcRenderer.off('state:update', listener);
  }
};

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  return JSON.parse(JSON.stringify(payload));
}

contextBridge.exposeInMainWorld('pocketPals', api);
