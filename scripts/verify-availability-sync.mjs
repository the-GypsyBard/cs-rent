import {_electron as electron} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(`artifacts/availability-sync-${Date.now()}`);await mkdir(root,{recursive:true});
const env={...process.env,CS_RENT_TEST_DATA:root,CS_RENT_TEST_DEMO:'1'};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['out/main/index.js'],env});
try{
 const page=await app.firstWindow();await page.getByRole('heading',{name:'每一件饰品，都有迹可循。'}).waitFor();
 const before=await page.evaluate(()=>window.desktop.data.get());
 const result=await page.evaluate(()=>window.desktop.catalog.availability());assert.equal(result.ok,true,result.error);
 const after=await page.evaluate(()=>window.desktop.data.get());assert.deepEqual(after.data.state,before.data.state);assert.deepEqual(after.data.settings,before.data.settings);
 const groups=result.snapshot.groups.filter(g=>g.kind==='gun');assert.equal(groups.length,94);assert.equal(groups.find(g=>g.id==='collection-set-dust').availability.length,0);
 assert.ok(groups.find(g=>g.type==='限定物品').members.every(s=>s.availability?.length));
 await writeFile('artifacts/availability-sync-result.json',JSON.stringify({passed:true,date:new Date().toISOString(),groups:groups.length,withEvidence:groups.filter(g=>g.availability.length).length,gameRevision:result.snapshot.gameRevision,businessAndSettingsUnchanged:true},null,2));
 console.log('PASS live manual availability IPC: 94 groups, ledger/settings unchanged');
}finally{await app.close();}
