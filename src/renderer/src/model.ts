export type Page =
  | "overview"
  | "assets"
  | "orders"
  | "wishlist"
  | "collection"
  | "sync"
  | "settings";
export type Platform = "IGXE" | "BUFF" | "悠悠有品" | "Steam";
export type OrderType = "购买" | "出租" | "出售";
export type PublicSubitem = {id:string;name:string;direction:'收入'|'支出';amount:number;adjustments:{id:string;date:string;at:string;mode:'设置'|'增加';amount:number;before:number;after:number;note:string}[]};
export type Asset = {
  id: string;
  skinId: string;
  name: string;
  image: string;
  rarity: string;
  wear: string;
  float: string;
  template: string;
  version: "普通" | "StatTrak™" | "纪念品";
  platform: Platform | null;
  acquisition?: '购买'|'受赠'|'待核对';
  fade?: string;
  style?: string;
  valueSource?: string;
  valueUpdated?: string;
  valueManual?: boolean;
  subitems?: PublicSubitem[];
  status: "持有中" | "已售出" | "已赠出";
  rental: "未出租" | "出租中" | "归还后冷却" | "状态待核实";
  tags: string[];
  date: string;
  cost: number | null;
  value: number | null;
  sale: number;
  note: string;
  collection: string;
  kind: "饰品" | "公共收支";
};
export type Order = {
  settledAt?: string;
  id: string;
  assetId: string | null;
  name: string;
  platform: Platform;
  type: OrderType;
  status: "已完成" | "待结算" | "失败" | "待核对";
  amount: number;
  date: string;
  source: "示例平台记录" | "手工补录";
  term?: "长租" | "短租" | "未知";
  note: string;
};
export type Wish = {
  targets?: { template?: string; floatMin?: string; floatMax?: string; fadeMin?: string; fadeMax?: string; style?: string };
  id: string;
  skinId: string;
  name: string;
  image: string;
  wear: string;
  version: string;
  target: number;
  buff: number | null;
  youpin: number | null;
  igxe: number | null;
  special: string;
  currencyKnown: boolean;
  updated: string;
  failed?: boolean;
  quoteError?:string;
};
export type DemoState = { assets: Asset[]; orders: Order[]; wishes: Wish[] };
export const platformNames: Platform[] = ["IGXE", "BUFF", "悠悠有品", "Steam"];
export const orderTypes: OrderType[] = ["购买", "出租", "出售"];
export const money = (cents: number | null) =>
  cents === null
    ? "待确认"
    : new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
        minimumFractionDigits: 2,
      }).format(cents / 100);
export const formatDate = (iso: string) => iso.replace("T", " ").slice(0, 16);
export function rentFor(assetId: string, orders: Order[]) {
  return orders
    .filter(
      (o) =>
        o.assetId === assetId && o.type === "出租" && o.status === "已完成",
    )
    .reduce((n, o) => n + o.amount, 0);
}
export function assetMetrics(a: Asset, orders: Order[]) {
  const rent = rentFor(a.id, orders);
  return {
    rent,
    net:
      a.kind === "公共收支"
        ? publicAmounts(a).income-publicAmounts(a).expense
        : a.status === "已售出"
          ? a.cost === null
            ? null
            : rent + a.sale - a.cost
          : rent,
    cash: a.kind==='公共收支'?publicAmounts(a).income-publicAmounts(a).expense:a.cost === null ? null : rent + a.sale - a.cost,
  };
}
export function publicAmounts(a:Asset) {
  if(a.kind!=='公共收支')return {income:0,expense:0};
  return a.subitems?.length?a.subitems.reduce((s,c)=>({...s,[c.direction==='收入'?'income':'expense']:s[c.direction==='收入'?'income':'expense']+c.amount}),{income:0,expense:0}):{income:0,expense:a.cost||0};
}
export function totals(assets: Asset[], orders: Order[]) {
  return assets.reduce(
    (s, a) => {
      const m = assetMetrics(a, orders);
      return {
        cost: s.cost + (a.kind === "饰品" ? a.cost || 0 : 0),
        expense: s.expense + publicAmounts(a).expense,
        income: s.income + publicAmounts(a).income,
        rent: s.rent + m.rent,
        sale: s.sale + (a.kind==='饰品'?a.sale:0),
        net: s.net + (m.net || 0),
        cash: s.cash + (a.kind==='公共收支' ? publicAmounts(a).income-publicAmounts(a).expense : m.rent+a.sale-(a.cost??0)),
        value: s.value + (a.kind==='饰品'&&a.status === "持有中" ? a.value || 0 : 0),
        unvalued: s.unvalued + (a.kind==='饰品'&&a.status==='持有中'&&a.value===null?1:0),
        unknown: s.unknown + (a.cost === null ? 1 : 0),
      };
    },
    {
      cost: 0,
      expense: 0,
      income: 0,
      rent: 0,
      sale: 0,
      net: 0,
      cash: 0,
      value: 0,
      unvalued: 0,
      unknown: 0,
    },
  );
}
export function wishStatus(w: Wish) {
  if (w.failed) return "刷新失败";
  if (!w.currencyKnown) return "币种待确认";
  if (w.special || Object.values(w.targets || {}).some(Boolean)) return "需核实特殊属性";
  const prices = [w.buff, w.youpin, w.igxe].filter(
    (p): p is number => p !== null,
  );
  if (!prices.length) return "暂无报价";
  return Math.min(...prices) <= w.target ? "已获取报价达标" : "未达目标价";
}
export function bestWear(assets: Asset[]) {
  if (assets.length && assets.every(a => a.wear === '不适用')) return '无磨损等级';
  const ranks = ["崭新出厂", "略有磨损", "久经沙场", "破损不堪", "战痕累累"];
  const known = assets.map((a) => a.wear).filter((w) => ranks.includes(w));
  return (
    known.sort((a, b) => ranks.indexOf(a) - ranks.indexOf(b))[0] || "磨损待确认"
  );
}
export function selectedTasks(selection: Record<string, string[]>) {
  return platformNames.flatMap((platform) =>
    (selection[platform] || [])
      .filter(
        (t) =>
          orderTypes.includes(t as OrderType) &&
          !(platform === "Steam" && t === "出租"),
      )
      .map((type) => ({ platform, type: type as OrderType })),
  );
}
