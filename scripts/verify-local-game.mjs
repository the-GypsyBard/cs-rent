import {readFile,open,writeFile,mkdir} from 'node:fs/promises';
import {dirname,basename,join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const source=process.argv[2]||'F:/steam/steamapps/common/Counter-Strike Global Offensive/game/csgo/pak01_dir.vpk';
const directory=await readFile(source);assert.equal(directory.readUInt32LE(0),0x55aa1234);
const version=directory.readUInt32LE(4);assert.ok(version===1||version===2);
const header=version===2?28:12,treeEnd=header+directory.readUInt32LE(8);let pos=header,entry;
function cstring(){const end=directory.indexOf(0,pos);assert.ok(end>=pos&&end<treeEnd);const s=directory.toString('utf8',pos,end);pos=end+1;return s;}
for(let ext=cstring();ext;ext=cstring())for(let path=cstring();path;path=cstring())for(let name=cstring();name;name=cstring()){
  assert.ok(pos+18<=treeEnd);const crc=directory.readUInt32LE(pos),preload=directory.readUInt16LE(pos+4),archive=directory.readUInt16LE(pos+6),offset=directory.readUInt32LE(pos+8),length=directory.readUInt32LE(pos+12);assert.equal(directory.readUInt16LE(pos+16),0xffff);pos+=18;
  const file=(path===' '?'':path+'/')+name+(ext===' '?'':'.'+ext);
  if(file==='scripts/items/items_game.txt')entry={file,crc,preload:Buffer.from(directory.subarray(pos,pos+preload)),archive,offset,length};pos+=preload;
}
assert.ok(entry,'items_game.txt missing');assert.ok(entry.length<20000000);
const archivePath=entry.archive===0x7fff?source:join(dirname(source),basename(source).replace(/_dir\.vpk$/,'_'+String(entry.archive).padStart(3,'0')+'.vpk'));
const handle=await open(archivePath,'r');let content;try{const body=Buffer.alloc(entry.length);const {bytesRead}=await handle.read(body,0,body.length,entry.offset+(entry.archive===0x7fff?treeEnd:0));assert.equal(bytesRead,body.length);content=Buffer.concat([entry.preload,body]);}finally{await handle.close();}
const table=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});let crc=0xffffffff;for(const byte of content)crc=table[(crc^byte)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;assert.equal(crc,entry.crc,'VPK CRC mismatch');
await mkdir('artifacts',{recursive:true});await build({entryPoints:['src/shared/availability.ts'],bundle:true,platform:'node',format:'cjs',outfile:'artifacts/local-game-audit.cjs'});
const {parseKeyValues,armoryGroupIds}=createRequire(import.meta.url)(resolve('artifacts/local-game-audit.cjs'));
const text=content.toString('utf8'),root=parseKeyValues(text).items_game;
const merge=value=>Object.assign({},...[value].flat());const sets=merge(root.item_sets),loot=merge(root.client_loot_lists),items=merge(root.items);
const examples=['bank','italy','lake','train','dust_2','nuke_2','inferno_2','community_34'].map(id=>({set:'set_'+id,definitionPresent:!!sets['set_'+id],relatedLootLists:Object.keys(loot).filter(k=>k.includes('set_'+id)).slice(0,10)}));
const armory=[...armoryGroupIds(text)];
const report={checkedAt:new Date().toISOString(),source,archivePath,entry:entry.file,bytes:content.length,crc32:crc,crcValid:true,sha256:createHash('sha256').update(content).digest('hex'),currentArmoryGroupIds:armory,examples,caseDefinitions:Object.entries(items).filter(([id,v])=>['4011','4904','7003'].includes(id)).map(([id,v])=>({id,name:v.name})),conclusion:'游戏文件可核实收藏成员、武器箱内容、涂装范围和当前武库兑换配置；已退出每周补给的收藏仍保留在资源中，因此仅凭资源存在或不存在不能确定所有官方渠道停投，更不能还原准确停投日期。需结合官方公告或可验证的服务器掉落规则。'};
assert.ok(examples.filter(e=>['set_bank','set_italy','set_lake','set_train','set_dust_2'].includes(e.set)).every(e=>e.definitionPresent),'Expected retired definitions still in resource');
const destination=resolve('../验证记录/本机游戏投放核实_2026-09-18');await mkdir(destination,{recursive:true});await writeFile(join(destination,'核实结果.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
