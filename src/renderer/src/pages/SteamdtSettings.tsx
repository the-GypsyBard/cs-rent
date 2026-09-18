import {useEffect,useState} from 'react';
import {App,Button,Input,Tag} from 'antd';
import {Panel} from '../components';
type Status={configured:boolean;encryptionAvailable:boolean;count:number;updatedAt?:string;error?:string};
export function SteamdtSettings(){
 const [key,setKey]=useState(''),[status,setStatus]=useState<Status>(),[busy,setBusy]=useState(false);const {message}=App.useApp();
 const reload=async()=>setStatus(await window.desktop?.steamdt.status());
 useEffect(()=>{reload().catch(()=>{});},[]);
 async function run(action:'save'|'clear'|'test'|'syncBase'){
  if(!window.desktop?.steamdt){message.warning('请在桌面应用中配置');return;}setBusy(true);
  try{if(action==='save'){await window.desktop.steamdt.save(key);setKey('');message.success('API_KEY 已加密保存');}
   else if(action==='clear'){await window.desktop.steamdt.clear();message.success('已移除本机密钥');}
   else if(action==='test'){await window.desktop.steamdt.test();message.success('SteamDT 官方价格 API 连接成功');}
   else{const r=await window.desktop.steamdt.syncBase();message.success(`基础信息已缓存：${r.count} 个商品`);}
  }catch(e){message.error((e as Error).message.replace(/^Error invoking remote method '[^']+': Error: /,''));}finally{setBusy(false);await reload();}
 }
 return <Panel title="SteamDT 官方 API"><p>用于收藏室报价、库存估值及平台详情链接。密钥由 Windows 加密保存在本机，不包含在账本备份或安装包中；换电脑后重新配置。</p>
  <Tag color={status?.configured?'green':'default'}>{status?.configured?'已配置密钥':'尚未配置密钥'}</Tag>
  <div className="api-key-controls"><Input.Password aria-label="SteamDT API_KEY" placeholder="输入新的 API_KEY；已保存的密钥不会回显" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)}/><Button disabled={!key.trim()||busy} onClick={()=>run('save')}>保存密钥</Button></div>
  <div className="api-actions"><Button disabled={!status?.configured||busy} onClick={()=>run('test')}>测试 API 连接</Button><Button disabled={!status?.configured||busy} onClick={()=>run('syncBase')}>同步商品基础信息</Button><Button disabled={!status?.configured||busy} onClick={()=>run('clear')}>移除密钥</Button></div>
  <p className="muted">基础信息每天最多请求一次；最新缓存：{status?.updatedAt?new Date(status.updatedAt).toLocaleString('zh-CN'):'尚未取得'}{status?.count?` · ${status.count} 个商品`:''}。报价使用缓存并限制请求频率。</p>{status?.error&&<p className="warning-text">{status.error}</p>}
 </Panel>;
}
