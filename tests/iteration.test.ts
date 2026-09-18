import {describe,it,expect} from 'vitest';
import {rentalRange,rentalSeries} from '../src/renderer/src/rental-chart';
import {collectionCounts} from '../src/renderer/src/collection-metrics';
import {createDemo} from '../src/renderer/src/demo';
import {cleanTargets,lowestPlatform,marketHashName,platformUrlAllowed,specialFields} from '../src/shared/market';
import {applyAvailability,armoryGroupIds,availabilityEvents,latestAvailability,parseKeyValues} from '../src/shared/availability';
import {bundled} from '../src/main/catalog-service';
import {resolveMarketLink} from '../src/main/market-service';
import type {CatalogSnapshot} from '../src/shared/catalog';
describe('v0.4 结算日期与收藏口径',()=>{
  it('日期跨度含首尾，正确处理闰日与短月份',()=>{
    expect(rentalRange('7天','2026-09-18')).toEqual(['2026-09-12','2026-09-18']);
    expect(rentalRange('15天','2026-09-18')).toEqual(['2026-09-04','2026-09-18']);
    expect(rentalRange('1月','2024-03-31')).toEqual(['2024-03-01','2024-03-31']);
    expect(rentalRange('1年','2024-02-29')).toEqual(['2023-03-01','2024-02-29']);
  });
  it('按完成结算日期记入净租金，排除下单日、待结算、失败、未关联与缺日期',()=>{
    const base={...createDemo().orders[0],type:'出租' as const,status:'已完成' as const,date:'2026-08-01',settledAt:'2026-09-18',amount:1234};
    const s=rentalSeries([base,{...base,status:'待结算'},{...base,status:'失败'},{...base,assetId:null},{...base,settledAt:undefined},{...base,settledAt:'2026-09-19'}],'2026-09-17','2026-09-18');
    expect(s.cents).toEqual([0,1234]);expect(s.count).toBe(1);expect(s.missing).toBe(1);
    expect(()=>rentalSeries([],'2026-02-30','2026-03-01')).toThrow();
    expect(()=>rentalSeries([],'2026-03-02','2026-03-01')).toThrow();
  });
  it('纪念品计入总拥有，普通及计数独立，重复磨损不增数，赠出排除',()=>{
    const g=bundled.groups.find(g=>g.members.some(s=>s.souvenir))!;const s=g.members.find(s=>s.souvenir)!;
    const asset={...createDemo().assets[0],skinId:s.id,version:'纪念品' as const,status:'持有中' as const};
    expect(collectionCounts(g,[asset,{...asset,id:'other',wear:'战痕累累'}])).toMatchObject({any:1,normal:0,st:0});
    expect(collectionCounts(g,[asset,{...asset,id:'normal',version:'普通'}])).toMatchObject({any:1,normal:1,st:0});
    expect(collectionCounts(g,[{...asset,status:'已赠出'}]).any).toBe(0);
  });
  it('不同多普勒款式及双版本只计一款，保留各款式身份',()=>{
    const g=bundled.groups.find(g=>g.id==='knife-500')!;const s=g.members.find(s=>s.phase==='Phase 1')!;const p=g.members.find(m=>m.finishKey===s.finishKey&&m.phase==='Phase 2')!;
    const a={...createDemo().assets[0],status:'持有中' as const,skinId:s.id};
    expect(collectionCounts(g,[a,{...a,id:'phase2',skinId:p.id,version:'StatTrak™'}]).any).toBe(1);
    expect(s.styles).toContain('Ruby');
  });
});
describe('愿望条件及可核实的详情跳转',()=>{
  const knife=bundled.groups.find(g=>g.id==='knife-500')!;
  const fade=knife.members.find(s=>s.english==='★ Bayonet | Fade')!;
  it('按合法版本和磨损生成市场名，原版没有磨损后缀',()=>{
    expect(marketHashName(fade,'崭新出厂','StatTrak™')).toBe('★ StatTrak™ Bayonet | Fade (Factory New)');
    expect(()=>marketHashName(fade,'崭新出厂','纪念品')).toThrow();
    const vanilla=knife.members.find(s=>s.wears.includes('不适用'))!;expect(marketHashName(vanilla,'不适用','普通')).toBe(vanilla.english);
  });
  it('最低价排除缺失值，平台链接拒绝伪域名、非 HTTPS、非商品页面',()=>{
    expect(lowestPlatform({buff:12000,youpin:10000,igxe:null})).toBe('悠悠有品');
    expect(lowestPlatform({buff:null,youpin:null,igxe:null})).toBeUndefined();
    for(const u of ['https://buff.163.com.evil.com/goods/1','http://buff.163.com/goods/1','https://buff.163.com/account','https://x@buff.163.com/goods/1'])expect(platformUrlAllowed(u,'BUFF')).toBe(false);
  });
  it('官方 API 返回对应商品的平台 ID 后构造详情链接；缺失回退 SteamDT',async()=>{
    const request={skinId:fade.id,wear:'崭新出厂',version:'普通',platform:'BUFF'};
    const api={getPrices:async()=>[],getStyle:async()=>({ok:false}),platformLink:async(name:string)=>name==='★ Bayonet | Fade (Factory New)'?'https://buff.163.com/goods/123':undefined};
    expect((await resolveMarketLink(request,bundled,api)).target).toBe('BUFF');
    const fallback=await resolveMarketLink(request,bundled,{...api,platformLink:async()=>undefined});expect(fallback.fallback).toBe(true);expect(fallback.target).toBe('SteamDT');
  });
  it('条件可全空，过滤不适用字段，禁止倒置或越界区间',()=>{
    expect(cleanTargets({},fade)).toEqual({});expect(specialFields(fade).fade).toBe(true);
    expect(()=>cleanTargets({floatMin:'0.07',floatMax:'0.01'},fade)).toThrow();
    expect(()=>cleanTargets({template:'1001'},fade)).toThrow();
    expect(()=>cleanTargets({fadeMax:'101'},fade)).toThrow();
    const vanilla=knife.members.find(s=>s.wears.includes('不适用'))!;
    expect(cleanTargets({floatMin:'0.1',template:'387',fadeMin:'99'},vanilla)).toEqual({});
  });
});
describe('官方渠道投放状态与历史',()=>{
  const game=(id:string)=>`"items_game" { "seasonaloperations" { "11" { "redeemable_goods" "xpshop" "operational_point_redeemable" { "item_name" "lootlist:set_${id}" } "operational_point_redeemable" { "item_name" "crate_community_35" } } } }`;
  it('保留重复 VDF 键，不遗漏武库条目，结构损坏阻止覆盖',()=>{
    expect(armoryGroupIds(game('arabesque'))).toEqual(new Set(['collection-set-arabesque','collection-set-community-35']));
    expect(()=>parseKeyValues('"a" { "b" "c"')).toThrow();expect(()=>armoryGroupIds('"items_game" {}')).toThrow();
  });
  it('官方公告按准确收藏名称匹配，Dust 不误匹配 Dust 2',()=>{
    const news=[{date:1768953600,url:'https://store.steampowered.com/news/app/730/view/1',contents:'[*]Removed four weapon collections from the Weekly Care Package drop list: Safehouse, Dust 2, 2018 Nuke Collection, and the 2018 Inferno Collection'}];
    expect(availabilityEvents(bundled.groups.find(g=>g.id==='collection-set-dust')!,news)).toHaveLength(0);
    expect(availabilityEvents(bundled.groups.find(g=>g.id==='collection-set-dust-2')!,news)[0].status).toBe('retired');
  });
  it('当前资源识别新加入、移除及返场，缺精确日期不编造，保留旧记录',()=>{
    const base:CatalogSnapshot={...bundled,groups:structuredClone(bundled.groups.filter(g=>['collection-set-arabesque','collection-set-spy-tech','collection-set-community-35'].includes(g.id))).map(g=>({...g,availability:[],armory:false}))};
    const news={appnews:{newsitems:[{date:1,url:'https://store.steampowered.com/news/',contents:'no matched announcement'}]}};
    const a=applyAvailability(structuredClone(base),game('arabesque'),news,'a'.repeat(40));
    const b=applyAvailability(structuredClone(base),game('spy_tech'),news,'b'.repeat(40),a);
    const removed=b.groups.find(g=>g.id==='collection-set-arabesque')!;expect(latestAvailability(removed)[0]).toMatchObject({status:'retired'});expect(latestAvailability(removed)[0].date).toBeUndefined();
    const returned=applyAvailability(structuredClone(base),game('arabesque'),news,'c'.repeat(40),b).groups.find(g=>g.id===removed.id)!;
    expect(returned.availability?.map(e=>e.status)).toEqual(['active','retired','active']);
  });
  it('内置武库包含当前及已退出项目和已核实停投日期',()=>{
    expect(bundled.groups.filter(g=>g.armory)).toHaveLength(9);
    const gallery=bundled.groups.find(g=>g.id==='collection-set-community-34')!;expect(latestAvailability(gallery)[0]).toMatchObject({status:'retired',date:'2025-10-01'});
    expect(bundled.groups.find(g=>g.id==='collection-set-dust')!.availability).toEqual([]);
  });
});
