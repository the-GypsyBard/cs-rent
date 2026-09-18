import { z } from 'zod';
import {isLimitedGroup,type CatalogGroup,type CatalogSnapshot} from './catalog';
type Kv=string|{[key:string]:Kv}|Kv[];
export function parseKeyValues(text:string):Record<string,Kv> {
  if(text.length>20_000_000)throw Error('游戏目录过大');
  const tokens=text.match(/"(?:\\.|[^"\\])*"|\/\/[^\r\n]*|[{}]|[^\s{}"]+/g)?.filter(t=>!t.startsWith('//'))||[];
  let pos=0;
  const value=(t:string)=>t.startsWith('"')?t.slice(1,-1).replace(/\\"/g,'"').replace(/\\\\/g,'\\'):t;
  function object(n:number):Record<string,Kv>{if(n>64)throw Error('游戏目录嵌套过深');const out:Record<string,Kv>=Object.create(null);
    while(pos<tokens.length){let k=tokens[pos++];if(k==='}'){if(!n)throw Error('多余结束符');return out;}if(k==='{')throw Error('缺少字段名');k=value(k);const t=tokens[pos++];if(!t||t==='}')throw Error('缺少字段值');const v=t==='{'?object(n+1):value(t);if(Object.hasOwn(out,k)){if(!Array.isArray(out[k]))out[k]=[out[k]];(out[k] as Kv[]).push(v);}else out[k]=v;}
    if(n)throw Error('游戏目录不完整');return out;
  }
  return object(0);
}
function walk(v:Kv|undefined,fn:(o:Record<string,Kv>)=>void){if(!v||typeof v==='string')return;if(Array.isArray(v)){v.forEach(x=>walk(x,fn));return;}fn(v);Object.values(v).forEach(x=>walk(x,fn));}
export function armoryGroupIds(text:string) {
  const tree=parseKeyValues(text);const ids=new Set<string>();let found=false;
  walk(tree.items_game,o=>{if(o.redeemable_goods!=='xpshop')return;found=true;walk(o.operational_point_redeemable,r=>{
    const name=r.item_name;if(typeof name!=='string')return;
    if(name.startsWith('lootlist:set_'))ids.add('collection-'+name.slice(9).replaceAll('_','-'));
    if(/^crate_community_\d+$/.test(name))ids.add('collection-set-'+name.slice(6).replaceAll('_','-'));
  });});
  if(!found||!ids.size)throw Error('无法识别当前武库目录，已保留上次成功状态');return ids;
}
const newsSchema=z.object({appnews:z.object({newsitems:z.array(z.object({date:z.number(),url:z.string().max(3000),contents:z.string().max(500000)})).min(1).max(1000)})});
const normalize=(s:string)=>s.toLowerCase().replace(/&amp;/g,'&').replace(/[^a-z0-9]+/g,' ').trim();
export function availabilityEvents(group:CatalogGroup,news:ReturnType<typeof newsSchema.parse>['appnews']['newsitems']) {
  const identity=normalize((group.english||'').replace(/^The /,'').replace(/ (?:Collection|Case|Terminal)$/,''));
  if(!identity)return [];
  const aliases=[identity];if(identity==='graphic design')aliases.push('graphic');if(identity==='dust 2')aliases.push('dust ii');
  const events:NonNullable<CatalogGroup['availability']>=[];
  for(const n of news){
    let section='';
    for(const part of n.contents.split('[*]')){
      let plain=part.replace(/\[\/?(?:p|list|b|i|url|h\d|img|u|strike)[^\]]*\]/g,' ').replace(/\[\/\*\]/g,' ');
      const headings=[...plain.matchAll(/\\?\[\s*([A-Z][A-Z\s]+)\s*\]/g)];
      const inherited=section;if(headings.length)section=headings.at(-1)![1].trim();
      // BBCode list endings can append the next section/map name to this bullet.
      // It is not part of the reward announcement and must never match a collection.
      if(headings.length)plain=plain.slice(0,headings[0].index);
      const channel=/weekly care package|available as a weekly drop/i.test(plain)||inherited==='WEEKLY CARE PACKAGE'?'每周补给':/\barmory\b/i.test(plain)||inherited==='ARMORY'?'武库通行证':null;
      if(!channel)continue;
      const status=/^\s*Removed\b/i.test(plain)||/no longer available (?:to claim from|in) the armory/i.test(plain)?'retired':/^\s*Added\b/i.test(plain)||/available as a weekly drop/i.test(plain)?'active':null;
      const p=' '+normalize(plain)+' ';
      if(!status||!aliases.some(a=>p.includes(' '+a+' ')))continue;
      // A plain map name must not match a separately released year-specific collection.
      if(!/\d/.test(identity)&&new RegExp('(?:20\\d{2} '+identity+'|'+identity+' \\d+)').test(p))continue;
      if(!/collection|case|drop list/i.test(plain))continue;
      let source=n.url;try{const u=new URL(source);if(!['steamstore-a.akamaihd.net','store.steampowered.com','steamcommunity.com'].includes(u.hostname)||u.protocol!=='https:')continue;}catch{continue;}
      events.push({channel,status,date:new Date(n.date*1000).toISOString().slice(0,10),source});
    }
  }
  return events.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
}
function limitedEvents(name:string,news:ReturnType<typeof newsSchema.parse>['appnews']['newsitems']){
 const events:NonNullable<CatalogGroup['availability']>=[];const identity=normalize(name);
 for(const n of news){
  for(const part of n.contents.split('[*]')){const plain=part.replace(/\[[^\]]*\]/g,' '),p=normalize(plain);
   if(!p.includes(identity)||!(/\barmory\b|Limited Edition Item/i.test(plain)))continue;
   if(!/no longer available (?:to claim from|in) the armory/i.test(plain))continue;
   try{const u=new URL(n.url);if(u.protocol!=='https:'||!['steamstore-a.akamaihd.net','store.steampowered.com','steamcommunity.com'].includes(u.hostname))continue;}catch{continue;}
   events.push({channel:'武库通行证',status:'retired',date:new Date(n.date*1000).toISOString().slice(0,10),source:n.url});
  }
 }return events.sort((a,b)=>a.date!.localeCompare(b.date!));
}
export function applyAvailability(snapshot:CatalogSnapshot,game:string,newsInput:unknown,gameRevision:string,previous?:CatalogSnapshot) {
  const ids=armoryGroupIds(game);const news=newsSchema.parse(newsInput).appnews.newsitems;
  // The public catalog currently combines historical limited weapon loot lists in one group.
  const limited=snapshot.groups.filter(isLimitedGroup);
  for(const id of [...ids])if(/^collection-set-xpshop-wpn-\d+$/.test(id)&&!snapshot.groups.some(g=>g.id===id)&&limited.length===1){ids.delete(id);ids.add(limited[0].id);}
  for(const id of ids)if(!snapshot.groups.some(g=>g.id===id))throw Error('游戏武库与饰品目录尚未同步，已保留上次成功目录');
  for(const g of snapshot.groups){if(g.kind!=='gun')continue;
    const old=previous?.groups.find(x=>x.id===g.id);
    const history=[...(old?.availability||[]),...availabilityEvents(g,news)];
    // Deduplicate dated announcements without erasing observed returns whose exact date is unknown.
    const seen=new Set<string>();g.availability=history.filter(e=>{const key=JSON.stringify(e);if(seen.has(key))return false;seen.add(key);return true;});
    const dated=g.availability.filter(e=>e.date).sort((a,b)=>a.date!.localeCompare(b.date!));
    g.availability=[...dated,...g.availability.filter(e=>!e.date)];
    g.armory=isLimitedGroup(g)||ids.has(g.id)||old?.armory||g.availability.some(e=>e.channel==='武库通行证');
    if(g.armory){const latest=g.availability.filter(e=>e.channel==='武库通行证').at(-1);const status=ids.has(g.id)?'active':'retired';
      if(latest?.status!==status)g.availability.push({channel:'武库通行证',status,source:`https://github.com/SteamTracking/GameTracking-CS2/blob/${gameRevision}/game/csgo/pak01_dir/scripts/items/items_game.txt`});
    }
    if(isLimitedGroup(g))for(const skin of g.members){
      const previousSkin=old?.members.find(s=>s.id===skin.id);
      const events=[...(previousSkin?.availability||[]),...limitedEvents(skin.english,news)];
      skin.availability=[...new Map(events.map(e=>[JSON.stringify(e),e])).values()];
      // A group can aggregate several historical limited loot lists. If any is live,
      // do not claim that all historical skins are redeemable. Absence of ALL is conclusive only for this channel.
      if(!ids.has(g.id)&&skin.availability.at(-1)?.status!=='retired')skin.availability.push({channel:'武库通行证',status:'retired',source:`https://github.com/SteamTracking/GameTracking-CS2/blob/${gameRevision}/game/csgo/pak01_dir/scripts/items/items_game.txt`});
      else if(ids.has(g.id))skin.availability.push({channel:'武库通行证',status:'unknown',source:'限定分组当前可兑换，单件对应关系须核实'});
    }
  }
  snapshot.gameRevision=gameRevision;snapshot.availabilityCheckedAt=new Date().toISOString();return snapshot;
}
export function latestAvailability(g:CatalogGroup){return [...new Map((g.availability||[]).map(e=>[e.channel,e])).values()];}
export function availabilityLabel(g:CatalogGroup) {
  const events=latestAvailability(g);if(!events.length)return '官方投放状态待核实';
  return events.map(e=>e.status==='active'?`${e.channel} · 当前可获取`:e.status==='retired'?`${e.channel} · 已停止投放 · ${e.date||'停投日期待核实'}`:`${e.channel} · 待核实`).join('；');
}
