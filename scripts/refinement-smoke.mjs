import {_electron as electron} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(`artifacts/refinement-ui-${Date.now()}`);await mkdir(root,{recursive:true});
const env={...process.env,CS_RENT_TEST_DEMO:'1',CS_RENT_TEST_DATA:root};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['out/main/index.js'],env});const page=await app.firstWindow();page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const catalog=JSON.parse(await readFile('src/shared/catalog-bundled.json','utf8'));
const knife=catalog.groups.find(g=>g.id==='knife-500'),ruby=knife.members.find(s=>s.english==='★ Bayonet | Doppler'&&s.phase==='Ruby');
const go=name=>page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name,exact:true}).click();
const shot=name=>page.screenshot({path:resolve(root,name+'.png'),animations:'disabled'});
try{
 await page.getByRole('heading',{name:'每一件饰品，都有迹可循。'}).waitFor();
 await page.evaluate(async ruby=>{const {data}=await window.desktop.data.get();data.state.assets.push({...data.state.assets[0],id:'ruby-test-owned',skinId:ruby.id,name:ruby.name+' · Ruby',status:'持有中',version:'普通',wear:'崭新出厂',image:ruby.image});await window.desktop.data.save(data.state,data.space);},ruby);await page.reload();
 await app.evaluate(({ipcMain,shell},catalog)=>{
  globalThis.quoteCalls=[];globalThis.openedLinks=[];shell.openExternal=async url=>{globalThis.openedLinks.push(url);};
  ipcMain.removeHandler('market:collectionQuote');ipcMain.handle('market:collectionQuote',async(event,r)=>{
   globalThis.quoteCalls.push(r);const group=catalog.groups.find(g=>g.members.some(s=>s.id===r.skinId));const skin=group.members.find(s=>s.id===r.skinId);const members=skin.phase?group.members.filter(s=>s.finishKey===skin.finishKey):[skin];
   const entries=members.map((s,i)=>({skinId:s.id,style:s.phase,ok:true,value:(r.wear==='崭新出厂'?100000:200000)+i*10000,source:'交互测试固定报价 · 非实时行情',updated:new Date().toISOString()}));
   return {wear:r.wear,entries,value:Math.min(...entries.map(e=>e.value)),complete:true};
  });
 },catalog);
 assert.equal((await app.evaluate(()=>globalThis.quoteCalls)).length,0,'Hidden collection must not fetch quotes');
 await go('收藏室');
 const search=page.getByRole('textbox',{name:'搜索全部收藏饰品'});
 await search.fill('刺刀 渐变之色');assert.ok(await page.locator('.catalog-search-item').count()>0);assert.match(await page.locator('.catalog-search-item').first().innerText(),/渐变之色/);await shot('50-fuzzy-search');
 await search.fill('刺刀 多普勒 红宝石');const result=page.locator('.catalog-search-item').filter({hasText:'刺刀（★） | 多普勒'}).first();await result.click();
 const row=page.locator('.collection-skin').filter({hasText:/^.*刺刀（★） \| 多普勒/}).first();await row.scrollIntoViewIfNeeded();
 await row.locator('.collection-price').getByTestId('quote-minimum').getByText('¥1,000.00',{exact:true}).waitFor();
 assert.equal(await row.locator('.style-price').count(),7);assert.match(await row.locator('.owned-phase').innerText(),/红宝石/);assert.equal(await row.getByText('Ruby',{exact:true}).count(),0);
 await row.getByRole('combobox',{name:knife.members.find(s=>s.id===ruby.id).name+'报价磨损'}).click();await page.locator('.ant-select-item-option-content:visible').getByText('略有磨损',{exact:true}).click();
 await row.getByTestId('quote-minimum').getByText('¥2,000.00',{exact:true}).waitFor();assert.equal(await row.locator('.style-price').count(),7);await shot('51-doppler-styles-light');
 await page.getByRole('button',{name:'切换深色主题',exact:true}).click();await shot('52-doppler-styles-dark');
 await row.locator('.style-price').filter({hasText:'红宝石'}).click();assert.match(decodeURIComponent((await app.evaluate(()=>globalThis.openedLinks)).at(-1)),/Bayonet \| Doppler \(Minimal Wear\)/);
 await search.fill('AWP 二西莫夫');await page.locator('.catalog-search-item').first().click();const gunrow=page.locator('.collection-skin').first();await gunrow.scrollIntoViewIfNeeded();assert.match(await gunrow.locator('.collection-price-bar').innerText(),/久经沙场/);
 await page.getByText('武库通行证',{exact:true}).first().click();await page.getByText('限定物品',{exact:true}).first().click();assert.match(await page.locator('.collection-banner').innerText(),/限定物品/);assert.match(await page.locator('.collection-banner').innerText(),/4 款/);await shot('53-armory-limited');
 await go('资产与收支');await page.getByRole('button',{name:'查看AK-47 | 野荷',exact:true}).click();await page.locator('.ant-drawer:visible').getByRole('button',{name:'AK-47 | 野荷 ↗',exact:true}).click();
 assert.match(decodeURIComponent((await app.evaluate(()=>globalThis.openedLinks)).at(-1)),/AK-47 \| Wild Lotus \(Battle-Scarred\)/);await shot('54-asset-steamdt');
 await page.locator('.ant-drawer:visible').getByRole('button',{name:'关闭',exact:true}).click();await page.getByRole('button',{name:'新增记录',exact:true}).click();await page.locator('.ant-modal:visible').getByLabel('选择商品',{exact:true}).fill('刺刀 渐变之色');await page.locator('.ant-select-item-option-content:visible').first().waitFor();
 assert.deepEqual(errors,[]);await writeFile('artifacts/refinement-smoke-result.json',JSON.stringify({passed:true,root,date:new Date().toISOString(),quoteMode:'deterministic IPC fixtures; not proof of live style quotes',checks:['隐藏页面不请求报价','多关键词跨分隔符搜索','宝石中文名称与拥有点亮','七款式统一切换磨损及主行最低价','不支持崭新的皮肤默认久经沙场','限定物品武库分类','资产档案 SteamDT 跳转','新增记录模糊搜索','明暗主题截图'],errors},null,2));console.log('PASS: refinement UI, screenshots: '+root);
}catch(e){await shot('failure');await writeFile(resolve(root,'failure.txt'),await page.locator('body').innerText());throw e;}finally{await app.close();}
