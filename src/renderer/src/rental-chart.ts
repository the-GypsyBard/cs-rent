import type { Order } from './model';
export const rentalRanges = ['7天','15天','1月','3月','6月','1年','自定义'];
const day = 86400000;
export function validDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s; }
export function rentalRange(preset: string, end: string) {
  const d = new Date(end+'T00:00:00Z');
  if (preset === '7天' || preset === '15天') d.setUTCDate(d.getUTCDate() - (preset === '7天' ? 6 : 14));
  else {
    const n = ({'1月':1,'3月':3,'6月':6,'1年':12} as Record<string,number>)[preset] || 1;
    const date = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()-n);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1,0)).getUTCDate();
    d.setUTCDate(Math.min(date,last)+1);
  }
  return [d.toISOString().slice(0,10),end] as const;
}
export function rentalSeries(orders: Order[], start: string, end: string) {
  if (!validDate(start)||!validDate(end)||start>end) throw new Error('请选择有效的起止日期，开始日期不能晚于结束日期');
  const length = Math.round((Date.parse(end)-Date.parse(start))/day)+1;
  if (length>3660) throw new Error('单次图表跨度请控制在 10 年内');
  const eligible=orders.filter(o=>o.type==='出租'&&o.status==='已完成'&&o.assetId);
  const dates=Array.from({length},(_,i)=>new Date(Date.parse(start)+i*day).toISOString().slice(0,10));
  const totals=new Map<string,number>(); let count=0, opening=0;
  for(const o of eligible) if(o.settledAt && validDate(o.settledAt) && o.settledAt<=end) {
    if(o.settledAt<start) opening+=o.amount;
    else {totals.set(o.settledAt,(totals.get(o.settledAt)||0)+o.amount); count++;}
  }
  const cents=dates.map(d=>totals.get(d)||0);
  let running=opening;
  const cumulative=cents.map(value=>running+=value);
  return {dates,cents,cumulative,opening,closing:running,count,total:cents.reduce((n,v)=>n+v,0),missing:eligible.filter(o=>!o.settledAt||!validDate(o.settledAt)).length};
}
