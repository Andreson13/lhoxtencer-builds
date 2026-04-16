import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronApp', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});