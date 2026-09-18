import {z} from 'zod';
import {dopplerStyleKey,type PriceQuote} from './market';
export const platformNames:Record<string,string>={BUFF:'BUFF',YOUPIN:'悠悠有品',IGXE:'IGXE',C5:'C5GAME',STEAM:'Steam',HALOSKINS:'HaloSkins',DMARKET:'DMarket',CSMONEY:'CSMoney',SKINPORT:'SkinPort',WAXPEER:'WaxPeer'};
export const platformCode=(name:string)=>Object.keys(platformNames).find(k=>k===name.toUpperCase()||platformNames[k]===name);
export const apiPriceSchema=z.array(z.object({platform:z.string(),platformItemId:z.string().nullable().optional(),sellPrice:z.number().nullable().optional(),sellCount:z.number().nullable().optional(),updateTime:z.number().nullable().optional()})).max(100);
export const baseSchema=z.array(z.object({marketHashName:z.string().min(1).max(500),name:z.string().nullable().optional(),platformList:z.array(z.object({name:z.string(),itemId:z.string().nullable().optional()})).nullable().optional()})).max(100000);
export type BaseData=z.infer<typeof baseSchema>;
export type PlatformPrice={platform:string;code:string;itemId:string;cents:number;updatedAt:string};
const timestamp=(n:number)=>n>1e12?n:n*1000;
export function apiPrices(input:unknown,now=Date.now()):PlatformPrice[]{
 return apiPriceSchema.parse(input).flatMap(p=>{
  const code=platformCode(p.platform),value=p.sellPrice,time=p.updateTime==null?NaN:timestamp(p.updateTime);
  if(!code||value==null||!Number.isFinite(value)||value<=0||value>1e10||!Number.isFinite(time)||time>now+300000||now-time>86400000||p.sellCount===0)return [];
  return [{platform:platformNames[code],code,itemId:p.platformItemId||'',cents:Math.round(value*100),updatedAt:new Date(time).toISOString()}];
 }).sort((a,b)=>a.cents-b.cents);
}
export function styleClosingQuote(input:unknown,now=Date.now()):PriceQuote{
 const rows=z.array(z.array(z.union([z.number(),z.string()])).min(5).max(10)).max(20000).parse(input);
 const latest=rows.map(r=>({time:timestamp(Number(r[0])),close:Number(r[2])})).filter(r=>Number.isFinite(r.time)&&r.time<=now+300000&&Number.isFinite(r.close)&&r.close>0&&r.close<=1e10).sort((a,b)=>b.time-a.time)[0];
 // Never silently use an old candle as a current reference, nor its low instead of its close.
 if(!latest||now-latest.time>7*86400000)return {ok:false,kind:'style-close',error:'暂无 7 天内的款式收盘参考价'};
 return {ok:true,kind:'style-close',value:Math.round(latest.close*100),source:'SteamDT · 款式收盘参考',updated:new Date(latest.time).toISOString()};
}
export function styleKey(style:string){const key=dopplerStyleKey(style);if(!['p1','p2','p3','p4','ruby','sapphire','blackpearl','emerald'].includes(key))throw Error('暂不支持此款式');return key;}
/** IDs come from the exact product in the official API; never accept renderer-supplied URLs. */
export function apiPlatformUrl(platform:string,id:string,name:string){
 const code=platformCode(platform);if(code==='STEAM')return 'https://steamcommunity.com/market/listings/730/'+encodeURIComponent(name);
 if(!/^\d{1,30}$/.test(id))return;
 if(code==='BUFF')return `https://buff.163.com/goods/${id}?from=market#tab=selling`;
 if(code==='YOUPIN')return `https://www.youpin898.com/market/goods-list?listType=10&templateId=${id}&gameId=730`;
 if(code==='IGXE')return `https://www.igxe.cn/product/730/${id}`;
 if(code==='C5')return `https://www.c5game.com/csgo/${id}/${encodeURIComponent(name)}/sell`;
 if(code==='HALOSKINS')return `https://haloskins.com/zh-CN/market/${id}`;
}
export function sourcePlatform(source?:string){return Object.values(platformNames).find(p=>source?.split(' · ').includes(p));}
