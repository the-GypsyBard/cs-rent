import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld(
  "desktop",
  Object.freeze({ mode: process.argv.includes('--cs-rent-test-demo')?'test-demo':"prototype", version: "0.8.0", steamdt:Object.freeze({status:()=>ipcRenderer.invoke('steamdt:status'),save:(key:string)=>ipcRenderer.invoke('steamdt:save',key),clear:()=>ipcRenderer.invoke('steamdt:clear'),syncBase:()=>ipcRenderer.invoke('steamdt:syncBase'),test:()=>ipcRenderer.invoke('steamdt:test')}),data:Object.freeze({get:()=>ipcRenderer.invoke('data:get'),save:(state:unknown,space?:string)=>ipcRenderer.invoke('data:save',state,space),settings:(settings:unknown)=>ipcRenderer.invoke('data:settings',settings),export:()=>ipcRenderer.invoke('data:export'),chooseImport:()=>ipcRenderer.invoke('data:chooseImport'),restore:()=>ipcRenderer.invoke('data:restore'),openDirectory:()=>ipcRenderer.invoke('data:openDirectory')}),collectionQuote:(request:unknown)=>ipcRenderer.invoke('market:collectionQuote',request),quote:(request:unknown)=>ipcRenderer.invoke('market:quote',request),preferences:Object.freeze({getTheme:()=>ipcRenderer.invoke('preferences:getTheme'),setTheme:(theme:unknown)=>ipcRenderer.invoke('preferences:setTheme',theme)}), openMarket:(request:unknown)=>ipcRenderer.invoke('market:open',request), catalog: Object.freeze({
    get: () => ipcRenderer.invoke('catalog:get'),
    refresh: () => ipcRenderer.invoke('catalog:refresh'),
    availability:()=>ipcRenderer.invoke('catalog:availability'),
  }) }),
);
