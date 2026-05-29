const path = require('node:path');
const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen } = require('electron');
const { loadState, saveState, getICloudMirrorDir } = require('../core/storage.cjs');
const { tick, care, buy, normalizeState, DEFAULT_PET_TYPES, SHOP_ITEMS, getStatusMessage } = require('../core/petEngine.cjs');

let mainWindow;
let tray;
let state;
let saveTimer;

const WINDOW_SIZE = { width: 260, height: 360 };

function createWindow() {
  const position = state?.settings?.position || { x: 24, y: 160 };
  const bounds = fitToDisplay(position.x, position.y);

  mainWindow = new BrowserWindow({
    width: WINDOW_SIZE.width,
    height: WINDOW_SIZE.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.showInactive());

  mainWindow.on('moved', () => {
    const [x, y] = mainWindow.getPosition();
    state.settings.position = fitToDisplay(x, y);
    scheduleSave();
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function fitToDisplay(x, y) {
  const display = screen.getDisplayNearestPoint({ x, y });
  const area = display.workArea;
  return {
    x: Math.max(area.x, Math.min(area.x + area.width - WINDOW_SIZE.width, Math.round(x))),
    y: Math.max(area.y, Math.min(area.y + area.height - WINDOW_SIZE.height, Math.round(y)))
  };
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Pocket Pals');
  refreshTray();
}

function createTrayIcon() {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#ffffff"/>
      <path d="M9 10 7 5l6 3M23 10l2-5-6 3" fill="#ffcf7d" stroke="#40312a" stroke-width="2" stroke-linejoin="round"/>
      <ellipse cx="16" cy="17" rx="10" ry="9" fill="#ffcf7d" stroke="#40312a" stroke-width="2"/>
      <circle cx="12.5" cy="16" r="1.4" fill="#40312a"/>
      <circle cx="19.5" cy="16" r="1.4" fill="#40312a"/>
      <path d="M13 21c2 1.5 4 1.5 6 0" fill="none" stroke="#40312a" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `);
  return nativeImage.createFromDataURL(`data:image/svg+xml,${svg}`);
}

function refreshTray() {
  const launchSettings = app.getLoginItemSettings();
  const menu = Menu.buildFromTemplate([
    {
      label: mainWindow?.isVisible() ? 'Hide Pocket Pal' : 'Show Pocket Pal',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) mainWindow.hide();
        else mainWindow.showInactive();
        refreshTray();
      }
    },
    {
      label: state?.settings?.focusMode ? 'Turn Off Focus Mode' : 'Turn On Focus Mode',
      click: async () => {
        state.settings.focusMode = !state.settings.focusMode;
        await saveAndBroadcast();
        refreshTray();
      }
    },
    {
      label: launchSettings.openAtLogin ? 'Disable Launch at Login' : 'Enable Launch at Login',
      click: async () => {
        const next = !app.getLoginItemSettings().openAtLogin;
        app.setLoginItemSettings({ openAtLogin: next });
        state.settings.launchAtLogin = next;
        await saveAndBroadcast();
        refreshTray();
      }
    },
    { type: 'separator' },
    {
      label: 'iCloud Mirror Folder',
      click: () => {
        require('electron').shell.openPath(getICloudMirrorDir());
      }
    },
    {
      label: 'Quit',
      click: async () => {
        app.isQuitting = true;
        await saveAndBroadcast();
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveAndBroadcast().catch(console.error), 250);
}

async function saveAndBroadcast() {
  state = await saveState(app.getPath('userData'), normalizeState(state));
  mainWindow?.webContents.send('state:update', presentState(state));
  return presentState(state);
}

function presentState(raw) {
  const normalized = normalizeState(raw);
  return {
    state: normalized,
    petTypes: DEFAULT_PET_TYPES,
    shopItems: SHOP_ITEMS,
    message: getStatusMessage(normalized),
    iCloudMirrorDir: getICloudMirrorDir()
  };
}

function registerIpc() {
  ipcMain.handle('pet:get', async () => {
    state = tick(state);
    return saveAndBroadcast();
  });

  ipcMain.handle('pet:care', async (_event, payload = {}) => {
    const action = String(payload.action || '');
    const allowed = new Set(['feed', 'play', 'clean', 'rest', 'medicine', 'work', 'rebirth']);
    if (!allowed.has(action)) throw new Error('Unsupported care action.');
    state = care(state, action, payload);
    return saveAndBroadcast();
  });

  ipcMain.handle('pet:buy', async (_event, payload = {}) => {
    const itemId = String(payload.itemId || '');
    state = buy(state, itemId, payload.quantity || 1);
    return saveAndBroadcast();
  });

  ipcMain.handle('pet:settings', async (_event, payload = {}) => {
    const next = normalizeState(state);
    if (Object.prototype.hasOwnProperty.call(payload, 'focusMode')) {
      next.settings.focusMode = Boolean(payload.focusMode);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'soundEnabled')) {
      next.settings.soundEnabled = Boolean(payload.soundEnabled);
    }
    if (payload.position && typeof payload.position === 'object') {
      next.settings.position = fitToDisplay(Number(payload.position.x || 0), Number(payload.position.y || 0));
      mainWindow?.setPosition(next.settings.position.x, next.settings.position.y);
    }
    state = next;
    refreshTray();
    return saveAndBroadcast();
  });
}

app.whenReady().then(async () => {
  state = await loadState(app.getPath('userData'));
  state = tick(state);
  registerIpc();
  createWindow();
  createTray();
  await saveAndBroadcast();

  setInterval(() => {
    state = tick(state);
    scheduleSave();
  }, 60 * 1000).unref();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

process.on('SIGTERM', () => {
  app.isQuitting = true;
  app.quit();
});
