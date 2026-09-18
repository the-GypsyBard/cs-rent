import {readFile,readdir,access,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import assert from 'node:assert/strict';
const base=resolve('..'),docDir=resolve(base,'docs');
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/documents-check.json',JSON.stringify({status:'checking',date:new Date().toISOString()}));
async function markdown(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?markdown(resolve(dir,e.name)):e.name.endsWith('.md')?[resolve(dir,e.name)]:[]))).flat();}
const files=[resolve(base,'文档索引.md'),resolve('README.md'),resolve('AGENTS.md'),resolve('PROJECT_CONTEXT.md'),resolve('CHANGELOG.md'),...await markdown(docDir),...await markdown(resolve(base,'验收')),...await markdown(resolve(base,'归档'))];
const broken=[];let links=0;
for(const file of files){const body=await readFile(file,'utf8');for(const match of body.matchAll(/\]\(([^)\n]+)\)/g)){
  const target=match[1];if(/^(?:[a-z]+:|#)/i.test(target))continue;
  const path=decodeURIComponent(target.split('#')[0].replace(/^<|>$/g,''));links++;
  try{await access(resolve(dirname(file),path));}catch{broken.push({file:relative(base,file),target});}
}}
const names=await readdir(docDir);
for(const type of ['产品需求文档','技术选型与架构设计文档','系统设计文档'])assert.equal(names.filter(n=>n.startsWith('CS2饰品管理平台_'+type+'_v')).length,1,`Only one current ${type}`);
assert.equal((await readdir(base)).some(n=>n.startsWith('CS2饰品管理平台_')),false,'No version duplicates at the parent root');
assert.equal(names.some(n=>/验收|自测/.test(n)),false,'Acceptance documents have their own folder');
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/documents-check.json',JSON.stringify({passed:!broken.length,files:files.length,links,broken,date:new Date().toISOString()},null,2));
console.log(JSON.stringify({files:files.length,links,broken},null,2));assert.deepEqual(broken,[]);
