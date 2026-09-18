import {describe,it,expect,vi} from 'vitest';
import {mkdtemp,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
vi.mock('electron',()=>({safeStorage:{}}));
import {SteamdtApi} from '../src/main/steamdt-api';
import {styleClosingQuote,apiPlatformUrl,styleKey} from '../src/shared/steamdt';
import {compareStyles,styleLabel} from '../src/shared/presentation';
import {availabilityEvents,applyAvailability} from '../src/shared/availability';
import {bundled} from '../src/main/catalog-service';
const now=Date.UTC(2026,8,18,12),time=now/1000;
describe('官方 API 与款式参考价',()=>{
 it('按 P1–P4、红宝石、蓝宝石、黑珍珠排序；原始款式不改 ID',()=>{
  expect(['Black Pearl','Phase 3','Ruby','Phase 1','Sapphire','Phase 4','Phase 2'].sort(compareStyles).map(styleLabel)).toEqual(['P1','P2','P3','P4','红宝石','蓝宝石','黑珍珠']);expect(styleKey('Emerald')).toBe('emerald');expect(()=>styleKey('unknown')).toThrow();
 });
 it('按最新时间取收盘列，拒绝未来、无效、过期参考价；不是最低列',()=>{
  expect(styleClosingQuote([[String(time),40,50,60,10],[time-3600,1,2,3,1]],now)).toMatchObject({ok:true,value:5000,kind:'style-close',updated:new Date(now).toISOString()});
  expect(styleClosingQuote([[time-8*86400,1,2,3,1],[time+86400,1,5,6,1]],now).ok).toBe(false);
 });
 it('平台链接只使用 API 商品 ID，未知平台/注入 ID 不构造链接',()=>{
  expect(apiPlatformUrl('BUFF','123','x')).toContain('buff.163.com/goods/123');expect(apiPlatformUrl('悠悠有品','456','x')).toContain('templateId=456');
  expect(apiPlatformUrl('BUFF','//evil.com','x')).toBeUndefined();expect(apiPlatformUrl('not-a-platform','1','x')).toBeUndefined();
 });
 it('请求只走文档域名，以 Authorization 传密钥，商品与款式分开，合并重复请求',async()=>{
  const calls:{url:string;options:RequestInit}[]=[];const directory=await mkdtemp(join(tmpdir(),'csrent-api-'));
  const read=vi.fn(async(url:URL|RequestInfo,options?:RequestInit)=>{calls.push({url:String(url),options:options!});return new Response(JSON.stringify({success:true,data:String(url).includes('kline')?[[time,1,2,3,1]]:[{platform:'BUFF',platformItemId:'123',sellPrice:12.34,sellCount:1,updateTime:time}]}));});
  const api=new SteamdtApi(directory,{get:async()=>'test-only-fake-credential'},read,()=>now);
  const name='★ Butterfly Knife | Gamma Doppler (Factory New)';await Promise.all([api.getPrices(name),api.getPrices(name)]);await api.getPrices(name);expect(calls).toHaveLength(1);
  await api.getStyle(name,'Emerald');await api.getStyle(name,'Phase 1');expect(calls).toHaveLength(3);
  for(const c of calls){expect(c.url).toMatch(/^https:\/\/open\.steamdt\.com\/open\/cs2\//);expect(c.url).not.toContain('credential');expect(c.options.redirect).toBe('error');expect(c.options.headers).toMatchObject({Authorization:'Bearer test-only-fake-credential'});}
  expect(JSON.parse(String(calls[1].options.body))).toEqual({marketHashName:name,type:1,platform:'ALL',specialStyle:'emerald'});expect(JSON.parse(String(calls[2].options.body)).specialStyle).toBe('p1');
  expect(await api.platformLink(name,'BUFF')).toContain('/goods/123');
 });
 it('失败消息不反射服务端内容或凭据，调用额度保护不会继续发送请求',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'csrent-errors-'));const read=vi.fn(async()=>new Response(JSON.stringify({success:false,errorCode:4005,errorMsg:'test-only-fake-credential'})));
  const api=new SteamdtApi(dir,{get:async()=>'test-only-fake-credential'},read,()=>now);
  await expect(api.getPrices('x')).rejects.toThrow('额度');try{await api.getPrices('x');}catch(e){expect(String(e)).not.toContain('test-only-fake-credential');}
  for(let i=0;i<60;i++)await api.getPrices('n'+i).catch(()=>{});expect(read).toHaveBeenCalledTimes(55);
 });
 it('每日基础信息先保存调用标记，失败与重启都不重复消耗额度',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'csrent-base-'));const read=vi.fn(async()=>new Response(JSON.stringify({success:false,errorCode:4005})));
  const credentials={get:async()=>'test-only-fake-credential'};const api=new SteamdtApi(dir,credentials,read,()=>now);
  await expect(api.syncBase()).rejects.toThrow();await expect(api.syncBase()).rejects.toThrow();await expect(new SteamdtApi(dir,credentials,read,()=>now).syncBase()).rejects.toThrow();expect(read).toHaveBeenCalledTimes(1);
  const content=await readFile(join(dir,'steamdt-base-cache.json'),'utf8');expect(content).not.toContain('credential');
 });
 it('官方终端周掉落公告能够识别；last chance 不误报停投',()=>{
  const g=bundled.groups.find(g=>g.english==='The Dead Hand Collection')!;expect(g).toBeDefined();
  const n={date:1773270006,url:'https://store.steampowered.com/news/app/730/view/1',contents:'[*]Access items in the Dead Hand Collection via the Dead Hand Terminal, available as a weekly drop.[/p][/*][/list][p]\\[ MAPS ][/p][p]Dust II[/p]'};
  expect(availabilityEvents(g,[n])[0]).toMatchObject({channel:'每周补给',status:'active'});expect(availabilityEvents(bundled.groups.find(g=>g.id==='collection-set-dust')!,[n])).toEqual([]);expect(availabilityEvents(bundled.groups.find(g=>g.id==='collection-set-dust-2')!,[n])).toEqual([]);
  expect(availabilityEvents(g,[{...n,contents:'[*]Last chance to pick up the Dead Hand Collection from The Armory.'}])).toEqual([]);
 });
 it('限定单件停投日期仅来自明确公告；不存在于当前完整武库只给无日期状态',()=>{
  const copy=structuredClone(bundled),limited=copy.groups.find(g=>g.type==='限定物品')!;const deagle=limited.members.find(s=>s.english==='Desert Eagle | Heat Treated')!;
  const news={appnews:{newsitems:[{date:1736904429,url:'https://store.steampowered.com/news/app/730/view/1',contents:'[*][i]Desert Eagle | Heat Treated[/i] is no longer available to claim from The Armory'}]}};
  const game='"items_game" {"operations" {"redeemable_goods" "xpshop" "operational_point_redeemable" {"item_name" "crate_community_35"}}}';
  const result=applyAvailability(copy,game,news,'a'.repeat(40));const members=result.groups.find(g=>g.id===limited.id)!.members;
  expect(members.find(s=>s.id===deagle.id)?.availability?.at(-1)).toMatchObject({status:'retired',date:'2025-01-15'});expect(members.find(s=>s.id!==deagle.id)?.availability?.at(-1)?.date).toBeUndefined();
 });
});
