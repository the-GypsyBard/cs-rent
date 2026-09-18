import {SteamdtSettings} from './SteamdtSettings';
import {useRef,useState} from 'react';
import {App,Button,Modal,Switch,Alert,Descriptions} from 'antd';
import {SunOutlined,MoonOutlined,DownloadOutlined,UploadOutlined,ReloadOutlined,CheckOutlined,FolderOpenOutlined} from '@ant-design/icons';
import {useStore,downloadJson} from '../store';
import {useCatalog} from '../catalog-store';
import {parseBackup,type WorkspaceData} from '../../../shared/user-data';
import {PageHead,Panel,Pill} from '../components';
type ImportSummary={assets:number;orders:number;wishes:number;theme:string;catalogGroups:number;version:number};
export function Settings({dark,setDark}:{dark:boolean;setDark:(value:boolean)=>void}){
  const {state,settings,setSettings,space,reset,flush,dataPath,readError}=useStore();
  const {snapshot}=useCatalog(),{message,modal}=App.useApp();
  const input=useRef<HTMLInputElement>(null);
  const [summary,setSummary]=useState<ImportSummary|null>(null);
  const [webBackup,setWebBackup]=useState<WorkspaceData|null>(null);
  const [busy,setBusy]=useState(false);
  const backup=():WorkspaceData=>({format:'cs-rent-user-data',schemaVersion:2,appVersion:'0.8.0',exportedAt:new Date().toISOString(),space,state,settings,catalog:snapshot});
  async function exportData(){setBusy(true);try{await flush();if(window.desktop?.data){const result=await window.desktop.data.export();if(result.ok)message.success('完整备份已导出，可在另一台电脑导入');}else downloadJson(backup(),'CS饰品平台-完整备份.json');}catch(e){message.error((e as Error).message||'导出失败');}finally{setBusy(false);}}
  async function choose(){setBusy(true);try{if(window.desktop?.data){const result=await window.desktop.data.chooseImport();if(result.summary)setSummary(result.summary);}else input.current?.click();}catch{message.error('备份格式、版本或记录关联不正确；当前数据未修改。');}finally{setBusy(false);}}
  async function readWeb(file?:File){if(!file)return;try{if(file.size>100_000_000)throw Error();const data=parseBackup(JSON.parse(await file.text()),{settings,catalog:snapshot});setWebBackup(data);setSummary({assets:data.state.assets.length,orders:data.state.orders.length,wishes:data.state.wishes.length,theme:data.settings.theme,catalogGroups:data.catalog.groups.length,version:data.schemaVersion});}catch{message.error('备份校验失败，当前数据未修改');}finally{if(input.current)input.current.value='';}}
  async function restore(){setBusy(true);try{if(!readError)await flush();if(window.desktop?.data)await window.desktop.data.restore();else if(webBackup){downloadJson(backup(),'恢复前完整备份.json');localStorage.setItem('cs-rent-user-data-v2',JSON.stringify(webBackup));}window.location.reload();}catch(e){message.error('恢复失败，当前文件未被替换：'+(e as Error).message);setBusy(false);}}
  function resetState(empty=false){modal.confirm({title:empty?'清空当前账本？':'载入标准演示账本？',content:'将替换当前资产、订单和愿望单。请先导出完整备份；个人设置保留。',okText:empty?'清空账本':'载入示例',cancelText:'取消',onOk:()=>{reset(empty);message.success(empty?'已切换空账本':'已载入示例账本');}});}
  return <>
    <PageHead eyebrow="WORKSPACE PREFERENCES" title="设置" description="管理阅读偏好、独立用户数据与完整备份。"/>
    <div className="settings-grid"><div>
      <Panel title="外观与阅读"><p className="section-description">深浅主题与文字大小自动保存，并包含在完整备份中。</p>
        <div className="theme-choices">
          {[false,true].map(value=><button key={String(value)} aria-label={value?'使用深色主题':'使用浅色主题'} className={dark===value?'selected':''} onClick={()=>setDark(value)}>
            <div className={'theme-preview '+(value?'dark':'light')}><span/><div><i/><i/><i/></div></div><b>{value?<MoonOutlined/>:<SunOutlined/>} {value?'深色':'浅色'}{dark===value&&<CheckOutlined/>}</b><small>{value?'柔和底色，减少大面积高亮':'清晰明亮，适合日间使用'}</small>
          </button>)}
        </div>
        <div className="setting-row"><div><b>放大文字</b><p>全局放大 8%，迁移后仍保留此选择。</p></div><Switch aria-label="放大文字" checked={settings.largeText} onChange={largeText=>setSettings({largeText})}/></div>
      </Panel>
      <SteamdtSettings/><Panel title="用户数据与迁移"><Alert type="info" showIcon title="程序与用户数据分开保存" description="完整备份包含资产、订单、愿望单、饰品属性、估值、公共收支子项及历史、个人设置和收藏目录；兼容旧版原型快照。安装包不包含这些个人记录。"/>
        <div className="setting-row"><div><b>导出完整备份</b><p>到另一台电脑安装程序后，导入此文件即可迁移；不依赖原安装路径。</p></div><Button icon={<DownloadOutlined/>} onClick={exportData} loading={busy}>导出完整备份</Button></div>
        <div className="setting-row"><div><b>导入完整备份</b><p>先校验版本、金额与关联，再预览。恢复前自动保存当前数据副本。</p></div><Button icon={<UploadOutlined/>} onClick={choose} disabled={busy}>选择备份文件</Button><input hidden ref={input} type="file" accept=".json" onChange={e=>readWeb(e.target.files?.[0])}/></div>
        <div className="setting-row"><div><b>用户数据位置</b><p className="data-path">{dataPath}</p><small>不要把此目录放入安装包；恢复前备份也保存在这里。</small></div>{window.desktop&&<Button icon={<FolderOpenOutlined/>} onClick={()=>window.desktop?.data.openDirectory()}>打开数据目录</Button>}</div>
      </Panel>
      <Panel title="验收场景"><div className="setting-row"><div><b>标准示例账本</b><p>载入演示资产与订单，用于验证交互。</p></div><Button icon={<ReloadOutlined/>} onClick={()=>resetState()}>恢复示例</Button></div><div className="setting-row"><div><b>空账本</b><p>全新安装默认从空账本开始。</p></div><Button onClick={()=>resetState(true)}>清空账本</Button></div></Panel>
    </div><div>
      <Panel title="当前交付状态"><div className="delivery-status"><Pill tone="blue">交互验收</Pill><h3>CS 饰品平台</h3><p>v0.8.0 · Windows 桌面原型</p></div>
        <div className="capability-list">{['独立用户数据与完整备份迁移','全目录饰品搜索、实际特殊属性','自动基础估值与手动覆盖','公共收支子项和逐笔调整记录'].map(s=><div key={s}><CheckOutlined/><span>{s}</span></div>)}</div>
        <div className="pending-features"><b>后续实施与验证</b><p>真实平台订单采集、正式 SQLite、精确年化、Excel 导入与完整安装升级测试仍待后续实施。特殊属性溢价未自动定价。</p></div>
      </Panel>
      <Panel title="迁移步骤"><ol className="acceptance-steps"><li>在旧电脑导出完整备份。</li><li>在新电脑安装通用运行包。</li><li>选择备份，核对记录数量并确认恢复。</li><li>核对资产、子项、属性和主题。</li></ol><p className="section-description">当前未接入平台登录。未来登录会话与密钥应在新机器重新配置，不应混入通用安装包。</p></Panel>
    </div></div>
    <Modal title="预览用户数据备份" open={!!summary} onCancel={()=>setSummary(null)} onOk={restore} confirmLoading={busy} okText="确认恢复备份" cancelText="取消">{summary&&<><Alert type="warning" title="确认后替换当前账本及个人设置；恢复前将自动保存当前数据副本。"/><Descriptions column={1} style={{marginTop:20}} items={[{key:'a',label:'资产与公共收支',children:summary.assets},{key:'o',label:'订单',children:summary.orders},{key:'w',label:'愿望单',children:summary.wishes},{key:'c',label:'目录分组',children:summary.catalogGroups},{key:'t',label:'主题',children:summary.theme==='dark'?'深色':'浅色'},{key:'v',label:'备份版本',children:summary.version}]}/></>}</Modal>
  </>;
}

