import {ItemArt} from '../components';
import {useEffect,useRef,useState} from 'react';
import {App,Button,Select} from 'antd';
import type {CatalogSkin} from '../../../shared/catalog';
import type {CollectionQuote} from '../../../shared/market';
import {QuoteSource} from './QuoteSource';
import {orderedWears,styleLabel,compareStyles} from '../../../shared/presentation';
import {money} from '../model';
import {openMarket} from '../market-link';

export function CollectionPrice({skin,members,ownedIds,active,revision}:{skin:CatalogSkin;members:CatalogSkin[];ownedIds:string[];active:boolean;revision:string}){
  const [wear,setWear]=useState(()=>orderedWears(skin.wears)[0]);
  const [version,setVersion]=useState('普通');const [tick,setTick]=useState(0);
  const [visible,setVisible]=useState(false);const ref=useRef<HTMLDivElement>(null);
  const [result,setResult]=useState<{key:string;data:CollectionQuote}>();const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);const {message}=App.useApp();
  const key=[skin.id,wear,version,revision,tick].join('|');const quote=result?.key===key?result.data:undefined;
  const styles=members.filter(s=>s.phase).sort((a,b)=>compareStyles(a.phase,b.phase));
  useEffect(()=>{const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{rootMargin:'120px'});if(ref.current)observer.observe(ref.current);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    if(!active||!visible)return;let current=true;setError('');
    if(!window.desktop?.collectionQuote){setError('请在桌面应用中获取实时参考价');return;}
    setBusy(true);
    window.desktop.collectionQuote({skinId:skin.id,wear,version,refresh:tick>0}).then(data=>{if(current)setResult({key,data});})
      .catch(()=>{if(current)setError('报价暂时无法获取，请稍后重试');}).finally(()=>{if(current)setBusy(false);});
    return()=>{current=false;};
  },[key,active,visible]);
  async function open(s:CatalogSkin){try{message.info(await openMarket({skinId:s.id,wear,version}));}catch(e){message.error((e as Error).message);}}
  const status=error||(!quote?(busy?'获取中…':'报价待获取'):quote.value===undefined?'报价待获取':money(quote.value));
  return <div ref={ref} className="collection-price" data-testid={`quote-${skin.id}`}>
    <div className="collection-price-bar"><span className="muted">SteamDT · {styles.length?'款式收盘参考价最低值':'当前最低在售价'}</span><strong data-testid="quote-minimum" className={quote?.value===undefined?'muted':'money'}>{status}</strong>
      <Select aria-label={`${skin.name}报价磨损`} value={wear} onChange={setWear} options={orderedWears(skin.wears).map(value=>({value}))}/>
      {(skin.stattrak||skin.souvenir)&&<Select aria-label={`${skin.name}报价版本`} value={version} onChange={setVersion} options={[{value:'普通',label:styles.length?'非 StatTrak™':'普通'},...(skin.stattrak?[{value:'StatTrak™'}]:[]),...(skin.souvenir?[{value:'纪念品'}]:[])]}/>}
      <Button size="small" disabled={!active||busy} onClick={()=>setTick(n=>n+1)}>刷新报价</Button>
    </div>
    {styles.length>0?<><div className="collection-style-prices" aria-label="多普勒款式报价">{styles.map(s=>{const p=quote?.entries.find(e=>e.skinId===s.id);const owned=ownedIds.includes(s.id);return <button onClick={()=>open(s)} key={s.id} className={`style-price ${owned?'owned-style':''}`} title={`${owned?'已拥有':'未拥有'} · ${wear} · ${p?.source||p?.error||'点击前往 SteamDT 核实'}${p?.updated?' · '+new Date(p.updated).toLocaleString('zh-CN'):''}`}><div className="style-thumb"><ItemArt src={s.image} name=""/></div><span className={owned?'phase owned-phase':'phase'}>{styleLabel(s.phase)}{owned?' ✓':''}</span><b>{p?.ok&&p.value!==undefined?money(p.value):busy?'获取中…':'报价待获取'} ↗</b><small>{p?.updated?new Date(p.updated).toLocaleString('zh-CN'):'日期待获取'}</small></button>;})}</div>
      <small className="muted">多普勒款式 · {wear} · 最新收盘参考价，不代表当前在售价；主行取已取得款式参考价的最低值{quote&&!quote.complete?'；部分或全部款式缺价，尚不能确认全款式最低价':''}。{quote?.entries.some(e=>!e.ok)?quote.entries.find(e=>!e.ok)?.error||'部分款式暂未取得参考价。':''}</small></>:
      <small className="muted">{quote?.entries[0]?.source?<QuoteSource source={quote.entries[0].source} updated={quote.entries[0].updated} request={{skinId:skin.id,wear,version}}/>:quote?.entries[0]?.error||'默认选择此皮肤支持的最低磨损等级，可切换其他外观。'}</small>}
  </div>;
}
