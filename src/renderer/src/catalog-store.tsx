import {styleLabel} from '../../shared/presentation';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import data from '../../shared/catalog-bundled.json';
import { snapshotSchema, catalogDifference, type CatalogSnapshot } from '../../shared/catalog';
declare global {
  interface Window { desktop?: { mode: string; version: string; steamdt:{status:()=>Promise<{configured:boolean;encryptionAvailable:boolean;count:number;updatedAt?:string;error?:string}>;save:(key:string)=>Promise<{ok:boolean}>;clear:()=>Promise<{ok:boolean}>;syncBase:()=>Promise<{count:number}>;test:()=>Promise<{ok:boolean}>}; collectionQuote:(request:import('../../shared/market').MarketRequest&{refresh?:boolean})=>Promise<import('../../shared/market').CollectionQuote>; quote:(request:import('../../shared/market').MarketRequest)=>Promise<{ok:boolean;value?:number;source?:string;updated?:string;error?:string;kind?:'sell'|'style-close';prices?:import('../../shared/steamdt').PlatformPrice[]}>;data:{get:()=>Promise<{data:import('../../shared/user-data').WorkspaceData;exists:boolean;error:string;path:string}>;save:(state:unknown,space?:'personal'|'demo')=>Promise<{ok:boolean}>;settings:(settings:Partial<import('../../shared/user-data').UserSettings>)=>Promise<{ok:boolean}>;export:()=>Promise<{ok?:boolean;canceled?:boolean;path?:string}>;chooseImport:()=>Promise<{ok?:boolean;canceled?:boolean;summary?:{assets:number;orders:number;wishes:number;theme:string;catalogGroups:number;version:number}}>;restore:()=>Promise<{ok:boolean}>;openDirectory:()=>Promise<string>};preferences:{getTheme:()=>Promise<'dark'|'light'|null>;setTheme:(theme:'dark'|'light')=>Promise<{ok:boolean}>}; openMarket:(request:import('../../shared/market').MarketRequest)=>Promise<{ok:boolean;target?:string;fallback?:boolean;error?:string}>; catalog: {
    get: () => Promise<{ snapshot: CatalogSnapshot; warning: string }>;
    refresh: () => Promise<{ ok: boolean; snapshot?: CatalogSnapshot; error?: string }>;
    availability: () => Promise<{ ok: boolean; snapshot?: CatalogSnapshot; error?: string }>;
  } }; }
}
const bundled = snapshotSchema.parse(data);
type Context = {
  snapshot: CatalogSnapshot; busy: boolean; error: string; notice: string; ready: boolean;
  refresh: (availabilityOnly?:boolean) => Promise<void>;
};
const Catalog = createContext<Context>(null!);
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CatalogSnapshot>(()=>{if(!window.desktop){try{const saved=localStorage.getItem('cs-rent-user-data-v2');if(saved)return snapshotSchema.parse(JSON.parse(saved).catalog);}catch{/* Fall back to bundled catalog. */}}return bundled;});
  const [ready, setReady] = useState(!window.desktop?.catalog);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    window.desktop?.catalog.get().then(result => {
      if (active) { setSnapshot(snapshotSchema.parse(result.snapshot)); setError(result.warning); }
    }).catch(() => { if (active) setError('本机目录读取失败，正在使用内置目录'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  async function refresh(availabilityOnly=false) {
    if (busy || !ready) return;
    if (!window.desktop?.catalog) { setError('请在桌面应用内刷新目录；网页预览使用内置目录。'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await (availabilityOnly?window.desktop.catalog.availability():window.desktop.catalog.refresh());
      if (!result.ok || !result.snapshot) throw new Error(result.error || '目录刷新失败，已保留原目录');
      const next = snapshotSchema.parse(result.snapshot);
      const diff = catalogDifference(snapshot, next);
      setSnapshot(next);
      setNotice(availabilityOnly?'已核对官方公告与当前武库目录；缺少可靠依据的项目仍标记为待核实。':diff.groups || diff.finishes ? `目录更新成功：新增 ${diff.groups} 个分组、${diff.finishes} 款涂装。` : '目录已检查，没有新增分组或涂装。');
    } catch (e) { setError(e instanceof Error ? e.message : '目录刷新失败，已保留原目录'); }
    finally { setBusy(false); }
  }
  return <Catalog.Provider value={{ snapshot, busy, error, notice, ready, refresh }}>{children}</Catalog.Provider>;
}
export const useCatalog = () => useContext(Catalog);
export function useCatalogSkins() {
  const { snapshot } = useCatalog();
  return useMemo(() => [...new Map(snapshot.groups.flatMap(c => c.members.map(m => [m.id, {
    ...m, collection: c.name, label: m.phase ? `${m.name} · ${styleLabel(m.phase)}` : m.name,
  }] as const))).values()], [snapshot]);
}
