import {styleLabel} from '../../../shared/presentation';
import {Form,Input,AutoComplete} from 'antd';
import type {CatalogSkin} from '../../../shared/catalog';
import {floatBounds,specialFields} from '../../../shared/market';
export function AssetAttributes({skin,wear}:{skin?:CatalogSkin;wear?:string}){
  if(!skin)return null;const f=specialFields(skin),range=floatBounds(skin,wear);
  return <div className="special-targets"><h3>饰品实际属性 <small>选填</small></h3>
    {f.float&&<Form.Item name="float" label="实际磨损" extra={`合法范围 ${range.min}–${range.max}${range.maxExclusive?'（不含上界）':''}；支持精细小数，保留输入精度。`}><Input inputMode="decimal" placeholder="例如 0.00001234"/></Form.Item>}
    {f.template&&<Form.Item name="template" label="图案模板"><Input inputMode="numeric" placeholder="0–1000" maxLength={4}/></Form.Item>}
    {f.fade&&<Form.Item name="fade" label="渐变率（%）"><Input inputMode="decimal" placeholder="例如 98.56"/></Form.Item>}
    {f.style&&<Form.Item name="style" label={skin.phase?'多普勒款式':'特殊款式'}><AutoComplete options={f.styles.map(value=>({value:styleLabel(value)}))} placeholder="例如红宝石、P1、特殊图案；款式应与所选商品一致"><Input maxLength={80}/></AutoComplete></Form.Item>}
    {!f.float&&!f.template&&!f.fade&&!f.style&&<p className="muted">此饰品没有需要填写的磨损或特殊涂装属性。</p>}
  </div>;
}
