import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {createDemo} from './demo';
import type {Asset,DemoState,Order,Wish} from './model';
import {defaultSettings,emptyState,legacyBackupSchema,migrateState,workspaceSchema,type UserSettings,type WorkspaceData} from '../../shared/user-data';
import bundled from '../../shared/catalog-bundled.json';
import {snapshotSchema} from '../../shared/catalog';
export const backupSchema=legacyBackupSchema;
export type BootData={data:WorkspaceData;error:string;path:string};
const STORAGE='cs-rent-prototype-v1',WEB_STORAGE='cs-rent-user-data-v2';
export async function loadUserData():Promise<BootData>{
  if(window.desktop?.data){
    const result=await window.desktop.data.get();
    if(result.exists||result.error)return result;
    try{
      const saved=localStorage.getItem(STORAGE);
      if(saved){result.data.state=migrateState(legacyBackupSchema.parse(JSON.parse(saved)).state);result.data.space='demo';}
      else if(window.desktop.mode==='test-demo'){result.data.state=migrateState(createDemo());result.data.space='demo';}
      await window.desktop.data.save(result.data.state,result.data.space);
    }catch{return {...result,error:'旧版数据迁移失败，旧记录已保留；请先导入有效备份，暂不保存空账本。'};}
    return result;
  }
  const initial:WorkspaceData={format:'cs-rent-user-data',schemaVersion:2,appVersion:'0.7.0',exportedAt:new Date().toISOString(),space:'personal',state:emptyState(),settings:{...defaultSettings,theme:localStorage.getItem('cs-rent-theme')==='dark'?'dark':'light'},catalog:snapshotSchema.parse(bundled)};
  try{
    const saved=localStorage.getItem(WEB_STORAGE);if(saved)return {data:workspaceSchema.parse(JSON.parse(saved)),error:'',path:'浏览器存储'};
    const legacy=localStorage.getItem(STORAGE);if(legacy){initial.state=migrateState(legacyBackupSchema.parse(JSON.parse(legacy)).state);initial.space='demo';}
    return {data:initial,error:'',path:'浏览器存储'};
  }catch{return {data:initial,error:'本机记录未能读取，请导入有效备份；原记录未覆盖。',path:'浏览器存储'};}
}
type Context={state:DemoState;setState:React.Dispatch<React.SetStateAction<DemoState>>;settings:UserSettings;setSettings:(v:Partial<UserSettings>)=>void;space:'personal'|'demo';storageError:boolean;readError:string;dataPath:string;flush:()=>Promise<void>;reset:(empty?:boolean)=>void};
const Store=createContext<Context>(null!);
export function Provider({children,initial}:{children:ReactNode;initial:BootData}){
  const [state,setState]=useState<DemoState>(initial.data.state);
  const [settings,setPreferences]=useState<UserSettings>(initial.data.settings);
  const [space,setSpace]=useState(initial.data.space);
  const [storageError,setStorageError]=useState(!!initial.error);
  const pending=useRef<Promise<unknown>>(Promise.resolve());
  const settingsPending=useRef<Promise<unknown>>(Promise.resolve());
  const setSettings=(v:Partial<UserSettings>)=>setPreferences(p=>({...p,...v}));
  useEffect(()=>{
    if(initial.error)return;
    const persist=async()=>{
      if(window.desktop?.data)await window.desktop.data.save(state,space);
      else localStorage.setItem(WEB_STORAGE,JSON.stringify({...initial.data,state,space,settings,exportedAt:new Date().toISOString()}));
      // Compatibility copy for older prototype versions. Desktop reads workspace-v2.json first.
      try{localStorage.setItem(STORAGE,JSON.stringify({format:STORAGE,state}));}catch{/* The desktop file is authoritative; the compatibility mirror is optional. */}
    };
    pending.current=persist();pending.current.then(()=>setStorageError(false)).catch(()=>setStorageError(true));
  },[state,space]);
  useEffect(()=>{
    if(initial.error)return;
    const persist=async()=>{
      if(window.desktop?.data)await window.desktop.data.settings(settings);
      else localStorage.setItem(WEB_STORAGE,JSON.stringify({...initial.data,state,space,settings,exportedAt:new Date().toISOString()}));
      try{localStorage.setItem('cs-rent-theme',settings.theme);}catch{/* Theme is already in the complete user data. */}
    };
    settingsPending.current=persist();settingsPending.current.then(()=>setStorageError(false)).catch(()=>setStorageError(true));
  },[settings]);
  const reset=(empty=false)=>{setState(empty?emptyState():migrateState(createDemo()));setSpace(empty?'personal':'demo');};
  return <Store.Provider value={{state,setState,settings,setSettings,space,storageError,readError:initial.error,dataPath:initial.path,flush:async()=>{await Promise.all([pending.current,settingsPending.current]);},reset}}>{children}</Store.Provider>;
}
export const useStore=()=>useContext(Store);
export function downloadJson(value:unknown,filename:string){
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function addAsset(state:DemoState,asset:Asset):DemoState{
  const order:Order|null=asset.platform&&asset.cost!==null&&asset.cost>0&&asset.kind==='饰品'?{id:crypto.randomUUID(),assetId:asset.id,name:asset.name,platform:asset.platform,type:'购买',status:'已完成',amount:asset.cost,date:asset.date,source:'手工补录',note:'手工录入：成功购买按下单日记账'}:null;
  return {...state,assets:[asset,...state.assets],orders:order?[order,...state.orders]:state.orders};
}
export function addWish(state:DemoState,wish:Wish){return {...state,wishes:[wish,...state.wishes]};}
