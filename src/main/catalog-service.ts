import { open, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeCatalog, snapshotSchema, validateTransition, type CatalogSnapshot } from '../shared/catalog';
import bundledData from '../shared/catalog-bundled.json';
import { applyAvailability } from '../shared/availability';

export const bundled = snapshotSchema.parse(bundledData);
export async function fetchText(url: string, limit: number) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' });
  if (!response.ok) throw new Error(`目录服务暂不可用（HTTP ${response.status}）`);
  if (!response.body) throw new Error('目录服务返回空内容');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) throw new Error('目录超过允许大小');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}
export async function downloadCatalog(read = fetchText,withAvailability=true): Promise<CatalogSnapshot> {
  const feed = await read('https://github.com/ByMykel/CSGO-API/commits/main.atom', 2_000_000);
  const revision = feed.match(/Grit::Commit\/([a-f0-9]{40})<\/id>/)?.[1];
  if (!revision) throw new Error('无法确认目录版本，请稍后重试');
  const data = await Promise.all(['en/skins', 'zh-CN/skins', 'zh-CN/collections','en/collections'].map(async file =>
    JSON.parse(await read(`https://raw.githubusercontent.com/ByMykel/CSGO-API/${revision}/public/api/${file}.json`, 30_000_000))));
  let snapshot:CatalogSnapshot;
  try { snapshot=normalizeCatalog(data[0], data[1], data[2], revision,data[3]); }
  catch { throw new Error('目录数据校验未通过，已保留上次成功目录'); }
  if(!withAvailability)return snapshot;
  return downloadAvailability(snapshot,bundled,read);
}
export async function downloadAvailability(snapshot:CatalogSnapshot,previous=snapshot,read=fetchText){
  const gameFeed=await read('https://github.com/SteamTracking/GameTracking-CS2/commits/master.atom',2_000_000);
  const gameRevision=gameFeed.match(/Grit::Commit\/([a-f0-9]{40})<\/id>/)?.[1];
  if(!gameRevision)throw Error('无法确认游戏资源版本，已保留上次成功目录');
  const [game,news]=await Promise.all([
    read(`https://raw.githubusercontent.com/SteamTracking/GameTracking-CS2/${gameRevision}/game/csgo/pak01_dir/scripts/items/items_game.txt`,20_000_000),
    read('https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=730&count=500&maxlength=0&feeds=steam_community_announcements',8_000_000),
  ]);
  return applyAvailability(snapshot,game,JSON.parse(news),gameRevision,previous);
}
export class CatalogService {
  private current: CatalogSnapshot = bundled;
  private inFlight: Promise<CatalogSnapshot> | null = null;
  private loadPromise: Promise<void>;
  warning = '';
  constructor(private directory: string, private download = downloadCatalog) {
    this.loadPromise = this.load();
  }
  private async load() {
    try {
      const saved = snapshotSchema.parse(JSON.parse(await readFile(join(this.directory, 'catalog-v1.json'), 'utf8')));
      if(!saved.availabilityCheckedAt){
        saved.groups=saved.groups.map(g=>{const b=bundled.groups.find(x=>x.id===g.id);return b?{...g,type:b.type,releaseDate:b.releaseDate,english:b.english,armory:b.armory,availability:b.availability,members:g.members.map(s=>({...s,...b.members.find(m=>m.id===s.id)}))}:g;});
        saved.gameRevision=bundled.gameRevision;saved.availabilityCheckedAt=bundled.availabilityCheckedAt;
      }
      this.current = validateTransition(bundled, saved);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        this.warning = '本机目录缓存未能读取，已使用内置目录。可手动刷新重试。';
    }
  }
  async get() { await this.loadPromise; return { snapshot: this.current, warning: this.warning }; }
  async adopt(snapshot:CatalogSnapshot) { await this.loadPromise;this.current=snapshotSchema.parse(snapshot);this.warning=''; }
  refresh() {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.update().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
  refreshAvailability(){
    if(this.inFlight)return this.inFlight;
    this.inFlight=this.update(true).finally(()=>{this.inFlight=null;});return this.inFlight;
  }
  private async update(availabilityOnly=false) {
    await this.loadPromise;
    const next = validateTransition(this.current, availabilityOnly?await downloadAvailability(structuredClone(this.current),this.current):await this.download());
    for(const g of next.groups){const old=this.current.groups.find(x=>x.id===g.id);if(old?.availability){
      const fresh=g.availability||[];const seen=new Set<string>();
      // Preserve historical observations, then append this refresh's latest channel state.
      g.availability=[...old.availability,...fresh].filter(e=>{const key=JSON.stringify(e);if(seen.has(key))return false;seen.add(key);return true;});
      for(const channel of new Set(fresh.map(e=>e.channel))){const latest=fresh.filter(e=>e.channel===channel).at(-1)!;if(g.availability.filter(e=>e.channel===channel).at(-1)?.status!==latest.status)g.availability.push({...latest,date:undefined});}
      g.armory ||=old.armory;
    }}
    // Keep bundled art for offline examples while allowing metadata to evolve.
    const local = new Map(bundled.groups.flatMap(g => g.members.map(s => [s.id, s.image] as const)));
    for (const g of next.groups) {
      const old = bundled.groups.find(b => b.id === g.id);
      if (old?.image.startsWith('./')) g.image = old.image;
      for (const s of g.members) if (local.get(s.id)?.startsWith('./')) s.image = local.get(s.id)!;
    }
    const order = new Map(this.current.groups.map((g,i) => [g.id,i]));
    next.groups.sort((a,b) => (order.get(a.id) ?? 1e6) - (order.get(b.id) ?? 1e6));
    const temporary = join(this.directory, 'catalog-v1.pending.json');
    try {
      const handle = await open(temporary, 'w');
      try { await handle.writeFile(JSON.stringify(next)); await handle.sync(); }
      finally { await handle.close(); }
      await rename(temporary, join(this.directory, 'catalog-v1.json'));
    } catch {
      await rm(temporary, { force: true }).catch(() => {});
      throw new Error('目录保存失败，已保留上次成功目录，请检查磁盘空间后重试');
    }
    this.current = next; this.warning = '';
    return next;
  }
}
