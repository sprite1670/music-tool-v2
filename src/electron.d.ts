export interface ElectronAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  openFile: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
  saveFile: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
  selectFolder: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
  readFile: (path: string) => Promise<{ ok: boolean; data?: string; error?: string }>;
  writeFile: (path: string, content: string) => Promise<{ ok: boolean; error?: string }>;
  exists: (path: string) => Promise<boolean>;
  searchMusic: (keyword: string, source?: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
  getLyrics: (songId: string, source?: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
  getSongDetail: (songId: string, source?: string) => Promise<{ ok: boolean; data?: any; error?: string }>;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
