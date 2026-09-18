import {describe,it,expect} from 'vitest';
import {matchesSearch,styleLabel,orderedWears} from '../src/shared/presentation';
import {snapshotSchema} from '../src/shared/catalog';
import {bundled} from '../src/main/catalog-service';
import {CollectionQuoteService,resolveReferencePrice} from '../src/main/market-service';
import {marketHashName,summarizeQuotes} from '../src/shared/market';
import {applyAvailability} from '../src/shared/availability';
const knife=bundled.groups.find(g=>g.id==='knife-500')!;
const ruby=knife.members.find(s=>s.english==='★ Bayonet | Doppler'&&s.phase==='Ruby')!;
const fade=knife.members.find(s=>s.english==='★ Bayonet | Fade')!;
const now=Date.now();
describe('v0.7 搜索、款式与报价准确性',()=>{
 it('关键词跨分隔符、乱序、大小写与中英文款式别名匹配',()=>{
  expect(matchesSearch('刺刀（★） | 渐变之色','刺刀 渐变之色')).toBe(true);
  expect(matchesSearch('刺刀（★） | 渐变之色','渐变之色 刺刀')).toBe(true);
  expect(matchesSearch('AK-47 | Redline','ak47 redline')).toBe(true);
  expect(matchesSearch('刺刀 多普勒 Black Pearl','多普勒 黑珍珠')).toBe(true);
  expect(matchesSearch('刺刀 渐变大理石','刺刀 渐变之色')).toBe(false);
  expect(['Ruby','Emerald','Black Pearl','Sapphire'].map(styleLabel)).toEqual(['红宝石','绿宝石','黑珍珠','蓝宝石']);
 });
 it('按合法磨损等级排序，阿西莫夫不会默认选不存在的崭新',()=>{
  const asiimov=bundled.groups.flatMap(g=>g.members).find(s=>s.english==='AWP | Asiimov')!;
  expect(orderedWears([...asiimov.wears].reverse())[0]).toBe('久经沙场');expect(orderedWears(ruby.wears)[0]).toBe('崭新出厂');
 });
 it('限定物品自动归入武库，导入旧快照和新增限定分组同样适用',()=>{
  const copy=structuredClone(bundled);const group=copy.groups.find(g=>g.type==='限定物品')!;group.armory=false;group.type='收藏品';
  expect(snapshotSchema.parse(copy).groups.find(g=>g.id===group.id)).toMatchObject({armory:true,type:'限定物品'});
  const news={appnews:{newsitems:[{date:1,url:'https://store.steampowered.com/news/',contents:'none'}]}};
  const game='"items_game" { "operations" { "redeemable_goods" "xpshop" "operational_point_redeemable" { "item_name" "lootlist:set_xpshop_wpn_04" } } }';
  const next=applyAvailability(copy,game,news,'a'.repeat(40));expect(next.groups.find(g=>g.id===group.id)?.availability?.at(-1)?.status).toBe('active');
 });
 it('普通聚合报价不能冒充红宝石独立款式参考价',async()=>{
  const api={getPrices:async()=>[{platform:'BUFF',code:'BUFF',itemId:'1',cents:100,updatedAt:new Date(now).toISOString()}],getStyle:async()=>({ok:false,error:'no style'}),platformLink:async()=>undefined};
  expect((await resolveReferencePrice({skinId:ruby.id,wear:'崭新出厂',version:'普通'},bundled,api)).ok).toBe(false);
 });
 it('同一磨损下主行取有效款式最低值，并明确缺失款式',()=>{
  const q=summarizeQuotes([{skinId:'a',ok:true,value:999},{skinId:'b',ok:true,value:500},{skinId:'c',ok:false}],'崭新出厂');expect(q).toMatchObject({value:500,complete:false,wear:'崭新出厂'});
  expect(summarizeQuotes([{skinId:'a',ok:false}],'略有磨损').value).toBeUndefined();
 });
 it('相同请求合并与缓存、切换磨损重新读取；每次都保留所有款式',async()=>{
  let calls=0;const service=new CollectionQuoteService({getPrices:async()=>[],getStyle:async()=>{calls++;return {ok:false};},platformLink:async()=>undefined},()=>now);
  const r={skinId:ruby.id,wear:'崭新出厂',version:'普通'};const [a,b]=await Promise.all([service.get(r,bundled),service.get(r,bundled)]);expect(calls).toBe(7);expect(a).toEqual(b);expect(a.entries).toHaveLength(7);expect(a.entries.every(e=>!e.ok)).toBe(true);
  await service.get(r,bundled);expect(calls).toBe(7);await service.get({...r,wear:'略有磨损'},bundled);expect(calls).toBe(14);
  await expect(service.get({...r,wear:'久经沙场'},bundled)).rejects.toThrow();
 });
 it('旧请求报价不能混入新外观，网络失败不产生零元报价',async()=>{
  const r={skinId:fade.id,wear:'崭新出厂',version:'普通'};const name=marketHashName(fade,r.wear,r.version);
  const svc=new CollectionQuoteService({getPrices:async n=>n===name?[{platform:'BUFF',code:'BUFF',itemId:'1',cents:123400,updatedAt:new Date(now).toISOString()}]:[],getStyle:async()=>({ok:false}),platformLink:async()=>undefined},()=>now);expect((await svc.get(r,bundled)).value).toBe(123400);
  expect((await svc.get({...r,wear:'略有磨损'},bundled)).value).toBeUndefined();
  const failed=new CollectionQuoteService({getPrices:async()=>{throw Error('offline');},getStyle:async()=>({ok:false}),platformLink:async()=>undefined});expect((await failed.get(r,bundled)).value).toBeUndefined();
 });
});
