import {App} from 'antd';
import type {MarketRequest} from '../../../shared/market';
import {sourcePlatform} from '../../../shared/steamdt';
import {openMarket} from '../market-link';
export function QuoteSource({source,updated,request}:{source?:string;updated?:string;request:MarketRequest}){
 const {message}=App.useApp();const platform=sourcePlatform(source);
 const open=async(p?:string)=>{try{message.info(await openMarket({...request,platform:p}));}catch(e){message.error((e as Error).message);}};
 return <span className="quote-source">{source?.startsWith('SteamDT')?<><button className="text-link" onClick={()=>open()}>SteamDT</button>{platform&&<> · <button className="text-link" onClick={()=>open(platform)}>{platform}</button></>}{source.includes('款式收盘')&&' · 款式收盘参考'}</>:source||'尚未获取报价'}{updated&&<> · {new Date(updated).toLocaleString('zh-CN')}</>}</span>;
}
