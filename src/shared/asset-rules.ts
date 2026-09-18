import {styleLabel} from './presentation';
import type {Asset,PublicSubitem} from '../renderer/src/model';
import type {CatalogSkin} from './catalog';
import {cleanTargets,floatBounds,specialFields} from './market';
export function cleanAssetAttributes(raw:{float?:string;template?:string;fade?:string;style?:string},skin:CatalogSkin,wear:string){
  const value=(s?:string)=>!s||s==='待确认'?'':s.trim();
  const targets=cleanTargets({floatMin:value(raw.float),template:value(raw.template),fadeMin:value(raw.fade),style:value(raw.style)},skin,wear);
  if(skin.phase&&targets.style&&styleLabel(targets.style)!==styleLabel(skin.phase))throw Error('款式与所选商品不一致，请改选对应款式的商品');
  const fields=specialFields(skin),bounds=floatBounds(skin,wear);
  if(targets.floatMin&&bounds.maxExclusive&&Number(targets.floatMin)>=bounds.max)throw Error('该磨损值不属于所选外观');
  return {float:fields.float?targets.floatMin||'待确认':'不适用',template:fields.template?targets.template||'待确认':'不适用',fade:targets.fadeMin||undefined,style:targets.style||undefined};
}
export function updatePublicSubitem(asset:Asset,input:{id?:string;name:string;direction:'收入'|'支出';mode:'设置'|'增加';amount:number;date:string;note?:string}):Asset {
  if(asset.kind!=='公共收支')throw Error('仅公共收支支持子项');
  if(!input.name.trim()||input.name.length>100||!Number.isSafeInteger(input.amount)||input.amount<0||input.amount>1e12)throw Error('子项名称或金额无效');
  const existing=asset.subitems?.find(c=>c.id===input.id);
  if(input.id&&!existing)throw Error('子项不存在，请重新打开');
  const before=existing?.amount||0,after=input.mode==='增加'?before+input.amount:input.amount;
  if(after>1e12)throw Error('累计金额超过允许范围');
  const item:PublicSubitem={id:existing?.id||crypto.randomUUID(),name:input.name.trim(),direction:input.direction,amount:after,adjustments:[...(existing?.adjustments||[]),{id:crypto.randomUUID(),date:input.date,at:new Date().toISOString(),mode:input.mode,amount:input.amount,before,after,note:input.note||''}]};
  const subitems=existing?asset.subitems!.map(c=>c.id===item.id?item:c):[...(asset.subitems||[]),item];
  return {...asset,subitems,cost:subitems.filter(c=>c.direction==='支出').reduce((n,c)=>n+c.amount,0)};
}
