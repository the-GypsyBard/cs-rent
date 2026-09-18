import {describe,it,expect} from 'vitest';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WorkspaceService} from '../src/main/workspace-service';
import {workspaceSchema,parseBackup,migrateState,defaultSettings} from '../src/shared/user-data';
import {bundled} from '../src/main/catalog-service';
import {createDemo} from '../src/renderer/src/demo';
import {totals,type Asset} from '../src/renderer/src/model';
import {cleanAssetAttributes,updatePublicSubitem} from '../src/shared/asset-rules';
import {apiPrices} from '../src/shared/steamdt';
const context={catalog:bundled,settings:defaultSettings};
const backup=()=>parseBackup({format:'cs-rent-prototype-v1',state:createDemo()},context);
describe('完整用户数据迁移',()=>{
  it('跨用户目录迁移资产、精度、估值、子项、设置、愿望单和目录，恢复前留存备份',async()=>{
    const root=await mkdtemp(join(tmpdir(),'cs-rent-migration-'));
    try{
      const a=new WorkspaceService(join(root,'a'),bundled);
      const state=migrateState(createDemo());state.assets[0]={...state.assets[0],float:'0.123400000',template:'387',fade:'98.76500',style:'手工款式',value:123456,valueManual:true,valueSource:'用户手动参考价'};
      await a.saveState(state);await a.setSettings({largeText:true,assetColumns:['value','rent']});await a.setSettings({theme:'dark'});
      const exported=await a.export();expect(exported.settings).toMatchObject({theme:'dark',largeText:true,assetColumns:['value','rent']});
      const b=new WorkspaceService(join(root,'b'),bundled);await b.saveState({assets:[],orders:[],wishes:[]});await b.restore(JSON.parse(JSON.stringify(exported)));
      const restored=(await new WorkspaceService(join(root,'b'),bundled).get()).data;
      expect(restored.state).toEqual(exported.state);expect(restored.settings).toEqual(exported.settings);expect(restored.catalog).toEqual(exported.catalog);
      expect((await readdir(join(root,'b'))).some(n=>n.startsWith('before-restore-'))).toBe(true);
    }finally{await rm(root,{recursive:true,force:true});}
  });
  it('版本、重复 ID、断裂关联和损坏调整记录拒绝导入，当前文件不改动',async()=>{
    const root=await mkdtemp(join(tmpdir(),'cs-rent-invalid-'));try{
      const service=new WorkspaceService(root,bundled);const good=backup();await service.restore(good);const before=await readFile(service.file,'utf8');
      for(const edit of [(x:any)=>x.schemaVersion=99,(x:any)=>x.state.assets.push(x.state.assets[0]),(x:any)=>x.state.orders[0].assetId='missing',(x:any)=>{const a=x.state.assets.find((a:any)=>a.subitems);a.subitems[0].adjustments[0].after++;}]){
        const invalid=structuredClone(good);edit(invalid);expect(()=>service.restore(invalid)).toThrow();expect(await readFile(service.file,'utf8')).toBe(before);
      }
    }finally{await rm(root,{recursive:true,force:true});}
  });
  it('损坏本机文件不被空账本覆盖，显式恢复时先备份原文件',async()=>{
    const root=await mkdtemp(join(tmpdir(),'cs-rent-corrupt-'));try{
      await writeFile(join(root,'workspace-v2.json'),'{broken');const service=new WorkspaceService(root,bundled);expect((await service.get()).error).not.toBe('');
      await expect(service.saveState({assets:[],orders:[],wishes:[]})).rejects.toThrow();expect(await readFile(service.file,'utf8')).toBe('{broken');
      await service.restore(backup());const previous=(await readdir(root)).find(n=>n.startsWith('before-restore-'))!;expect(await readFile(join(root,previous),'utf8')).toBe('{broken');expect((await service.get()).error).toBe('');
    }finally{await rm(root,{recursive:true,force:true});}
  });
  it('旧快照升级保持记录总数；明确受赠无平台；未知成本不改成零',()=>{
    const state=createDemo();state.assets[0]={...state.assets[0],cost:0,note:'受赠取得'};const old=parseBackup({format:'cs-rent-prototype-v1',state},context);
    expect(old.state.assets[0]).toMatchObject({acquisition:'受赠',platform:null,cost:0});expect(old.state.assets).toHaveLength(state.assets.length);
    expect(old.state.assets.filter(a=>a.cost===null)).toHaveLength(state.assets.filter(a=>a.cost===null).length);
  });
});
describe('饰品属性、估值及公共收支',()=>{
  it('成本未知时，汇总仍保留已经确认的租金流入',()=>{
    const a={...createDemo().assets[0],cost:null};const o={...createDemo().orders[0],assetId:a.id,type:'出租' as const,status:'已完成' as const,amount:250};
    expect(totals([a],[o])).toMatchObject({cash:250,rent:250,unknown:1});
  });
  it('实际磨损按皮肤及外观校验，渐变率字符串精度保留',()=>{
    const fade=bundled.groups.find(g=>g.id==='knife-500')!.members.find(s=>s.english==='★ Bayonet | Fade')!;
    expect(cleanAssetAttributes({float:'0.0000123400',template:'387',fade:'98.76500'},fade,'崭新出厂')).toMatchObject({float:'0.0000123400',template:'387',fade:'98.76500'});
    expect(()=>cleanAssetAttributes({float:'0.07'},fade,'崭新出厂')).toThrow();expect(()=>cleanAssetAttributes({fade:'100.01'},fade,'崭新出厂')).toThrow();
  });
  it('新增估值计入持有库存；公共收入、支出与子项增加只汇总一次',()=>{
    let a:Asset={...createDemo().assets[0],kind:'公共收支',cost:0,subitems:[],value:null,sale:0};
    a=updatePublicSubitem(a,{name:'手续费',direction:'支出',mode:'设置',amount:1000,date:'2026-09-18'});
    a=updatePublicSubitem(a,{id:a.subitems![0].id,name:'手续费',direction:'支出',mode:'增加',amount:250,date:'2026-09-18'});
    a=updatePublicSubitem(a,{name:'返还费用',direction:'收入',mode:'设置',amount:300,date:'2026-09-18'});
    const held={...createDemo().assets[0],id:'new',value:123456,cost:10000};const missing={...held,id:'missing',value:null};
    expect(totals([a,held,missing],[])).toMatchObject({expense:1250,income:300,net:-950,value:123456,unvalued:1,cash:-20950});
    expect(a.subitems![0].adjustments.at(-1)).toMatchObject({before:1000,after:1250,amount:250});
    expect(workspaceSchema.parse({...backup(),state:{assets:[a],orders:[],wishes:[]}}).state.assets[0].subitems).toEqual(a.subitems);
  });
  it('官方人民币在售价排除零价、过期、未知平台和已售罄',()=>{
    const now=Date.now(),time=Math.floor(now/1000);
    const result=apiPrices([{platform:'BUFF',sellPrice:12.34,sellCount:2,updateTime:time},{platform:'YOUPIN',sellPrice:10.2,sellCount:1,updateTime:time},{platform:'IGXE',sellPrice:0,updateTime:time},{platform:'C5',sellPrice:1,updateTime:time-90000},{platform:'UNKNOWN',sellPrice:1,updateTime:time},{platform:'BUFF',sellPrice:1,sellCount:0,updateTime:time}],now);
    expect(result.map(r=>r.cents)).toEqual([1020,1234]);
  });
});
