import {z} from 'zod';
import {marketHashName,steamdtUrl,summarizeQuotes,type CollectionQuote,type PriceQuote} from '../shared/market';
import {compareStyles} from '../shared/presentation';
import {platformNames,type PlatformPrice} from '../shared/steamdt';
import type {CatalogSnapshot} from '../shared/catalog';
export type MarketApi={getPrices:(name:string,refresh?:boolean)=>Promise<PlatformPrice[]>;getStyle:(name:string,style:string,refresh?:boolean)=>Promise<PriceQuote>;platformLink:(name:string,platform:string)=>Promise<string|undefined>};
const request=z.object({skinId:z.string().max(200),wear:z.string().max(100),version:z.enum(['普通','StatTrak™','纪念品']),refresh:z.boolean().optional(),platform:z.string().refine(p=>Object.values(platformNames).includes(p)).optional()});
export async function resolveMarketLink(raw:unknown,snapshot:CatalogSnapshot,api:MarketApi){
 const r=request.parse(raw),skin=snapshot.groups.flatMap(g=>g.members).find(s=>s.id===r.skinId);if(!skin)throw Error('此饰品尚未收录，刷新目录后重试');
 const name=marketHashName(skin,r.wear,r.version),fallback=steamdtUrl(name);
 if(r.platform){try{const url=await api.platformLink(name,r.platform);if(url)return {url,target:r.platform,fallback:false};}catch{}}
 return {url:fallback,target:'SteamDT',fallback:!!r.platform};
}
export async function resolveReferencePrice(raw:unknown,snapshot:CatalogSnapshot,api:MarketApi):Promise<PriceQuote&{prices?:PlatformPrice[]}>{
 const r=request.parse(raw),skin=snapshot.groups.flatMap(g=>g.members).find(s=>s.id===r.skinId);if(!skin)throw Error('商品不在目录中');
 const name=marketHashName(skin,r.wear,r.version);
 try{
  if(skin.phase)return await api.getStyle(name,skin.phase,r.refresh);
  const prices=await api.getPrices(name,r.refresh);if(!prices.length)return {ok:false,error:'暂无 24 小时内的有效在售报价，保留待估值'};
  return {ok:true,kind:'sell',value:prices[0].cents,source:'SteamDT · '+prices[0].platform,updated:prices[0].updatedAt,prices};
 }catch(e){return {ok:false,error:e instanceof Error?e.message:'SteamDT API 获取失败'};}
}
export class CollectionQuoteService{
 private cache=new Map<string,{at:number;result:CollectionQuote}>();private pending=new Map<string,Promise<CollectionQuote>>();
 private running=0;private queue:(()=>void)[]=[];
 constructor(private api:MarketApi,private now=Date.now){}
 clear(){this.cache.clear();}
 async get(raw:unknown,snapshot:CatalogSnapshot):Promise<CollectionQuote>{
  const r=request.extend({refresh:z.boolean().optional()}).parse(raw),group=snapshot.groups.find(g=>g.members.some(s=>s.id===r.skinId)),skin=group?.members.find(s=>s.id===r.skinId);if(!skin||!group)throw Error('饰品不在目录中');
  const name=marketHashName(skin,r.wear,r.version),members=skin.phase?group.members.filter(s=>s.finishKey===skin.finishKey&&s.phase).sort((a,b)=>compareStyles(a.phase,b.phase)):[skin];
  const key=[name,...members.map(s=>s.id)].join('|'),cached=this.cache.get(key),ttl=r.refresh?3000:cached?.result.value?300000:30000;
  if(cached&&this.now()-cached.at<ttl)return cached.result;if(this.pending.has(key))return this.pending.get(key)!;
  if(this.queue.length>=80)throw Error('报价请求较多，请稍后重试');
  const task=(async()=>{
   if(this.running>=2)await new Promise<void>(resolve=>this.queue.push(resolve));else this.running++;
   try{
    const entries:CollectionQuote['entries']=[];
    for(const m of members){const q=await resolveReferencePrice({...r,skinId:m.id},snapshot,this.api);entries.push({...q,skinId:m.id,style:m.phase});}
    const result=summarizeQuotes(entries,r.wear);this.cache.set(key,{at:this.now(),result});if(this.cache.size>200)this.cache.delete(this.cache.keys().next().value!);return result;
   }finally{const next=this.queue.shift();if(next)next();else this.running--;}
  })().finally(()=>this.pending.delete(key));this.pending.set(key,task);return task;
 }
}
