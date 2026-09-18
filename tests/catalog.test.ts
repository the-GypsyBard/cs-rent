import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeCatalog, finishMembers, validateTransition, imageAllowed, catalogDifference } from '../src/shared/catalog';
import { bundled, CatalogService, downloadCatalog } from '../src/main/catalog-service';

const skin = (id: string, weapon = 500, category = 'sfui_invpanel_filter_melee', phase?: string) => ({
  id, name: '刀具 | 多普勒', weapon: { id: 'knife', weapon_id: weapon, name: '刺刀' },
  category: { id: category, name: 'Knives' }, pattern: { id: 'doppler', name: 'Doppler' },
  rarity: { color: '#eb4b4b' }, stattrak: true, souvenir: false, paint_index: id,
  wears: [{ id: 'SFUI_InvTooltip_Wear_Amount_0', name: 'Factory New' }], image: '',
  crates: [{ id: 'crate-new', name: '更新后的新系列' }], ...(phase ? { phase } : {}),
});
const collections = [{ id: 'c-new', name: '新收藏品', image: '', contains: [{ id: 'skin-gun' }] }];
const source = [skin('skin-p1', 500, undefined, 'Phase 1'), skin('skin-p2',500,undefined,'Phase 2'), skin('skin-newknife',999), skin('skin-glove', 800, 'sfui_invpanel_filter_gloves'), skin('skin-gun',7,'rifle')];
describe('数据驱动收藏目录', () => {
  it('新收藏品、刀型、涂装和未知手套来源自动生成；款式共享进度身份', () => {
    const snapshot = normalizeCatalog(source, source, collections, 'a'.repeat(40));
    expect(snapshot.groups.map(g=>g.id)).toEqual(['c-new','knife-500','knife-999','glove-source-crate-new']);
    const phases = finishMembers(snapshot.groups[1]);
    expect(phases).toHaveLength(1); expect(phases[0].ids).toEqual(['skin-p1','skin-p2']);
    expect(snapshot.groups[3].pendingGeneration).toBe(true);
  });
  it('一二三代映射完整；原版刀具与对应刀型归为同组', () => {
    expect(bundled.groups.filter(g=>g.id.startsWith('glove-gen-')).map(g=>g.members.length)).toEqual([24,24,24]);
    const bayonet = bundled.groups.find(g=>g.id==='knife-500')!;
    expect(bayonet.members.some(s=>s.id==='skin-vanilla-weapon_bayonet')).toBe(true);
    expect(finishMembers(bayonet)).toHaveLength(25);
  });
  it('拒绝重复 ID、语言错位、缺失成员及危险图片地址', () => {
    expect(()=>normalizeCatalog([...source,source[0]],source,collections,'x')).toThrow();
    expect(()=>normalizeCatalog(source,source.slice(1),collections,'x')).toThrow();
    expect(()=>normalizeCatalog(source,source,[{...collections[0],contains:[{id:'skin-missing'}]}],'x')).toThrow();
    for (const url of ['https://evil.test/p.png','file:///C:/private','javascript:alert(1)','https://community.akamai.steamstatic.com.evil.test/economy/image/a']) expect(imageAllowed(url)).toBe(false);
  });
  it('目录缩减会被拒绝，新增可以应用并统计', () => {
    expect(()=>validateTransition(bundled,{...bundled,groups:bundled.groups.slice(1)})).toThrow();
    const next = {...bundled,groups:[...bundled.groups,{...bundled.groups[0],id:'new-group'}]};
    expect(validateTransition(bundled,next)).toBe(next);
    expect(catalogDifference(bundled,next).groups).toBe(1);
  });
  it('三份数据必须使用同一个提交版本，非法版本不构造 URL', async () => {
    const urls:string[]=[];
    const result = await downloadCatalog(async url => { urls.push(url); return url.endsWith('.atom') ? `<id>Grit::Commit/${'a'.repeat(40)}</id>` : JSON.stringify(url.endsWith('collections.json') ? collections : source); },false);
    expect(result.revision).toBe('a'.repeat(40));
    expect(urls.slice(1).every(u=>u.includes('/'+'a'.repeat(40)+'/'))).toBe(true);
    await expect(downloadCatalog(async()=>'<html>unavailable</html>')).rejects.toThrow();
  });
  it('原子保存、重启读取、并发合并；下载或写盘失败保留快照', async () => {
    const path = await mkdtemp(join(tmpdir(),'cs-rent-catalog-'));
    let calls = 0; let fail = false;
    const next = {...bundled,revision:'b'.repeat(40),groups:[...bundled.groups,{...bundled.groups[0],id:'future-group'}]};
    const service = new CatalogService(path, async()=>{ calls++; if(fail) throw Error('network offline'); return structuredClone(next); });
    await Promise.all([service.refresh(), service.refresh()]);
    expect(calls).toBe(1);
    const persisted = await readFile(join(path,'catalog-v1.json'),'utf8');
    expect((await new CatalogService(path).get()).snapshot.revision).toBe(next.revision);
    fail=true; await expect(service.refresh()).rejects.toThrow('network offline');
    expect(await readFile(join(path,'catalog-v1.json'),'utf8')).toBe(persisted);
    await mkdir(join(path,'catalog-v1.pending.json'));
    fail=false; await expect(service.refresh()).rejects.toThrow('目录保存失败');
    expect((await service.get()).snapshot.revision).toBe(next.revision);
    expect(await readFile(join(path,'catalog-v1.json'),'utf8')).toBe(persisted);
    await writeFile(join(path,'catalog-v1.json'),'broken');
    const fallback = await new CatalogService(path).get();
    expect(fallback.snapshot.revision).toBe(bundled.revision); expect(fallback.warning).toBeTruthy();
  });
});
