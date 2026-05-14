const { app, BrowserWindow, shell, nativeTheme } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);

const getWindowIconPath = () => {
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  console.log('Loading icon from:', iconPath);
  return iconPath;
};

const createMainWindow = () => {
  const iconPath = getWindowIconPath();
  console.log('Loading icon from:', iconPath);
  console.log('Is development mode:', isDevelopment);

  const mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    title: 'Lhoxtencer',
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDevelopment) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  const fileUrl = pathToFileURL(indexPath).href;
  mainWindow.loadURL(fileUrl);
};

app.whenReady().then(() => {
  app.setAppUserModelId('com.lhoxtencer.desktop');
  nativeTheme.themeSource = 'dark';
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
