import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=resolve('artifacts/api-research-v08');await mkdir(root,{recursive:true});
await build({entryPoints:['src/main/steamdt-api.ts','src/main/market-service.ts'],bundle:true,platform:'node',format:'cjs',outdir:root,outExtension:{'.js':'.cjs'},external:['electron']});
// The helper only reads the real encrypted credential in memory. No real ledger or credential is copied to a test folder.
await writeFile(resolve(root,'verify-client.cjs'),String.raw`
const {app,safeStorage}=require('electron');const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
app.setName('CS饰品平台-交互原型');
app.whenReady().then(async()=>{
 const {SteamdtApi}=require('./steamdt-api.cjs');const {CollectionQuoteService,resolveReferencePrice,resolveMarketLink}=require('./market-service.cjs');
 const file=path.join(app.getPath('userData'),'steamdt-credentials.json');
 const credentials={get:async()=>{const c=JSON.parse(await fs.readFile(file,'utf8'));return safeStorage.decryptString(Buffer.from(c.cipher,'base64'));}};
 const api=new SteamdtApi(__dirname,credentials),service=new CollectionQuoteService(api);
 const catalog=JSON.parse(await fs.readFile(path.resolve('src/shared/catalog-bundled.json'),'utf8'));
 const knife=catalog.groups.find(g=>g.english==='Butterfly Knife'||g.id==='knife-515');
 const gamma=knife.members.find(s=>s.english==='★ Butterfly Knife | Gamma Doppler');const doppler=knife.members.find(s=>s.english==='★ Butterfly Knife | Doppler');
 const gun=catalog.groups.flatMap(g=>g.members).find(s=>s.english==='AK-47 | Redline');
 const ordinary=await resolveReferencePrice({skinId:gun.id,wear:'略有磨损',version:'普通'},catalog,api);assert.equal(ordinary.ok,true);assert.equal(ordinary.kind,'sell');
 const result={checkedAt:new Date().toISOString(),ordinary,styles:[],links:[]};
 for(const skin of [gamma,doppler]){const q=await service.get({skinId:skin.id,wear:'崭新出厂',version:'普通'},catalog);assert.ok(q.value>0);assert.ok(q.entries.every(e=>e.kind==='style-close'));assert.equal(q.entries[0].style,'Phase 1');result.styles.push({name:skin.english,...q});}
 for(const platform of ['BUFF','悠悠有品','C5GAME','HaloSkins']){const link=await resolveMarketLink({skinId:gamma.id,wear:'崭新出厂',version:'普通',platform},catalog,api);assert.equal(link.fallback,false);result.links.push(link);}
 const lowerWear=await service.get({skinId:gamma.id,wear:'略有磨损',version:'普通'},catalog);assert.equal(lowerWear.wear,'略有磨损');result.alternateWear=lowerWear;
 await fs.writeFile(path.join(__dirname,'live-client-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,ordinary:ordinary.value,styles:result.styles.map(s=>({name:s.name,min:s.value,complete:s.complete,quotes:s.entries.map(e=>({style:e.style,value:e.value,updated:e.updated}))})),alternateWearComplete:lowerWear.complete,links:result.links}));
}).catch(e=>{console.error(e.message);app.exit(1);}).finally(()=>app.quit());
`);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
await new Promise((done,reject)=>{const child=spawn(require('electron'),[resolve(root,'verify-client.cjs')],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);child.on('error',reject);child.on('exit',code=>code===0?done():reject(Error('Official API verification failed: '+code)));});
