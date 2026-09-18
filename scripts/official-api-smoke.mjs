import {_electron as electron} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(`artifacts/official-api-ui-${Date.now()}`);await mkdir(root,{recursive:true});
const env={...process.env,CS_RENT_TEST_DEMO:'1',CS_RENT_TEST_DATA:root};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['out/main/index.js'],env}),page=await app.firstWindow();page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const go=name=>page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name,exact:true}).click();
const shot=name=>page.screenshot({path:resolve(root,name+'.png'),animations:'disabled'});
try{
 await page.getByRole('heading',{name:'每一件饰品，都有迹可循。'}).waitFor();
 const fixture=await page.evaluate(async()=>{const {data}=await window.desktop.data.get();const asset=data.state.assets.find(a=>a.name==='AK-47 | 野荷');asset.valueSource='SteamDT · BUFF';asset.valueUpdated='2026-09-18T10:00:00.000Z';asset.value=217900;await window.desktop.data.save(data.state,data.space);return {asset,catalog:data.catalog};});
 await page.reload();
 await app.evaluate(({ipcMain},catalog)=>{
  globalThis.openedRequests=[];
  ipcMain.removeHandler('market:open');ipcMain.handle('market:open',async(e,r)=>{globalThis.openedRequests.push(r);return {ok:true,target:r.platform||'SteamDT',fallback:false};});
  ipcMain.removeHandler('market:quote');ipcMain.handle('market:quote',async()=>({ok:true,kind:'sell',value:120000,source:'SteamDT · BUFF',updated:'2026-09-18T10:00:00Z',prices:[{platform:'BUFF',cents:120000},{platform:'悠悠有品',cents:125000}]}));
  ipcMain.removeHandler('market:collectionQuote');ipcMain.handle('market:collectionQuote',async(e,r)=>{
   const g=catalog.groups.find(g=>g.members.some(s=>s.id===r.skinId)),skin=g.members.find(s=>s.id===r.skinId),members=skin.phase?g.members.filter(s=>s.finishKey===skin.finishKey):[skin];
   const entries=members.map((s,i)=>({skinId:s.id,style:s.phase,ok:true,kind:s.phase?'style-close':'sell',value:(r.wear==='崭新出厂'?100000:200000)+i*10000,source:s.phase?'SteamDT · 款式收盘参考':'SteamDT · BUFF',updated:'2026-09-18T10:00:00Z'}));return {wear:r.wear,entries,value:Math.min(...entries.map(e=>e.value)),complete:true};
  });
 },fixture.catalog);
 await go('资产与收支');await page.getByRole('button',{name:'查看'+fixture.asset.name,exact:true}).click();const drawer=page.locator('.ant-drawer:visible');
 await drawer.getByRole('button',{name:'BUFF',exact:true}).click();await drawer.getByRole('button',{name:'SteamDT',exact:true}).click();
 const opened=await app.evaluate(()=>globalThis.openedRequests);assert.equal(opened.at(-2).platform,'BUFF');assert.equal(opened.at(-1).platform,undefined);assert.equal(opened.at(-2).skinId,fixture.asset.skinId);await shot('60-source-links');
 await drawer.getByRole('button',{name:/在收藏室查看/}).click();await page.locator('.focused-finish').waitFor();assert.match(await page.locator('.focused-finish').innerText(),/野荷/);assert.match(await page.locator('.collection-banner').innerText(),/圣马克/);await shot('61-asset-collection-location');
 const search=page.getByRole('textbox',{name:'搜索全部收藏饰品'});await search.fill('刺刀 多普勒 红宝石');await page.locator('.catalog-search-item').first().click();const row=page.locator('.collection-skin').filter({hasText:'刺刀（★） | 多普勒'}).first();await row.scrollIntoViewIfNeeded();await row.getByTestId('quote-minimum').getByText('¥1,000.00',{exact:true}).waitFor();
 assert.deepEqual(await row.locator('.style-price .phase').allTextContents(),['P1','P2','P3','P4','红宝石','蓝宝石','黑珍珠']);assert.match(await row.locator('.collection-price-bar').innerText(),/款式收盘参考价最低值/);assert.equal(await row.locator('.style-price img').count(),7);assert.ok((await row.locator('.style-price small').allTextContents()).every(t=>t.includes('2026')));
 await row.getByRole('combobox',{name:'刺刀（★） | 多普勒报价磨损'}).click();await page.locator('.ant-select-item-option-content:visible').getByText('略有磨损',{exact:true}).click();await row.getByTestId('quote-minimum').getByText('¥2,000.00',{exact:true}).waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.style-thumb img')].some(i=>i.complete&&i.naturalWidth>0),null,{timeout:15000}).catch(()=>{});await shot('62-doppler-order-reference');
 await page.getByRole('button',{name:'切换深色主题',exact:true}).click();await shot('63-doppler-dark');
 await go('愿望单');await page.getByRole('button',{name:'刷新 SteamDT 报价',exact:true}).click();await page.getByText('已通过 SteamDT 官方 API 刷新 3 个愿望',{exact:true}).waitFor();assert.ok((await page.locator('.wish-card').first().innerText()).includes('¥1,200.00'));await shot('64-wishlist-api');
 await go('设置');assert.match(await page.locator('body').innerText(),/尚未配置密钥/);await page.getByRole('textbox',{name:'SteamDT API_KEY'}).fill('fake-key-used-only-in-tests');await page.getByRole('button',{name:'保存密钥',exact:true}).click();await page.getByText('已配置密钥',{exact:true}).waitFor();
 assert.equal(await page.getByRole('textbox',{name:'SteamDT API_KEY'}).inputValue(),'');const encrypted=await readFile(resolve(root,'steamdt-credentials.json'),'utf8');assert.ok(!encrypted.includes('fake-key-used-only-in-tests'));
 const backup=JSON.stringify(await page.evaluate(()=>window.desktop.data.get()));assert.ok(!backup.includes('fake-key-used-only-in-tests'));assert.ok(!backup.includes('cipher'));await shot('65-api-settings');
 await page.getByRole('button',{name:'移除密钥',exact:true}).click();await page.getByText('尚未配置密钥',{exact:true}).waitFor();assert.deepEqual(errors,[]);
 await writeFile('artifacts/official-api-smoke-result.json',JSON.stringify({passed:true,mode:'deterministic API response fixtures; no real credentials',date:new Date().toISOString(),root,checks:['来源独立跳转','资产定位收藏品并高亮','P1–P4及宝石排序','款式图标、日期、报价类型与统一切换磨损','明暗主题','愿望单 API 刷新及人民币展示','密钥安全保存/移除/不回显/不进备份'],errors},null,2));console.log('PASS official API UI: '+root);
}catch(e){await shot('failure');await writeFile(resolve(root,'failure.txt'),await page.locator('body').innerText());throw e;}finally{await app.close();}
