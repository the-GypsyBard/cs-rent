import type { MarketRequest } from '../../shared/market';
export async function openMarket(request:MarketRequest) {
  if(!window.desktop?.openMarket)throw Error('请在桌面应用中打开饰品详情');
  const result=await window.desktop.openMarket(request);
  if(!result.ok)throw Error(result.error||'无法打开详情');
  return result.fallback?'未取得所选平台的可靠详情链接，已打开 SteamDT 查看':`已在浏览器打开 ${result.target} 详情`;
}
