import {open,readFile,mkdir,rename,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {constants} from 'node:fs';
import {z} from 'zod';
import {defaultSettings,emptyState,workspaceSchema,stateSchema,settingsSchema,migrateState,type WorkspaceData,type UserSettings} from '../shared/user-data';
import type {CatalogSnapshot} from '../shared/catalog';
export class WorkspaceService {
  private current:WorkspaceData;
  private queue:Promise<unknown>=Promise.resolve();
  private loaded:Promise<void>;
  exists=false;error='';
  readonly file:string;
  constructor(readonly directory:string,catalog:CatalogSnapshot,theme:'light'|'dark'|null=null){
    this.file=join(directory,'workspace-v2.json');
    this.current={format:'cs-rent-user-data',schemaVersion:2,appVersion:'0.8.0',exportedAt:new Date().toISOString(),space:'personal',state:emptyState(),settings:{...defaultSettings,theme:theme||'light'},catalog};
    this.loaded=this.load();
  }
  private async load(){try{this.current=workspaceSchema.parse(JSON.parse(await readFile(this.file,'utf8')));this.current.state=migrateState(this.current.state);this.exists=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')this.error='用户数据未能读取，原文件已保留。请导入有效备份恢复，暂不覆盖原文件。';}}
  async get(){await this.loaded;await this.queue;return {data:structuredClone(this.current),exists:this.exists,error:this.error,path:this.directory};}
  private transact(change:(current:WorkspaceData)=>WorkspaceData,restore=false):Promise<WorkspaceData>{
    const work=this.queue.then(async()=>{
      await this.loaded;if(this.error&&!restore)throw Error(this.error);
      const next=workspaceSchema.parse(change(structuredClone(this.current)));next.exportedAt=new Date().toISOString();next.appVersion='0.8.0';
      await mkdir(this.directory,{recursive:true});
      if(restore&&(this.exists||this.error))await copyFile(this.file,join(this.directory,`before-restore-${Date.now()}-${crypto.randomUUID()}.json`),constants.COPYFILE_EXCL);
      const pending=join(this.directory,'workspace-v2.pending.json');const handle=await open(pending,'w');
      try{await handle.writeFile(JSON.stringify(next));await handle.sync();}finally{await handle.close();}
      await rename(pending,this.file);this.current=next;this.exists=true;this.error='';return structuredClone(next);
    });this.queue=work.catch(()=>{});return work;
  }
  saveState(state:unknown,space?:'personal'|'demo'){const parsed=stateSchema.parse(state);return this.transact(c=>({...c,state:parsed,space:space||c.space}));}
  setSettings(input:unknown){const parsed=z.object({theme:z.enum(['light','dark']).optional(),largeText:z.boolean().optional(),assetColumns:z.array(z.enum(['cost','rent','sale','net','cash','value'])).optional()}).strict().parse(input);return this.transact(c=>({...c,settings:{...c.settings,...parsed}}));}
  setCatalog(catalog:CatalogSnapshot){return this.transact(c=>({...c,catalog}));}
  restore(data:unknown){const parsed=workspaceSchema.parse(data);return this.transact(()=>parsed,true);}
  async export(){const {data,error}=await this.get();if(error)throw Error(error);return {...data,exportedAt:new Date().toISOString()};}
}
