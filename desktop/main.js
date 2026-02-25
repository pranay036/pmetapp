const { app, BrowserWindow, globalShortcut, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#f2f2f7',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: false
    }
  });

  Menu.setApplicationMenu(null);

  mainWindow.webContents.on('context-menu', () => {
    // Disable right-click inspect context menu in packaged app.
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase();
    const wantsDevTools =
      key === 'f12' ||
      ((input.control || input.meta) && input.shift && (key === 'i' || key === 'j' || key === 'c')) ||
      ((input.control || input.meta) && key === 'u');

    if (wantsDevTools) {
      event.preventDefault();
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'), {
    query: { desktop: '1' }
  });
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('CommandOrControl+Shift+I', () => {});
  globalShortcut.register('F12', () => {});
  globalShortcut.register('CommandOrControl+U', () => {});

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
