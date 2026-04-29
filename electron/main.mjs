import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);

const getWindowIconPath = () => {
  if (isDevelopment) {
    return path.join(__dirname, '..', 'build', 'icon.ico');
  }

  return path.join(__dirname, 'assets', 'icon.ico');
};

const createMainWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    title: 'Hotel Harmony',
    icon: getWindowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
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
  app.setAppUserModelId('com.hotelharmony.desktop');
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