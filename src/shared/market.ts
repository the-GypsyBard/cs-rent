import type { CatalogSkin } from './catalog';
import {styleLabel} from './presentation';
export type PriceQuote={ok:boolean;kind?:'sell'|'style-close';value?:number;source?:string;updated?:string;error?:string};
export type CollectionQuote={wear:string;entries:(PriceQuote&{skinId:string;style?:string})[];value?:number;complete:boolean};
export const dopplerStyleKey=(style:string)=>({'Ruby':'ruby','Sapphire':'sapphire','Emerald':'emerald','Black Pearl':'blackpearl','Phase 1':'p1','Phase 2':'p2','Phase 3':'p3','Phase 4':'p4'} as Record<string,string>)[style]||style.toLowerCase().replace(/\s+/g,'');
export function summarizeQuotes(entries:CollectionQuote['entries'],wear:string):CollectionQuote {
  const values=entries.filter(e=>e.ok&&Number.isSafeInteger(e.value)&&e.value!>0).map(e=>e.value!);
  return {wear,entries,value:values.length?Math.min(...values):undefined,complete:values.length===entries.length&&entries.length>0};
}
export type MarketRequest = { skinId:string; wear:string; version:string; platform?:string;refresh?:boolean };
const wears:Record<string,string>={'崭新出厂':'Factory New','略有磨损':'Minimal Wear','久经沙场':'Field-Tested','破损不堪':'Well-Worn','战痕累累':'Battle-Scarred'};
export function marketHashName(skin:CatalogSkin,wear:string,version:string) {
  if(!skin.wears.includes(wear) || !['普通','StatTrak™','纪念品'].includes(version) || version==='StatTrak™'&&!skin.stattrak || version==='纪念品'&&!skin.souvenir) throw Error('该版本或磨损不适用于此饰品');
  let name=skin.english;
  if(version==='StatTrak™') name=name.startsWith('★ ')?name.replace('★ ','★ StatTrak™ '):'StatTrak™ '+name;
  if(version==='纪念品') name='Souvenir '+name;
  return name+(wears[wear]?` (${wears[wear]})`:'');
}
export const steamdtUrl=(name:string)=>'https://www.steamdt.com/cs2/'+encodeURIComponent(name);
export function lowestPlatform(w:{buff:number|null;youpin:number|null;igxe:number|null}) {
  return ([['BUFF',w.buff],['悠悠有品',w.youpin],['IGXE',w.igxe]] as const).filter((p)=>p[1]!==null&&Number.isFinite(p[1])&&p[1]!>=0).sort((a,b)=>a[1]!-b[1]!)[0]?.[0];
}
export function platformUrlAllowed(value:string,platform:string) {
  try {const u=new URL(value);if(u.protocol!=='https:'||u.port||u.username||u.password)return false;
    return platform==='BUFF'?u.hostname==='buff.163.com'&&/^\/goods\/\d+$/.test(u.pathname):
      platform==='悠悠有品'?['www.youpin898.com','youpin898.com'].includes(u.hostname)&&u.pathname==='/market/goods-list'&&/^\d+$/.test(u.searchParams.get('templateId')||''):
      platform==='IGXE'?['www.igxe.cn','igxe.cn'].includes(u.hostname)&&/^\/product\/730\/\d+$/.test(u.pathname):false;
  }catch{return false;}
}
export function specialFields(s?:CatalogSkin) {
  if(!s)return {float:false,template:false,fade:false,style:false,styles:[] as string[]};
  const painted=s.wears.some(w=>w!=='不适用');
  return {float:painted,template:painted,fade:/\| (?:Amber )?Fade$/.test(s.english),style:!!s.phase||/\| (?:Case Hardened|Slaughter|Marble Fade|Crimson Web)$/.test(s.english),styles:s.styles|| (s.phase?[s.phase]:[])};
}
export type Targets={template?:string;floatMin?:string;floatMax?:string;fadeMin?:string;fadeMax?:string;style?:string};
const wearRanges:Record<string,readonly [number,number]>={'崭新出厂':[0,0.07],'略有磨损':[0.07,0.15],'久经沙场':[0.15,0.38],'破损不堪':[0.38,0.45],'战痕累累':[0.45,1]};
export function floatBounds(skin:CatalogSkin,wear?:string) {
  const range=wear?wearRanges[wear]:undefined;
  const min=Math.max(skin.minFloat??0,range?.[0]??0);
  const max=Math.min(skin.maxFloat??1,range?.[1]??1);
  return {min,max,maxExclusive:!!range&&range[1]<1&&range[1]<=(skin.maxFloat??1),known:skin.minFloat!==undefined&&skin.maxFloat!==undefined};
}
export function cleanTargets(raw:Targets,skin:CatalogSkin,wear?:string):Targets {
  const fields=specialFields(skin);const result:Targets={};
  const bounds=floatBounds(skin,wear);
  for(const key of ['template','floatMin','floatMax','fadeMin','fadeMax','style'] as const) {
    const v=raw[key]?.trim();if(!v)continue;
    if(key==='template'&&fields.template){if(!/^\d+$/.test(v)||Number(v)>1000)throw Error('图案模板须为 0–1000 的整数');result[key]=v;}
    if((key==='floatMin'||key==='floatMax')&&fields.float){if(!/^\d*(\.\d+)?$/.test(v)||Number(v)<bounds.min||Number(v)>bounds.max||(key==='floatMin'&&bounds.maxExclusive&&Number(v)===bounds.max))throw Error(`磨损值须在 ${bounds.min}–${bounds.max} 之间${bounds.maxExclusive?'（外观上界不含）':''}`);result[key]=v;}
    if((key==='fadeMin'||key==='fadeMax')&&fields.fade){if(!/^\d*(\.\d+)?$/.test(v)||Number(v)<0||Number(v)>100)throw Error('渐变率须在 0–100% 之间');result[key]=v;}
    if(key==='style'&&fields.style){if(v.length>80)throw Error('特殊款式请控制在 80 字以内');result[key]=v;}
  }
  for(const [lo,hi] of [['floatMin','floatMax'],['fadeMin','fadeMax']] as const)if(result[lo]&&result[hi]&&Number(result[lo])>Number(result[hi]))throw Error('区间下限不能大于上限');
  return result;
}
export function targetDescription(t:Targets={}) {
  return [t.template?`图案模板 ${t.template}`:'',t.floatMin||t.floatMax?`磨损 ${t.floatMin||'不限'}–${t.floatMax||'不限'}`:'',t.fadeMin||t.fadeMax?`渐变率 ${t.fadeMin||'不限'}–${t.fadeMax||'不限'}%`:'',t.style?`特殊款式 ${styleLabel(t.style)}`:''].filter(Boolean).join(' · ');
}
