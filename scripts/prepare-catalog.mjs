import { readFile, writeFile } from 'node:fs/promises';
import { normalizeCatalog, finishMembers } from '../src/shared/catalog.ts';
import { applyAvailability } from '../src/shared/availability.ts';
const response = await fetch('https://github.com/ByMykel/CSGO-API/commits/main.atom', { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw Error(`GitHub HTTP ${response.status}`);
const sha = (await response.text()).match(/Grit::Commit\/([a-f0-9]{40})<\/id>/)?.[1] || '';
if (!/^[a-f0-9]{40}$/.test(sha)) throw Error('Invalid revision');
const raw = await Promise.all(['en/skins','zh-CN/skins','zh-CN/collections','en/collections'].map(async name => {
  const res = await fetch(`https://raw.githubusercontent.com/ByMykel/CSGO-API/${sha}/public/api/${name}.json`, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw Error(`${name}: HTTP ${res.status}`);
  return res.json();
}));
const snapshot = normalizeCatalog(raw[0],raw[1],raw[2],sha,raw[3]);
const gameFeed=await (await fetch('https://github.com/SteamTracking/GameTracking-CS2/commits/master.atom')).text();
const gameRevision=gameFeed.match(/Grit::Commit\/([a-f0-9]{40})<\/id>/)?.[1];
if(!gameRevision)throw Error('Invalid game revision');
const game=await (await fetch(`https://raw.githubusercontent.com/SteamTracking/GameTracking-CS2/${gameRevision}/game/csgo/pak01_dir/scripts/items/items_game.txt`)).text();
const news=await (await fetch('https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=730&count=500&maxlength=0&feeds=steam_community_announcements')).json();
const old=JSON.parse(await readFile('src/shared/catalog-bundled.json','utf8'));
applyAvailability(snapshot,game,news,gameRevision,old);
const legacy = JSON.parse(await readFile('src/renderer/src/catalog.json', 'utf8'));
for (const g of snapshot.groups) {
  const old = legacy.find(x => x.id === g.id);
  if (old) { g.name = old.name; g.image = old.image; }
  for (const s of g.members) {
    const oldSkin = legacy.flatMap(c => c.members).find(x => x.id === s.id);
    if (oldSkin) s.image = oldSkin.image;
  }
}
snapshot.groups.sort((a,b) => (legacy.findIndex(x=>x.id===a.id) < 0 ? 999 : legacy.findIndex(x=>x.id===a.id)) - (legacy.findIndex(x=>x.id===b.id) < 0 ? 999 : legacy.findIndex(x=>x.id===b.id)));
await writeFile('src/shared/catalog-bundled.json', JSON.stringify(snapshot));
console.log(JSON.stringify({ revision:sha, groups:snapshot.groups.length, categories: ['gun','knife','glove'].map(k => ({kind:k,groups:snapshot.groups.filter(g=>g.kind===k).length,finishes:snapshot.groups.filter(g=>g.kind===k).reduce((n,g)=>n+finishMembers(g).length,0)})) },null,2));
