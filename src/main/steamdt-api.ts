import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {safeStorage} from 'electron';
import {apiPrices,baseSchema,styleClosingQuote,styleKey,platformCode,apiPlatformUrl,type BaseData,type PlatformPrice} from '../shared/steamdt';
import type {PriceQuote} from '../shared/market';

export class SteamdtCredentials{
 constructor(private directory:string){}
 async get(){
  try{const v=JSON.parse(await readFile(join(this.directory,'steamdt-credentials.json'),'utf8'));if(v.version!==1||typeof v.cipher!=='string')throw Error();return safeStorage.decryptString(Buffer.from(v.cipher,'base64'));}
  catch{throw Error('请先在设置中配置 SteamDT API_KEY');}
 }
 async status(){try{await this.get();return {configured:true,encryptionAvailable:safeStorage.isEncryptionAvailable()};}catch{return {configured:false,encryptionAvailable:safeStorage.isEncryptionAvailable()};}}
 async set(raw:unknown){
  if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{16,256}$/.test(raw.trim()))throw Error('API_KEY 格式不正确');
  if(!safeStorage.isEncryptionAvailable())throw Error('系统安全存储不可用，未保存密钥');
  const file=join(this.directory,'steamdt-credentials.json');await writeFile(file+'.pending',JSON.stringify({version:1,cipher:safeStorage.encryptString(raw.trim()).toString('base64')}));await rename(file+'.pending',file);
 }
 async clear(){await unlink(join(this.directory,'steamdt-credentials.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
type BaseCache={attemptedAt:number;updatedAt?:number;data?:BaseData;error?:string};
/** Only documented OpenAPI endpoints. Credentials never leave the main process except in Authorization. */
export class SteamdtApi{
 private prices=new Map<string,{at:number;data:PlatformPrice[]}>();
 private candles=new Map<string,{at:number;data:PriceQuote}>();
 private pending=new Map<string,Promise<unknown>>();
 private calls=new Map<string,number[]>();
 private base:BaseCache={attemptedAt:0};private loaded:Promise<void>;
 constructor(private directory:string,private credentials:{get:()=>Promise<string>},private read:typeof fetch=fetch,private now=Date.now){this.loaded=this.load();}
 private async load(){try{const c=JSON.parse(await readFile(join(this.directory,'steamdt-base-cache.json'),'utf8'));this.base={attemptedAt:Number(c.attemptedAt)||0,updatedAt:c.updatedAt,error:c.error,data:c.data?baseSchema.parse(c.data):undefined};}catch{}}
 clearQuotes(){this.prices.clear();this.candles.clear();}
 private async request(path:string,body?:unknown){
  const key=await this.credentials.get();const bucket=path.includes('/kline')?'kline':'price';const limit=bucket==='kline'?110:55;
  if(!path.endsWith('/base')){const times=(this.calls.get(bucket)||[]).filter(t=>this.now()-t<60000);if(times.length>=limit)throw Error('已接近官方 API 每分钟额度，请稍后刷新');times.push(this.now());this.calls.set(bucket,times);}
  let response:Response;
  try{response=await this.read('https://open.steamdt.com'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,...body?{'Content-Type':'application/json'}:{}},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(25000)});}catch{throw Error('SteamDT 官方 API 连接失败，请稍后重试');}
  if(!response.ok)throw Error(response.status===429?'SteamDT API 调用额度已用完，请稍后重试':`SteamDT API 请求失败（HTTP ${response.status}）`);
  const length=Number(response.headers.get('content-length')||0);if(length>40000000)throw Error('SteamDT API 数据过大');
  let raw:Record<string,unknown>;try{raw=await response.json();}catch{throw Error('SteamDT API 响应格式异常');}
  if(raw.success!==true){const code=typeof raw.errorCode==='number'?raw.errorCode:0;throw Error(code===4005?'SteamDT API 调用额度已达到上限，请等待额度恢复':`SteamDT API 未授权或调用受限（${code}），请检查密钥及 IP 白名单`);}
  return raw.data;
 }
 private coalesce<T>(key:string,run:()=>Promise<T>):Promise<T>{const existing=this.pending.get(key);if(existing)return existing as Promise<T>;const task=run().finally(()=>this.pending.delete(key));this.pending.set(key,task);return task;}
 async baseStatus(){await this.loaded;return {updatedAt:this.base.updatedAt?new Date(this.base.updatedAt).toISOString():undefined,count:this.base.data?.length||0,error:this.base.error};}
 async syncBase(){return this.coalesce('base',async()=>{
  await this.loaded;
  if(this.now()-this.base.attemptedAt<86400000){if(this.base.data)return this.baseStatus();throw Error(this.base.error||'基础信息接口每天仅允许一次；本机今日已尝试，请明天再同步');}
  await this.credentials.get();this.base.attemptedAt=this.now();await this.saveBase();
  try{const data=baseSchema.parse(await this.request('/open/cs2/v1/base'));this.base={attemptedAt:this.base.attemptedAt,updatedAt:this.now(),data};}
  catch(e){this.base.error=e instanceof Error?e.message:'基础信息同步失败';await this.saveBase();throw e;}
  await this.saveBase();return this.baseStatus();
 });}
 private async saveBase(){const file=join(this.directory,'steamdt-base-cache.json');await writeFile(file+'.pending',JSON.stringify(this.base));await rename(file+'.pending',file);}
 async getPrices(name:string,refresh=false){const cached=this.prices.get(name);if(cached&&this.now()-cached.at<(refresh?3000:300000))return cached.data;
  return this.coalesce('price:'+name,async()=>{const data=apiPrices(await this.request('/open/cs2/v1/price/single?marketHashName='+encodeURIComponent(name)),this.now());this.prices.set(name,{at:this.now(),data});if(this.prices.size>500)this.prices.delete(this.prices.keys().next().value!);return data;});
 }
 async getStyle(name:string,style:string,refresh=false){const specialStyle=styleKey(style),key=name+'|'+specialStyle,cached=this.candles.get(key);if(cached&&this.now()-cached.at<(refresh?3000:300000))return cached.data;
  return this.coalesce('style:'+key,async()=>{const data=styleClosingQuote(await this.request('/open/cs2/item/v1/kline',{marketHashName:name,type:1,platform:'ALL',specialStyle}),this.now());this.candles.set(key,{at:this.now(),data});if(this.candles.size>500)this.candles.delete(this.candles.keys().next().value!);return data;});
 }
 async platformLink(name:string,platform:string){await this.loaded;const code=platformCode(platform);if(!code)return;
  const base=this.base.data?.find(b=>b.marketHashName===name)?.platformList?.find(p=>platformCode(p.name)===code);
  const known=base&&apiPlatformUrl(code,base.itemId||'',name);if(known)return known;
  const item=(await this.getPrices(name)).find(p=>p.code===code);return item&&apiPlatformUrl(code,item.itemId,name);
 }
}
