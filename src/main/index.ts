import { app, BrowserWindow, Menu, ipcMain, shell, dialog } from "electron";
import { join } from "node:path";
import { CatalogService } from './catalog-service';
import {SteamdtApi,SteamdtCredentials} from './steamdt-api';
import { resolveMarketLink } from './market-service';
import { Preferences } from './preferences';
import { WorkspaceService } from './workspace-service';
import { parseBackup } from '../shared/user-data';
import { readFile,writeFile,stat } from 'node:fs/promises';
import { resolveReferencePrice,CollectionQuoteService } from './market-service';

app.setName("CS饰品平台-交互原型");
if (!app.isPackaged && process.env.CS_RENT_TEST_DATA)
  app.setPath("userData", process.env.CS_RENT_TEST_DATA);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  let mainWindow: BrowserWindow | null = null;
  app.on("second-instance", () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  app.whenReady().then(async () => {
    const catalog = new CatalogService(app.getPath('userData'));
    const preferences = new Preferences(app.getPath('userData'));
    const workspace = new WorkspaceService(app.getPath('userData'),(await catalog.get()).snapshot,await preferences.getTheme());
    const initial=await workspace.get();await catalog.adopt(initial.data.catalog);
    const savedTheme = initial.data.settings.theme;
    const verify = (event: Electron.IpcMainInvokeEvent) => {
      if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame)
        throw new Error('不允许的目录请求');
    };
    ipcMain.handle('catalog:get', async event => { verify(event); return catalog.get(); });
    ipcMain.handle('preferences:getTheme', async event => { verify(event); return (await workspace.get()).data.settings.theme; });
    ipcMain.handle('preferences:setTheme', async (event, theme) => { verify(event); try { await workspace.setSettings({theme}); return {ok:true}; } catch { return {ok:false}; } });
    ipcMain.handle('data:get',async event=>{verify(event);return workspace.get();});
    ipcMain.handle('data:save',async(event,state,space)=>{verify(event);if(space!==undefined&&!['personal','demo'].includes(space))throw Error('无效的账本类型');await workspace.saveState(state,space);return {ok:true};});
    ipcMain.handle('data:settings',async(event,settings)=>{verify(event);await workspace.setSettings(settings);return {ok:true};});
    ipcMain.handle('data:export',async event=>{
      verify(event);const data=await workspace.export();const result=await dialog.showSaveDialog(mainWindow!,{title:'导出完整用户备份',defaultPath:`CS饰品平台-完整备份-${new Date().toISOString().slice(0,10)}.json`,filters:[{name:'用户备份',extensions:['json']}]});
      if(result.canceled||!result.filePath)return {canceled:true};await writeFile(result.filePath,JSON.stringify(data,null,2));return {ok:true,path:result.filePath};
    });
    // The renderer previews the validated backup; only this main-process-held copy can be restored.
    let pendingBackup:ReturnType<typeof parseBackup>|null=null;
    ipcMain.handle('data:chooseImport',async event=>{
      verify(event);pendingBackup=null;const chosen=await dialog.showOpenDialog(mainWindow!,{title:'导入完整用户备份',properties:['openFile'],filters:[{name:'用户备份',extensions:['json']}]});
      if(chosen.canceled||!chosen.filePaths[0])return {canceled:true};const path=chosen.filePaths[0];if((await stat(path)).size>100_000_000)throw Error('备份超过 100 MB，请联系开发者处理，未修改当前数据');
      const current=(await workspace.get()).data;pendingBackup=parseBackup(JSON.parse(await readFile(path,'utf8')),current);
      return {ok:true,summary:{assets:pendingBackup.state.assets.length,orders:pendingBackup.state.orders.length,wishes:pendingBackup.state.wishes.length,theme:pendingBackup.settings.theme,catalogGroups:pendingBackup.catalog.groups.length,version:pendingBackup.schemaVersion}};
    });
    ipcMain.handle('data:restore',async event=>{verify(event);if(!pendingBackup)throw Error('请先选择并校验备份');const data=await workspace.restore(pendingBackup);await catalog.adopt(data.catalog);pendingBackup=null;return {ok:true};});
    ipcMain.handle('data:openDirectory',async event=>{verify(event);return shell.openPath(workspace.directory);});
    const credentials=new SteamdtCredentials(app.getPath('userData'));
    const steamdt=new SteamdtApi(app.getPath('userData'),credentials);
    const collectionQuotes=new CollectionQuoteService(steamdt);
    ipcMain.handle('steamdt:status',async event=>{verify(event);return {...await credentials.status(),...await steamdt.baseStatus()};});
    ipcMain.handle('steamdt:save',async(event,key)=>{verify(event);await credentials.set(key);steamdt.clearQuotes();collectionQuotes.clear();return {ok:true};});
    ipcMain.handle('steamdt:clear',async event=>{verify(event);await credentials.clear();steamdt.clearQuotes();collectionQuotes.clear();return {ok:true};});
    ipcMain.handle('steamdt:syncBase',async event=>{verify(event);return steamdt.syncBase();});
    ipcMain.handle('steamdt:test',async event=>{verify(event);await steamdt.getPrices('AK-47 | Redline (Field-Tested)');return {ok:true};});
    ipcMain.handle('market:collectionQuote',async(event,request)=>{verify(event);return collectionQuotes.get(request,(await catalog.get()).snapshot);});
    ipcMain.handle('market:quote',async(event,request)=>{verify(event);return resolveReferencePrice(request,(await catalog.get()).snapshot,steamdt);});
    ipcMain.handle('market:open',async(event,request)=>{verify(event);try{const result=await resolveMarketLink(request,(await catalog.get()).snapshot,steamdt);await shell.openExternal(result.url);return {ok:true,...result};}catch(e){return {ok:false,error:e instanceof Error?e.message:'打开失败'};}});
    ipcMain.handle('catalog:availability',async event=>{
      verify(event);const previous=(await workspace.get()).data.catalog;
      try{const snapshot=await catalog.refreshAvailability();await workspace.setCatalog(snapshot);return {ok:true,snapshot};}
      catch(error){await catalog.adopt(previous);return {ok:false,error:error instanceof Error?error.message:'状态同步失败，保留原结果'};}
    });
    ipcMain.handle('catalog:refresh', async event => {
      verify(event);
      const previous=(await workspace.get()).data.catalog;
      try { const snapshot=await catalog.refresh();await workspace.setCatalog(snapshot);return { ok: true, snapshot }; }
      catch (error) { await catalog.adopt(previous);return { ok: false, error: error instanceof Error ? error.message : '目录刷新失败，已保留原目录' }; }
    });
    Menu.setApplicationMenu(null);
    mainWindow = new BrowserWindow({
      width: 1480,
      height: 950,
      minWidth: 1050,
      minHeight: 700,
      title: "CS 饰品平台 · 交互验收原型",
      backgroundColor: savedTheme === 'dark' ? '#141d2b' : '#f5f7fa',
      webPreferences: {
        additionalArguments: !app.isPackaged&&process.env.CS_RENT_TEST_DATA&&process.env.CS_RENT_TEST_DEMO==='1'?['--cs-rent-test-demo']:[],
        preload: join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    mainWindow.webContents.on("will-navigate", (event,url) => {
      // A successful backup restore reloads this exact local page; other navigation stays blocked.
      if(url!==mainWindow?.webContents.getURL())event.preventDefault();
    });
    mainWindow.webContents.session.setPermissionRequestHandler(
      (_wc, _permission, callback) => callback(false),
    );
    if (process.env.ELECTRON_RENDERER_URL)
      mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    else mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  });
  app.on("window-all-closed", () => app.quit());
}
