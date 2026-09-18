import {CollectionPrice} from './CollectionPrice';
import {matchesSearch} from '../../../shared/presentation';
import { useEffect,useRef,useMemo, useState } from 'react';
import { App,Alert,Button,Input,Select,Progress,Tag,Segmented,Modal } from 'antd';
import { ReloadOutlined,SearchOutlined,CheckCircleFilled,MinusCircleOutlined,GiftOutlined,ExpandOutlined } from '@ant-design/icons';
import {useCatalog} from '../catalog-store';
import {finishMembers,type CatalogGroup,type CatalogSkin} from '../../../shared/catalog';
import {availabilityLabel,latestAvailability} from '../../../shared/availability';
import {useStore} from '../store';
import {bestWear,type Asset} from '../model';
import {collectionCounts,heldFor} from '../collection-metrics';
import {openMarket} from '../market-link';
import {PageHead,Panel,ItemArt,EmptyState} from '../components';
type Category='gun'|'knife'|'glove'|'armory';
export function Collection({active=true,target}:{active?:boolean;target?:{skinId:string;nonce:number}}){
  const {state}=useStore();const {message}=App.useApp();
  const {snapshot,refresh,busy,error,notice,ready}=useCatalog();
  const [kind,setKind]=useState<Category>('gun');const [selected,setSelected]=useState('');
  const [query,setQuery]=useState('');const [groupQuery,setGroupQuery]=useState('');const [filter,setFilter]=useState('全部款式');
  const [subtype,setSubtype]=useState('全部');const [direction,setDirection]=useState('desc');const [expanded,setExpanded]=useState(false);
  const [opening,setOpening]=useState('');
  const [catalogQuery,setCatalogQuery]=useState('');
  const [focused,setFocused]=useState('');const applied=useRef(0);
  useEffect(()=>{
    if(!active||!target||!ready||applied.current===target.nonce)return;
    const group=snapshot.groups.find(g=>g.members.some(s=>s.id===target.skinId));
    if(!group){message.warning('收藏目录尚未收录此饰品，请刷新目录');applied.current=target.nonce;return;}
    const member=finishMembers(group).find(s=>s.ids.includes(target.skinId));
    setKind(group.armory?'armory':group.kind);setSubtype('全部');setGroupQuery('');setCatalogQuery('');setSelected(group.id);setQuery('');setFilter('全部款式');setExpanded(false);setFocused(member?.id||'');applied.current=target.nonce;
  },[target,active,ready,snapshot]);
  useEffect(()=>{if(!active||!focused)return;const id=requestAnimationFrame(()=>document.getElementById('collection-finish-'+focused)?.scrollIntoView({block:'center'}));return()=>cancelAnimationFrame(id);},[focused,selected,active,target]);
  const searchResults=useMemo(()=>{
    const q=catalogQuery.trim().toLowerCase();if(!q)return [];
    return snapshot.groups.flatMap(group=>finishMembers(group).filter(s=>matchesSearch(`${s.name} ${s.english} ${s.phases.join(' ')} ${group.name}`,q)).map(s=>({group,skin:s})));
  },[snapshot,catalogQuery]);
  const groups=useMemo(()=>snapshot.groups.filter(c=>(kind==='armory'?c.armory:c.kind===kind&&c.type!=='限定物品')&&
    (!['gun','armory'].includes(kind)||subtype==='全部'||c.type===subtype)).sort((a,b)=>{
      if(!a.releaseDate||!b.releaseDate)return a.releaseDate?-1:b.releaseDate?1:0;
      return (direction==='desc'?-1:1)*a.releaseDate.localeCompare(b.releaseDate)||a.name.localeCompare(b.name,'zh-CN');
    }),[snapshot,kind,subtype,direction]);
  const collection=groups.find(c=>c.id===selected)||groups[0];const gun=collection?.kind==='gun';
  const members=useMemo(()=>collection?finishMembers(collection):[],[collection]);
  const held=useMemo(()=>state.assets.filter(a=>a.kind==='饰品'&&a.status==='持有中'),[state.assets]);
  const counts=useMemo(()=>new Map(snapshot.groups.map(c=>[c.id,collectionCounts(c,held)])),[snapshot,held]);
  const owned=(ids:string[],version?:string)=>heldFor(held,ids,version);
  const count=collection?counts.get(collection.id)!:{normal:0,st:0,stTotal:0,total:0,any:0};
  const shown=members.filter(m=>matchesSearch(`${m.name} ${m.english} ${m.phases.join(' ')}`,query)&&(filter==='全部款式'||(filter==='已拥有')===!!owned(m.ids).length));
  const groupList=groups.filter(c=>matchesSearch(c.name,groupQuery));
  function changeKind(v:Category){setKind(v);setSelected('');setSubtype('全部');setGroupQuery('');setQuery('');setFilter('全部款式');}
  function choose(c:CatalogGroup){setSelected(c.id);setQuery('');setFilter('全部款式');setExpanded(false);}
  async function openSkin(s:CatalogSkin,ids:string[]){
    if(opening)return;setOpening(s.id);
    const a=owned(ids)[0];const actual=collection?.members.find(m=>m.id===a?.skinId)||s;
    try{message.info(await openMarket({skinId:actual.id,wear:a&&actual.wears.includes(a.wear)?a.wear:actual.wears[0],version:a?.version||'普通'}));}catch(e){message.error((e as Error).message);}finally{setOpening('');}
  }
  const ownership=(assets:Asset[])=>assets.length?<><span className="positive"><CheckCircleFilled aria-hidden="true"/> 已拥有</span><small>{bestWear(assets)}{assets.some(a=>a.wear==='待确认')?' · 等级不完整':''}</small></>:<span className="unowned"><MinusCircleOutlined aria-hidden="true"/> 未拥有</span>;
  const groupCard=(c:CatalogGroup)=><button className={`collection-nav ${collection?.id===c.id?'selected':''}`} key={c.id} onClick={()=>choose(c)}>
    <ItemArt src={c.image} name=""/><div><b>{c.name}</b><small>{c.type} · {counts.get(c.id)!.total} 款 · 已拥有 {counts.get(c.id)!.any} 款</small><small>发行：{c.releaseDate||'时间待核实'}</small>
    {c.kind==='gun'&&<small className={latestAvailability(c).some(e=>e.status==='active')?'positive':'muted'}>{availabilityLabel(c)}</small>}</div></button>;
  return <>
    <PageHead eyebrow="THE COLLECTION ROOM" title="收藏室" description="收集喜爱的每款涂装，记录属于你的收藏进度。" actions={<><Button loading={busy} disabled={!ready} icon={<ReloadOutlined aria-hidden="true"/>} onClick={()=>refresh()}>刷新目录</Button><Button loading={busy} disabled={!ready} onClick={()=>refresh(true)}>同步投放状态</Button></>}/>
    <div className="catalog-global-search"><Input aria-label="搜索全部收藏饰品" placeholder="搜索全部饰品：名称、英文名或多普勒款式" value={catalogQuery} onChange={e=>setCatalogQuery(e.target.value)} prefix={<SearchOutlined/>} allowClear/>
      {catalogQuery.trim()&&<div className="catalog-search-results"><p>找到 {searchResults.length} 项{searchResults.length>120?'，显示前 120 项，可继续输入缩小范围':''} · 点击定位所属收藏</p>{searchResults.slice(0,120).map(({group,skin})=><button key={`${group.id}:${skin.id}`} className="catalog-search-item" onClick={()=>{setKind(group.armory?'armory':group.kind);setSubtype('全部');setGroupQuery('');setSelected(group.id);setFilter('全部款式');setQuery(skin.name);setCatalogQuery('');}}><ItemArt src={skin.image} name={skin.name}/><span><b>{skin.name}</b><small>{group.name} · {group.type}</small></span><span className={owned(skin.ids).length?'positive':'muted'}>{owned(skin.ids).length?'已拥有':'未拥有'}</span></button>)}{!searchResults.length&&<p className="muted">没有匹配的饰品，可调整关键词或刷新目录。</p>}</div>}
    </div>
    <div className="catalog-categories"><Segmented aria-label="收藏类别" value={kind} onChange={v=>changeKind(v as Category)} options={[{value:'gun',label:'枪械收藏品'},{value:'armory',label:'武库通行证'},{value:'knife',label:'刀具 · 按刀型'},{value:'glove',label:'手套 · 按代数'}]}/><span className="muted">{snapshot.groups.filter(g=>g.kind==='gun').length} 组收藏品 · {snapshot.groups.filter(g=>g.kind==='knife').length} 种刀型 · {snapshot.groups.filter(g=>g.kind==='glove').length} 组手套</span></div>
    {(error||notice)&&<Alert className="catalog-feedback" showIcon type={error?'warning':'success'} title={error||notice}/>}
    <div className="collection-controls">
      {['gun','armory'].includes(kind)&&<Segmented aria-label="收藏目录类型" value={subtype} onChange={v=>setSubtype(String(v))} options={['全部','武器箱','收藏品',...(kind==='armory'?['限定物品']:[])]}/>}
      <Select aria-label="发行时间排序" value={direction} onChange={setDirection} options={[{value:'desc',label:'发行时间 · 从新到旧'},{value:'asc',label:'发行时间 · 从旧到新'}]}/>
      <Button icon={<ExpandOutlined aria-hidden="true"/>} onClick={()=>setExpanded(true)}>放大选择收藏品</Button>
    </div>
    <div className="collection-layout"><aside className="collection-sidebar">
      <div className="nav-label">收藏目录 · {groups.length} 组</div>
      <Input aria-label="搜索收藏分组" placeholder="查找分组" value={groupQuery} onChange={e=>setGroupQuery(e.target.value)} allowClear prefix={<SearchOutlined/>}/>
      <div className="catalog-group-list">{groupList.map(groupCard)}{!groupList.length&&<p className="muted">没有匹配的分组</p>}</div>
      <div className="catalog-note"><b>目录保存在本机</b><p>刷新会同步新收藏品、刀型、手套和武库投放状态。停投不代表永久绝版，官方返场后可重新标记为可获取。</p><small>目录更新：{new Date(snapshot.updatedAt).toLocaleString('zh-CN')}<br/>投放核实：{snapshot.availabilityCheckedAt?new Date(snapshot.availabilityCheckedAt).toLocaleString('zh-CN'):'待刷新'}<br/>来源版本：{snapshot.revision.slice(0,8)}</small></div>
    </aside>
    {collection?<div className="collection-main">
      <div className="collection-banner"><ItemArt src={collection.image} name={collection.name} large/><div><div className="eyebrow">{kind==='armory'?'THE ARMORY':'YOUR COLLECTION'}</div><h2>{collection.name}</h2><p data-testid="collection-any-count">{members.length} 款 · 已拥有 {count.any} 款</p><small>发行：{collection.releaseDate||'时间待核实'} · 任一版本拥有即计入，同款只计一次</small></div><Tag className="push-right">{collection.type}</Tag></div>
      {gun&&<div className="availability-box">{collection.type==='限定物品'&&<p>收录历代限定物品。分组“可获取”表示至少有一款仍可兑换，各历史饰品以官方当期兑换目录为准。</p>}<b>{availabilityLabel(collection)}</b><p>按官方投放渠道记录。退出某一渠道不代表其他渠道也已关闭，市场交易、存量开箱与炼金不作为官方投放依据。</p>
        {!!collection.availability?.length&&<details><summary>查看投放历史与依据</summary>{collection.availability.map((e,i)=><div className="availability-event" key={i}><b>{e.channel} · {e.status==='active'?'可获取':e.status==='retired'?'已停止投放':'待核实'} · {e.date||'确切变更日期待核实'}</b><small>{e.source}</small></div>)}</details>}
      </div>}
      {collection.pendingGeneration&&<Alert className="catalog-feedback" showIcon type="info" title="此系列已自动收录；代数暂无可靠映射，先按来源分组展示。"/>}
      <div className={`collection-progress ${!gun?'unified-progress':''}`}><div><span>{gun?'普通版':'涂装收藏进度'} <strong data-testid="collection-count">{gun?count.normal:count.any}<em> / {members.length}</em></strong></span><Progress percent={members.length?Math.round((gun?count.normal:count.any)/members.length*100):0} showInfo={false} strokeColor="#6679e8"/><small>{gun?'普通版独立进度；纪念品计入上方拥有总数。':'普通版或计数版拥有任一即计入，多普勒款式合并为同一涂装。'}</small></div>
      {gun&&<div><span>StatTrak™ <strong>{count.stTotal?count.st:'不适用'}{count.stTotal>0&&<em> / {count.stTotal}</em>}</strong></span><Progress percent={count.stTotal?Math.round(count.st/count.stTotal*100):0} showInfo={false} strokeColor="#d2a366"/><small>按支持该版本的款式计算</small></div>}</div>
      <Panel className={`collection-table-panel ${!gun?'rare-collection-table':''}`}><div className="table-toolbar"><Input aria-label="搜索收藏款式" prefix={<SearchOutlined/>} placeholder="搜索这组收藏" value={query} onChange={e=>setQuery(e.target.value)} allowClear style={{width:230}}/><Select aria-label="收藏拥有筛选" value={filter} onChange={setFilter} options={['全部款式','已拥有','未拥有'].map(value=>({value}))}/><span className="push-right muted">出租中仍计为拥有</span></div>
      <div className="collection-table-head"><span>款式 · 点击打开 SteamDT</span><span>{gun?'普通版':'拥有情况'}</span>{gun&&<span>StatTrak™</span>}</div>
      {shown.length?shown.map(m=>{const n=owned(m.ids,'普通'),st=owned(m.ids,'StatTrak™'),souv=owned(m.ids,'纪念品');return <div id={'collection-finish-'+m.id} data-testid={`finish-${m.id}`} className={`collection-skin ${owned(m.ids).length?'owned':''} ${focused===m.id?'focused-finish':''}`} key={m.id}>
        <div className="collection-identity"><button className="collection-item-link" onClick={()=>openSkin(m,m.ids)} disabled={!!opening} title="打开 SteamDT；优先使用所持有版本与磨损，没有持有时使用普通版首个适用磨损"><ItemArt src={m.image} name={m.name} rarity={m.rarity}/></button><div>
          <button className="collection-item-link" onClick={()=>openSkin(m,m.ids)} disabled={!!opening}><b style={{color:`color-mix(in srgb, ${m.rarity} 62%, var(--text))`}}>{m.name} ↗</b></button><small>{m.english}</small>
          {collection.type==='限定物品'&&<small className="muted">{availabilityLabel({availability:m.availability} as CatalogGroup)}</small>}{gun&&souv.length>0&&<span className="souvenir"><GiftOutlined/> 拥有纪念品 · {bestWear(souv)}</span>}
        </div></div><div className="ownership">{ownership(gun?n:[...n,...st])}{collection.kind==='knife'&&st.length>0&&<span className="owned-stattrak">拥有 StatTrak™ · {bestWear(st)}</span>}</div>{gun&&<div className="ownership">{m.stattrak?ownership(st):<span className="unowned">不支持</span>}</div>}
        <CollectionPrice skin={m} members={collection.members.filter(s=>m.ids.includes(s.id))} ownedIds={owned(m.ids).map(a=>a.skinId)} active={active} revision={snapshot.revision}/>
      </div>}):<EmptyState title="没有符合条件的收藏款式" description="尝试调整搜索词或拥有筛选。"/>}</Panel>
      {gun&&collection.type==='武器箱'&&<div className="rare-entry"><span>★</span><div><b>稀有特殊物品</b><p>刀具和手套在各自目录中计算。</p></div><Button onClick={()=>changeKind('knife')}>查看刀具</Button><Button onClick={()=>changeKind('glove')}>查看手套</Button></div>}
      <p className="source-note">目录来源：{collection.source}。图片按需加载。拥有情况来自本机原型资产，出售或赠出后即时重算。</p>
    </div>:<EmptyState title="该类别暂无目录" description="可尝试刷新目录。"/>}</div>
    <Modal title="选择目标收藏品" open={expanded} onCancel={()=>setExpanded(false)} footer={null} width="92vw"><div className="expanded-catalog-controls"><Input aria-label="放大目录搜索" placeholder="搜索收藏品或武器箱" value={groupQuery} onChange={e=>setGroupQuery(e.target.value)} allowClear/>{['gun','armory'].includes(kind)&&<Segmented value={subtype} onChange={v=>setSubtype(String(v))} options={['全部','武器箱','收藏品',...(kind==='armory'?['限定物品']:[])]}/>}<Select aria-label="放大目录排序" value={direction} onChange={setDirection} options={[{value:'desc',label:'从新到旧'},{value:'asc',label:'从旧到新'}]}/></div><div className="expanded-catalog">{groupList.map(groupCard)}</div>{!groupList.length&&<EmptyState title="没有匹配的收藏品"/>}</Modal>
  </>;
}
