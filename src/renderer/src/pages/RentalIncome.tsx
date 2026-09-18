import { useState } from 'react';
import { Alert, Input, Segmented } from 'antd';
import { Panel, TrendChart } from '../components';
import { money, type Order } from '../model';
import { rentalRange, rentalRanges, rentalSeries } from '../rental-chart';
export function RentalIncome({orders,dark}:{orders:Order[];dark:boolean}) {
  const today=new Date().toLocaleDateString('sv-SE');
  const [preset,setPreset]=useState('1月');
  const [start,setStart]=useState(rentalRange('1月',today)[0]); const [end,setEnd]=useState(today);
  const range=preset==='自定义'?[start,end]:rentalRange(preset,today);
  let result: ReturnType<typeof rentalSeries>|undefined, error='';
  try {result=rentalSeries(orders,range[0],range[1]);}catch(e){error=(e as Error).message;}
  return <Panel title="租赁收入" className="rental-income-panel" extra={<Segmented aria-label="租赁收入时间跨度" value={preset} onChange={v=>setPreset(String(v))} options={rentalRanges} />}>
    {preset==='自定义' && <div className="rental-custom"><label>开始日期<Input aria-label="租金开始日期" type="date" value={start} max={end||today} onChange={e=>setStart(e.target.value)} /></label><span>至</span><label>结束日期<Input aria-label="租金结束日期" type="date" value={end} min={start} max={today} onChange={e=>setEnd(e.target.value)} /></label></div>}
    {error?<Alert type="warning" title={error}/>:result && <>
      <div className="rental-summary"><div><span>期间净租金</span><strong data-testid="rental-total">{money(result.total)}</strong></div><div>{result.count} 笔已完成结算<span>{range[0]} — {range[1]}</span></div><small>按结算完成日期归集 · 人民币元<br/>未结算订单不计入，无收入日期显示零</small></div>
      {!!result.missing && <Alert type="info" title={`${result.missing} 笔已完成租赁缺少结算日期，暂不进入本图；可到订单详情补充。`} />}
      <h3 className="rental-chart-title">每日租赁收入</h3>
      <TrendChart dark={dark} dates={result.dates} series={[{name:'每日净租金',color:'#36a995',data:result.cents.map(c=>c/100)}]} />
      <section className="rental-cumulative" aria-label="累计租赁收入">
        <h3 className="rental-chart-title">累计租赁收入</h3>
        <div className="rental-summary"><div><span>截至 {range[1]} 累计净租金</span><strong data-testid="rental-cumulative-total">{money(result.closing)}</strong></div><div><span>期初累计</span><b data-testid="rental-opening">{money(result.opening)}</b></div><small>含所选区间之前已结清的净租金<br/>无收入日期保持前一天累计值</small></div>
        <TrendChart dark={dark} dates={result.dates} series={[{name:'累计净租金',color:'#8395ff',data:result.cumulative.map(c=>c/100)}]} />
      </section>
    </>}
  </Panel>;
}
