import {describe,it,expect} from 'vitest';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Preferences} from '../src/main/preferences';
import {createDemo} from '../src/renderer/src/demo';
import {rentalSeries} from '../src/renderer/src/rental-chart';
import {bundled} from '../src/main/catalog-service';
import {cleanTargets,floatBounds} from '../src/shared/market';
describe('累计收入',()=>{
  it('含期初历史结清收入、无收入日延续累计，过滤无效和未来订单',()=>{
    const base={...createDemo().orders[0],type:'出租' as const,status:'已完成' as const,date:'2026-08-01',settledAt:'2026-09-01',amount:125};
    const orders=[base,{...base,settledAt:'2026-09-03',amount:235},{...base,settledAt:'2026-09-05',amount:70},{...base,settledAt:'2026-09-06',amount:999},{...base,settledAt:undefined},{...base,status:'待结算' as const},{...base,assetId:null}];
    const result=rentalSeries(orders,'2026-09-02','2026-09-05');
    expect(result).toMatchObject({opening:125,total:305,closing:430,count:2,missing:1});
    expect(result.cents).toEqual([0,235,0,70]);expect(result.cumulative).toEqual([125,360,360,430]);
    expect(rentalSeries(orders,'2026-09-04','2026-09-05').closing).toBe(result.closing);
  });
  it('空订单与仅历史收入仍提供完整的累计曲线',()=>{
    expect(rentalSeries([],'2026-09-01','2026-09-02').cumulative).toEqual([0,0]);
    const base={...createDemo().orders[0],type:'出租' as const,status:'已完成' as const,settledAt:'2026-08-01',amount:199};
    expect(rentalSeries([base],'2026-09-01','2026-09-02').cumulative).toEqual([199,199]);
  });
});
describe('皮肤实际磨损范围与精度',()=>{
  const skins=bundled.groups.flatMap(g=>g.members);
  const lotus=skins.find(s=>s.english==='AK-47 | Wild Lotus')!;
  const redline=skins.find(s=>s.english==='AK-47 | Redline')!;
  it('低磨饰品保存输入精度，红线仍使用其真实 0.1 下限',()=>{
    expect(cleanTargets({floatMin:'0.0000123400',floatMax:'0.001'},lotus,'崭新出厂')).toEqual({floatMin:'0.0000123400',floatMax:'0.001'});
    expect(floatBounds(redline,'略有磨损')).toMatchObject({min:0.1,max:0.15,maxExclusive:true});
    expect(()=>cleanTargets({floatMin:'0.0001'},redline,'略有磨损')).toThrow('0.1');
  });
  it('外观范围交集校验，排除无效、倒序以及空外观上界',()=>{
    expect(()=>cleanTargets({floatMin:'0.06'},lotus,'略有磨损')).toThrow();
    expect(()=>cleanTargets({floatMin:'0.07'},lotus,'崭新出厂')).toThrow();
    expect(cleanTargets({floatMax:'0.07'},lotus,'崭新出厂')).toEqual({floatMax:'0.07'});
    expect(()=>cleanTargets({floatMin:'0.05',floatMax:'0.0001'},lotus,'崭新出厂')).toThrow();
    for(const value of ['-0.1','NaN','1e-4','1.01'])expect(()=>cleanTargets({floatMin:value},lotus,'崭新出厂')).toThrow();
  });
});
describe('跨进程主题偏好',()=>{
  it('迁移前无偏好，连续切换按最终顺序落盘，新实例读取，坏文件可恢复',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'cs-rent-preferences-'));
    try {
      const preferences=new Preferences(dir);expect(await preferences.getTheme()).toBeNull();
      await Promise.all([preferences.setTheme('dark'),preferences.setTheme('light'),preferences.setTheme('dark')]);
      expect(await new Preferences(dir).getTheme()).toBe('dark');
      expect(JSON.parse(await readFile(join(dir,'preferences.json'),'utf8'))).toEqual({theme:'dark'});
      await expect(preferences.setTheme('../untrusted')).rejects.toThrow();
      expect(await preferences.getTheme()).toBe('dark');
      await writeFile(join(dir,'preferences.json'),'{broken');expect(await preferences.getTheme()).toBeNull();
      await preferences.setTheme('light');expect(await new Preferences(dir).getTheme()).toBe('light');
    }finally{await rm(dir,{recursive:true,force:true});}
  });
});
