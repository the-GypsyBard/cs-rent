// Read-only live audit of public catalog ranges and official distribution evidence.
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const destination=resolve('../验证记录/收藏目录与磨损_2026-09-18');
await mkdir(destination,{recursive:true});await mkdir('artifacts',{recursive:true});
await build({stdin:{contents:`export * from './src/main/catalog-service'; export * from './src/shared/availability';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',outfile:'artifacts/public-audit.cjs'});
const {downloadCatalog,fetchText,parseKeyValues,latestAvailability}=createRequire(import.meta.url)(resolve('artifacts/public-audit.cjs'));
const sources=[];const bodies=new Map();
const snapshot=await downloadCatalog(async(url,limit)=>{
  const body=await fetchText(url,limit);bodies.set(url,body);
  sources.push({url,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')});return body;
});
const gameEntry=[...bodies].find(([url])=>url.endsWith('items_game.txt'));
const newsEntry=[...bodies].find(([url])=>url.includes('ISteamNews'));
const skins=JSON.parse([...bodies].find(([url])=>url.endsWith('/en/skins.json'))[1]);
const root=parseKeyValues(gameEntry[1]).items_game;
const kits={};for(const section of [root.paint_kits].flat())for(const [id,kit] of Object.entries(section))kits[id]={...kits[id],...kit};
assert.ok(kits['0']?.wear_remap_min&&kits['0']?.wear_remap_max,'Require the game default paint kit, never assume zero');
const ranges=skins.filter(s=>s.min_float!=null&&s.max_float!=null).map(s=>{
  const kit=kits[s.paint_index];const min=kit?Number(kit.wear_remap_min??kits['0'].wear_remap_min):null,max=kit?Number(kit.wear_remap_max??kits['0'].wear_remap_max):null;
  return {id:s.id,name:s.name,paintIndex:s.paint_index,catalogMin:s.min_float,catalogMax:s.max_float,gameMin:min,gameMax:max,matched:!!kit&&min===s.min_float&&max===s.max_float};
});
const guns=snapshot.groups.filter(g=>g.kind==='gun').map(g=>({id:g.id,name:g.name,english:g.english,type:g.type,armory:!!g.armory,channels:latestAvailability(g)}));
const news=JSON.parse(newsEntry[1]);
const referenced=new Set(guns.flatMap(g=>g.channels.map(c=>c.source)));
const evidence=news.appnews.newsitems.filter(n=>referenced.has(n.url));
const report={checkedAt:new Date().toISOString(),revision:snapshot.revision,gameRevision:snapshot.gameRevision,sources,
  summary:{gunGroups:guns.length,withChannelEvidence:guns.filter(g=>g.channels.length).length,unknown:guns.filter(g=>!g.channels.length).length,withRetiredChannel:guns.filter(g=>g.channels.some(c=>c.status==='retired')).length,armoryCurrent:guns.filter(g=>g.channels.some(c=>c.channel==='武库通行证'&&c.status==='active')).length,floatSkins:ranges.length,floatMatches:ranges.filter(r=>r.matched).length},
  floatExamples:ranges.filter(r=>['AK-47 | Wild Lotus','AK-47 | Redline','AWP | Asiimov','★ Bayonet | Fade'].includes(r.name)),floatMismatches:ranges.filter(r=>!r.matched),groups:guns};
const assertions=[];
for(const [ids,date] of [[['bank','italy','lake','train'],'2025-03-31'],[['safehouse','dust-2','nuke-2','inferno-2'],'2026-01-21']])for(const id of ids){
  const group=guns.find(g=>g.id==='collection-set-'+id);
  assert.ok(group?.channels.some(c=>c.channel==='每周补给'&&c.status==='retired'&&c.date===date),`Missing official removal for ${id}`);
  assertions.push(`${group.name}：每周补给停投 ${date}`);
}
assert.equal(guns.find(g=>g.id==='collection-set-dust').channels.length,0,'Dust must not inherit Dust 2 evidence');
assertions.push('原版 Dust 未误用 Dust 2 公告');
report.assertions=assertions;
await writeFile(resolve(destination,'核实结果.json'),JSON.stringify(report,null,2));
await writeFile(resolve(destination,'官方公告证据.json'),JSON.stringify({checkedAt:report.checkedAt,source:newsEntry[0],newsitems:evidence},null,2));
await writeFile(resolve(destination,'磨损范围比对.json'),JSON.stringify(ranges,null,2));
await writeFile(resolve(destination,'目录快照.json'),JSON.stringify(snapshot));
console.log(JSON.stringify({summary:report.summary,examples:report.floatExamples,mismatches:report.floatMismatches.slice(0,12),destination},null,2));
assert.equal(report.floatMismatches.length,0,'Any range mismatch needs manual review before declaring verified');
