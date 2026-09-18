import {finishMembers,type CatalogGroup} from '../../shared/catalog';
import type {Asset} from './model';
export function heldFor(assets:Asset[],ids:string[],version?:string){return assets.filter(a=>a.kind==='饰品'&&a.status==='持有中'&&ids.includes(a.skinId)&&(!version||a.version===version));}
export function collectionCounts(group:CatalogGroup,assets:Asset[]){const members=finishMembers(group);return {total:members.length,any:members.filter(m=>heldFor(assets,m.ids).length).length,normal:members.filter(m=>heldFor(assets,m.ids,'普通').length).length,st:members.filter(m=>heldFor(assets,m.ids,'StatTrak™').length).length,stTotal:members.filter(m=>m.stattrak).length};}
