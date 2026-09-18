import {z} from 'zod';
import {imageAllowed,snapshotSchema} from './catalog';
import type {DemoState} from '../renderer/src/model';
const text=z.string().max(4000),id=z.string().min(1).max(200);
const amount=z.number().int().nonnegative().max(1e12);
const platform=z.enum(['IGXE','BUFF','悠悠有品','Steam']);
const adjustment=z.object({id,date:text,at:z.string().datetime(),mode:z.enum(['设置','增加']),amount,before:amount,after:amount,note:text});
const subitem=z.object({id,name:z.string().min(1).max(100),direction:z.enum(['收入','支出']),amount,adjustments:z.array(adjustment).max(100000)}).superRefine((v,c)=>{
  let previous=0;const ids=new Set<string>();
  for(const a of v.adjustments){if(ids.has(a.id)||a.before!==previous||a.after!==(a.mode==='增加'?a.before+a.amount:a.amount))c.addIssue({code:'custom',message:'子项调整记录不连续'});ids.add(a.id);previous=a.after;}
  if(v.adjustments.length&&previous!==v.amount)c.addIssue({code:'custom',message:'子项金额与调整记录不一致'});
});
export const assetSchema=z.object({
  id,skinId:text,name:text,image:z.string().max(3000).refine(imageAllowed),rarity:z.string().regex(/^#[0-9a-fA-F]{6}$/),
  wear:text,float:text,template:text,version:z.enum(['普通','StatTrak™','纪念品']),platform:platform.nullable(),
  acquisition:z.enum(['购买','受赠','待核对']).optional(),fade:text.optional(),style:text.optional(),
  valueSource:text.optional(),valueUpdated:text.optional(),valueManual:z.boolean().optional(),subitems:z.array(subitem).max(1000).optional(),
  status:z.enum(['持有中','已售出','已赠出']),rental:z.enum(['未出租','出租中','归还后冷却','状态待核实']),
  tags:z.array(text).max(20),date:text,cost:amount.nullable(),value:amount.nullable(),sale:amount,note:text,collection:text,kind:z.enum(['饰品','公共收支']),
});
export const stateSchema=z.object({
  assets:z.array(assetSchema).max(50000),
  orders:z.array(z.object({settledAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),id,assetId:id.nullable(),name:text,platform,type:z.enum(['购买','出租','出售']),status:z.enum(['已完成','待结算','失败','待核对']),amount,date:text,source:z.enum(['示例平台记录','手工补录']),term:z.enum(['长租','短租','未知']).optional(),note:text})).max(500000),
  wishes:z.array(z.object({targets:z.object({template:text.optional(),floatMin:text.optional(),floatMax:text.optional(),fadeMin:text.optional(),fadeMax:text.optional(),style:text.optional()}).optional(),id,skinId:text,name:text,image:z.string().max(3000).refine(imageAllowed),wear:text,version:text,target:amount,buff:amount.nullable(),youpin:amount.nullable(),igxe:amount.nullable(),special:text,currencyKnown:z.boolean(),updated:text,failed:z.boolean().optional(),quoteError:text.optional()})).max(50000),
}).superRefine((state,ctx)=>{
  for(const key of ['assets','orders','wishes'] as const){const ids=state[key].map(v=>v.id);if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'包含重复记录 ID'});}
  const assets=new Map(state.assets.map(a=>[a.id,a]));
  for(const o of state.orders)if(o.assetId&&(!assets.has(o.assetId)||assets.get(o.assetId)!.kind!=='饰品'))ctx.addIssue({code:'custom',message:'订单关联的饰品不存在'});
  for(const a of state.assets){if(a.acquisition==='受赠'&&(a.platform!==null||a.cost!==0))ctx.addIssue({code:'custom',message:'受赠饰品应为零成本且无所属平台'});const ids=a.subitems?.map(c=>c.id)||[];if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'公共收支子项 ID 重复'});}
});
export const settingsSchema=z.object({theme:z.enum(['light','dark']).default('light'),largeText:z.boolean().default(false),assetColumns:z.array(z.enum(['cost','rent','sale','net','cash','value'])).default(['cost','rent','sale','net','cash','value'])});
export type UserSettings=z.infer<typeof settingsSchema>;
export const defaultSettings:UserSettings=settingsSchema.parse({});
export const legacyBackupSchema=z.object({format:z.literal('cs-rent-prototype-v1'),state:stateSchema});
export const workspaceSchema=z.object({format:z.literal('cs-rent-user-data'),schemaVersion:z.literal(2),appVersion:z.string().max(50),exportedAt:z.string().datetime(),space:z.enum(['personal','demo']),state:stateSchema,settings:settingsSchema,catalog:snapshotSchema});
export type WorkspaceData=z.infer<typeof workspaceSchema>;
export const emptyState=():DemoState=>({assets:[],orders:[],wishes:[]});
export function migrateState(state:DemoState):DemoState {
  return {...state,assets:state.assets.map(a=>{
    let next={...a};
    if(a.kind==='饰品'&&(a.acquisition==='受赠'||a.cost===0&&/受赠/.test(a.note+' '+a.tags.join(' '))))next={...next,acquisition:'受赠',platform:null,cost:0};
    if(a.kind==='公共收支'&&!a.subitems){const cents=a.cost||0;next={...next,subitems:[{id:'legacy-'+a.id,name:'原有未分类支出',direction:'支出',amount:cents,adjustments:[{id:'legacy-opening-'+a.id,date:a.date,at:new Date().toISOString(),mode:'设置',amount:cents,before:0,after:cents,note:'从旧版公共支出迁移，未推定具体费用类型'}]}]};}
    return next;
  }),wishes:state.wishes.map(w=>({...w,currencyKnown:true}))};
}
export function parseBackup(raw:unknown,context:Pick<WorkspaceData,'settings'|'catalog'>):WorkspaceData {
  const type=(raw as {format?:unknown;schemaVersion?:unknown})?.format;
  if(type==='cs-rent-user-data')return workspaceSchema.parse(raw);
  if(type==='cs-rent-prototype-v1'){const old=legacyBackupSchema.parse(raw);return workspaceSchema.parse({format:'cs-rent-user-data',schemaVersion:2,appVersion:'0.7.0',exportedAt:new Date().toISOString(),space:'demo',state:migrateState(old.state),...context});}
  throw Error('不支持的备份格式或版本');
}
