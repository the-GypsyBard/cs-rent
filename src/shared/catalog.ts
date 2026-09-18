import { z } from 'zod';

export const imageAllowed = (value: string) => {
  if (!value || /^\.\/art\/[a-zA-Z0-9-]+\.png$/.test(value)) return true;
  try {
    const u = new URL(value);
    const allowed = (u.hostname === 'community.akamai.steamstatic.com' && u.pathname.startsWith('/economy/image/')) ||
      (u.hostname === 'raw.githubusercontent.com' && u.pathname.startsWith('/ByMykel/counter-strike-image-tracker/')) ||
      (u.hostname === 'cdn.steamstatic.com' && u.pathname.startsWith('/'));
    return u.protocol === 'https:' && allowed && !u.username && !u.password && !u.port;
  } catch { return false; }
};
const text = z.string().min(1).max(500);
const ref = z.object({ id: text, name: text });
const rawSkin = z.object({
  id: text, name: text, weapon: z.object({ id: text, weapon_id: z.number().int(), name: text }),
  category: ref, pattern: ref.nullable().optional(), rarity: z.object({ color: z.string().regex(/^#[a-fA-F0-9]{6}$/) }),
  stattrak: z.boolean(), souvenir: z.boolean().optional(), paint_index: z.string().nullable(),
  wears: z.array(ref).optional(), crates: z.array(ref).optional(), phase: z.string().optional(),
  image: z.string().max(3000).refine(imageAllowed),
  min_float:z.number().nullable().optional(),max_float:z.number().nullable().optional(),
});
const rawCollection = z.object({
  id: text, name: text, image: z.string().max(3000).refine(imageAllowed),
  contains: z.array(z.object({ id: text })).max(1000), crates: z.array(ref).optional(),
  release_date:z.string().nullable().optional(),
});
export type CatalogKind = 'gun' | 'knife' | 'glove';
export type AvailabilityEvent={channel:string;status:'active'|'retired'|'unknown';date?:string;source:string};
export type CatalogSkin = {
  id: string; name: string; english: string; image: string; rarity: string;
  stattrak: boolean; souvenir: boolean; wears: string[]; finishKey: string;
  phase?: string; sourceImage: string;
  minFloat?:number;maxFloat?:number;styles?:string[];availability?:AvailabilityEvent[];
};
export type CatalogGroup = {
  id: string; name: string; type: string; kind: CatalogKind; image: string;
  source: string; members: CatalogSkin[]; pendingGeneration?: boolean;
  releaseDate?:string;english?:string;armory?:boolean;
  availability?:{channel:string;status:'active'|'retired'|'unknown';date?:string;source:string}[];
};
export type CatalogSnapshot = { schema: 1; revision: string; updatedAt: string; groups: CatalogGroup[];gameRevision?:string;availabilityCheckedAt?:string };
const availabilitySchema=z.array(z.object({channel:text,status:z.enum(['active','retired','unknown']),date:z.string().optional(),source:z.string().max(3000)})).max(500).optional();
const picture = z.string().max(3000).refine(imageAllowed);
export const isLimitedGroup=(group:{id:string;english?:string})=>/^collection-set-xpshop-wpn-\d+$/.test(group.id)||group.english==='Limited Edition Item';
export const snapshotSchema = z.object({
  schema: z.literal(1), revision: z.string().regex(/^[a-f0-9]{40}$/), updatedAt: z.string().datetime(),
  gameRevision:z.string().regex(/^[a-f0-9]{40}$/).optional(),availabilityCheckedAt:z.string().datetime().optional(),
  groups: z.array(z.object({
    id: text, name: text, type: text, kind: z.enum(['gun', 'knife', 'glove']), image: picture, source: text,
    pendingGeneration: z.boolean().optional(),
    releaseDate:z.string().optional(),english:text.optional(),armory:z.boolean().optional(),
    availability:z.array(z.object({channel:text,status:z.enum(['active','retired','unknown']),date:z.string().optional(),source:z.string().max(3000)})).max(500).optional(),
    members: z.array(z.object({
      id: text, name: text, english: text, image: picture, sourceImage: picture,
      rarity: z.string().regex(/^#[a-fA-F0-9]{6}$/), stattrak: z.boolean(), souvenir: z.boolean(),
      wears: z.array(text).min(1).max(10), finishKey: text, phase: text.optional(),
      availability:availabilitySchema,minFloat:z.number().min(0).max(1).optional(),maxFloat:z.number().min(0).max(1).optional(),styles:z.array(text).max(100).optional(),
    })).min(1).max(5000),
  })).min(1).max(2000),
}).transform(snapshot=>({...snapshot,groups:snapshot.groups.map(g=>isLimitedGroup(g)?{...g,type:'限定物品',armory:true}:g)}));
const SOURCE = 'ByMykel/CSGO-API · 游戏资源社区目录';
const WEARS = ['崭新出厂', '略有磨损', '久经沙场', '破损不堪', '战痕累累'];
const generations = [
  { id: 'glove-gen-1', name: '一代手套', crates: ['crate-4288', 'crate-4352'] },
  { id: 'glove-gen-2', name: '二代手套', crates: ['crate-4471', 'crate-4880'] },
  { id: 'glove-gen-3', name: '三代手套', crates: ['crate-4717', 'crate-4747', 'crate-4846'] },
];
export function normalizeCatalog(enInput: unknown, zhInput: unknown, collectionsInput: unknown, revision: string, enCollectionsInput?:unknown): CatalogSnapshot {
  const en = z.array(rawSkin).min(1).max(50000).parse(enInput);
  const zh = z.array(rawSkin).min(1).max(50000).parse(zhInput);
  const collections = z.array(rawCollection).min(1).max(2000).parse(collectionsInput);
  const enCollections=enCollectionsInput?z.array(rawCollection).parse(enCollectionsInput):[];
  const english = new Map(en.map(s => [s.id, s]));
  if (english.size !== en.length || new Set(zh.map(s => s.id)).size !== zh.length ||
    new Set(collections.map(c => c.id)).size !== collections.length || en.length !== zh.length)
    throw new Error('目录包含重复或不一致的条目');
  const all = new Map<string, CatalogSkin>();
  for (const s of zh) {
    const e = english.get(s.id);
    if (!e || e.weapon.weapon_id !== s.weapon.weapon_id || e.paint_index !== s.paint_index)
      throw new Error('目录语言快照不一致');
    all.set(s.id, {
      id: s.id, name: s.name, english: e.name, image: s.image, sourceImage: s.image,
      rarity: s.rarity.color, stattrak: s.stattrak, souvenir: s.souvenir === true,
      wears: s.wears?.length ? s.wears.map(w => WEARS[Number(w.id.slice(-1))] || w.name) : ['不适用'],
      // Knife phases share a finish; original source IDs remain available for exact asset matching.
      finishKey: s.category.id === 'sfui_invpanel_filter_melee' ? `${s.weapon.weapon_id}:${e.pattern?.name || 'Vanilla'}` : s.id,
      ...(s.phase ? { phase: s.phase } : {}),
      ...(s.min_float!=null?{minFloat:s.min_float}:{}),...(s.max_float!=null?{maxFloat:s.max_float}:{}),
    });
  }
  const groups: CatalogGroup[] = [];
  const rare = new Set(zh.filter(s => ['sfui_invpanel_filter_melee', 'sfui_invpanel_filter_gloves'].includes(s.category.id)).map(s => s.id));
  for (const c of collections) {
    const members = c.contains.filter(x => x.id.startsWith('skin-') && !rare.has(x.id)).map(x => {
      const m = all.get(x.id);
      if (!m) throw new Error(`收藏品成员缺失：${c.id}`);
      return m;
    });
    const ec=enCollections.find(e=>e.id===c.id);
    const isCase=ec?ec.crates?.some(c=>/(?:Case|Terminal)$/.test(c.name)):c.crates?.some(c=>/武器箱|终端/.test(c.name));
    if (members.length) groups.push({ id: c.id, name: c.name, kind: 'gun', type: isCase ? '武器箱' : '收藏品', image: c.image, source: SOURCE, members,
      ...(c.release_date?{releaseDate:c.release_date}:{}),...(ec?{english:ec.name}:{}) });
  }
  for (const s of zh.filter(s => rare.has(s.id))) {
    const knife = s.category.id === 'sfui_invpanel_filter_melee';
    const generation = generations.find(g => s.crates?.some(c => g.crates.includes(c.id)));
    const source = [...(s.crates || [])].sort((a,b) => a.id.localeCompare(b.id))[0];
    const id = knife ? `knife-${s.weapon.weapon_id}` : generation?.id || `glove-source-${source?.id || 'unknown'}`;
    let group = groups.find(g => g.id === id);
    if (!group) {
      group = {
        id, name: knife ? s.weapon.name : generation?.name || `${source?.name || '来源待确认'} · 新系列`,
        kind: knife ? 'knife' : 'glove', type: knife ? '刀型收藏' : generation ? '按代数收藏' : '代数待确认',
        image: s.image, source: SOURCE, members: [], pendingGeneration: !knife && !generation,
      };
      groups.push(group);
    }
    group.members.push(all.get(s.id)!);
  }
  groups.sort((a,b) => ({gun:0,knife:1,glove:2}[a.kind] - {gun:0,knife:1,glove:2}[b.kind]) || (a.kind === 'glove' ? a.id.localeCompare(b.id) : 0));
  for(const g of groups)for(const s of g.members)if(s.phase)s.styles=[...new Set(g.members.filter(m=>m.finishKey===s.finishKey).flatMap(m=>m.phase?[m.phase]:[]))];
  return snapshotSchema.parse({ schema: 1, revision, updatedAt: new Date().toISOString(), groups });
}
export function finishMembers(group: CatalogGroup) {
  const finishes = new Map<string, CatalogSkin & { ids: string[]; phases: string[] }>();
  for (const skin of group.members) {
    const key = group.kind === 'knife' ? skin.finishKey : skin.id;
    const existing = finishes.get(key);
    if (existing) { existing.ids.push(skin.id); if (skin.phase) existing.phases.push(skin.phase); }
    else finishes.set(key, { ...skin, ids: [skin.id], phases: skin.phase ? [skin.phase] : [] });
  }
  return [...finishes.values()];
}
// An incomplete upstream response must never erase an accepted catalog snapshot.
export function validateTransition(previous: CatalogSnapshot, next: CatalogSnapshot) {
  const groupMembers = new Map(next.groups.map(g => [g.id, new Set(g.members.map(s=>s.id))]));
  if (previous.groups.some(g => !groupMembers.has(g.id) || g.members.some(s => !groupMembers.get(g.id)!.has(s.id))))
    throw new Error('新目录缺少已有条目，已保留上次成功目录；请稍后重试');
  return next;
}
export function catalogDifference(previous: CatalogSnapshot, next: CatalogSnapshot) {
  const groups = new Set(previous.groups.map(g => g.id));
  const finishes = new Set(previous.groups.flatMap(g => finishMembers(g).map(m => `${g.id}:${m.finishKey}`)));
  return {
    groups: next.groups.filter(g => !groups.has(g.id)).length,
    finishes: next.groups.flatMap(g => finishMembers(g).filter(m => !finishes.has(`${g.id}:${m.finishKey}`))).length,
  };
}
