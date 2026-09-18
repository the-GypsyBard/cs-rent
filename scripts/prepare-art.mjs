import { readFile, writeFile, mkdir } from "node:fs/promises";
const source = new URL(
  "../../验证记录/收藏室愿望单_2026-09-18/",
  import.meta.url,
);
const collections = JSON.parse(
  await readFile(new URL("community_collections.json", source), "utf8"),
);
const skins = JSON.parse(
  await readFile(new URL("community_skins.json", source), "utf8"),
);
const names = {
  Corporal: "下士",
  Terrain: "地形",
  Sandstorm: "沙尘暴",
  "Heaven Guard": "天堂守卫",
  Heat: "炽热",
  Pulse: "脉冲",
  Sergeant: "中士",
  Guardian: "守护者",
  Redline: "红线",
  Trigon: "三角",
  Antique: "古董",
  Asiimov: "二西莫夫",
  Chameleon: "变色龙",
  "Wild Lotus": "野荷",
  "Wild Lily": "野百合",
  "Midnight Lily": "午夜百合",
  "Bamboo Garden": "竹林",
  Surfwood: "冲浪木",
  Seabird: "海鸟",
  "Jungle Thicket": "丛林灌木",
  Jungle: "丛林",
  "Sunset Lily": "日落百合",
  "Dark Blossom": "暗色绽放",
  "Banana Leaf": "香蕉叶",
  "Rust Leaf": "锈叶",
  "Day Lily": "日间百合",
  "Crimson Blossom": "绯红之花",
  "Teal Blossom": "蓝色绽放",
  Sundown: "日落",
  "Sea Calico": "海洋花纹",
  "Synth Leaf": "合成叶",
};
const selected = collections.filter((c) =>
  ["The Phoenix Collection", "The St. Marc Collection"].includes(c.name),
);
const output = new URL("../src/renderer/public/art/", import.meta.url);
await mkdir(output, { recursive: true });
const catalog = selected.map((c) => ({
  id: c.id,
  name: c.name.includes("Phoenix") ? "凤凰武器箱" : "圣马克镇收藏品",
  type: c.name.includes("Phoenix") ? "武器箱" : "地图收藏品",
  image: `./art/${c.id}.png`,
  source: "ByMykel/CSGO-API · 2026-09-18 本地验证快照",
  members: c.contains.map((m) => {
    const skin = skins.find((s) => s.id === m.id);
    const [weapon, finish] = m.name.split(" | ");
    return {
      id: m.id,
      name: `${weapon} | ${names[finish] || finish}`,
      english: m.name,
      image: `./art/${m.id}.png`,
      rarity: m.rarity.color,
      stattrak: skin?.stattrak ?? null,
      wears: skin?.wears?.map((w) => w.name) || [],
      sourceImage: m.image,
    };
  }),
}));
const downloads = selected.flatMap((c) => [
  { id: c.id, image: c.image },
  ...c.contains,
]);
let cursor = 0;
await Promise.all(
  Array.from({ length: 5 }, async () => {
    while (cursor < downloads.length) {
      const item = downloads[cursor++];
      const response = await fetch(item.image);
      if (!response.ok) throw new Error(`${item.id}: ${response.status}`);
      await writeFile(
        new URL(`${item.id}.png`, output),
        Buffer.from(await response.arrayBuffer()),
      );
    }
  }),
);
await writeFile(
  new URL("../src/renderer/src/catalog.json", import.meta.url),
  JSON.stringify(catalog, null, 2),
);
await writeFile(
  new URL("../../docs/art-sources.json", import.meta.url),
  JSON.stringify(
    {
      retrieved: "2026-09-18",
      notice:
        "Valve 游戏素材；通过既有 ByMykel/CSGO-API 快照获得原始图片引用。仅用于个人工具展示，不代表 Valve 背书。",
      images: downloads,
    },
    null,
    2,
  ),
);
console.log(
  `Prepared ${downloads.length} referenced images and ${catalog.length} sample collections.`,
);
