import {useState} from 'react';
import {App,Button,Form,Input,InputNumber,Select,Table,Modal,Descriptions} from 'antd';
import {useStore} from '../store';
import {money,publicAmounts,type Asset,type PublicSubitem} from '../model';
import {updatePublicSubitem} from '../../../shared/asset-rules';
import {validDate} from '../rental-chart';
export function PublicSubitems({asset}:{asset:Asset}){
  const {setState}=useStore(),{message}=App.useApp();const [form]=Form.useForm();
  const [opened,setOpened]=useState(false),[editing,setEditing]=useState<PublicSubitem|null>(null);
  const [history,setHistory]=useState<PublicSubitem|null>(null);const mode=Form.useWatch('mode',form),amount=Form.useWatch('amount',form);
  const total=publicAmounts(asset);
  function open(item:PublicSubitem|null){setEditing(item);form.resetFields();form.setFieldsValue({name:item?.name||'',direction:item?.direction||'支出',mode:item?'增加':'设置',amount:item?undefined:0,date:new Date().toLocaleDateString('sv-SE'),note:''});setOpened(true);}
  async function save(){const v=await form.validateFields();if(!validDate(v.date)||v.date>new Date().toLocaleDateString('sv-SE')){message.error('请输入有效的记账日期，不能晚于今天');return;}
    try{const input={...v,id:editing?.id,amount:Math.round(v.amount*100)};updatePublicSubitem(asset,input);setState(s=>({...s,assets:s.assets.map(a=>a.id===asset.id?updatePublicSubitem(a,input):a)}));setOpened(false);message.success('子项已保存，公共收支汇总已更新');}catch(e){message.error((e as Error).message);}
  }
  return <div className="public-subitems"><Descriptions column={2} items={[{key:'in',label:'公共收入',children:money(total.income)},{key:'out',label:'公共支出',children:money(total.expense)}]}/>
    <Button type="primary" onClick={()=>open(null)}>添加收支子项</Button>
    <Table rowKey="id" dataSource={asset.subitems||[]} pagination={false} columns={[{title:'子项',dataIndex:'name'},{title:'方向',dataIndex:'direction'},{title:'当前金额',render:(_,c)=>money(c.amount)},{title:'操作',render:(_,c)=><><Button type="link" onClick={()=>open(c)}>设置 / 增加金额</Button><Button type="link" onClick={()=>setHistory(c)}>调整记录</Button></>}]}/>
    <Modal title={editing?'设置公共收支子项':'添加公共收支子项'} open={opened} onCancel={()=>setOpened(false)} onOk={save} okText="保存子项" cancelText="取消">
      <Form form={form} layout="vertical"><Form.Item name="name" label="子项名称" rules={[{required:true,whitespace:true,message:'请输入名称'}]}><Input placeholder="例如 手续费、放心租费用" maxLength={100}/></Form.Item>
      <Form.Item name="direction" label="收支方向"><Select options={[{value:'支出'},{value:'收入'}]}/></Form.Item>
      <Form.Item name="mode" label="金额操作"><Select options={[{value:'增加',label:'增加一笔金额'},{value:'设置',label:'修改当前总额'}]}/></Form.Item>
      <Form.Item name="amount" label={mode==='增加'?'增加金额（元）':'当前总额（元）'} rules={[{required:true,message:'请输入金额'}]}><InputNumber min={0} max={100000000} precision={2} style={{width:'100%'}}/></Form.Item>
      <p className="muted">当前 {money(editing?.amount||0)} → 保存后 {money((mode==='增加'?editing?.amount||0:0)+Math.round((amount||0)*100))}</p>
      <Form.Item name="date" label="记账日期" rules={[{required:true}]}><Input type="date" max={new Date().toLocaleDateString('sv-SE')}/></Form.Item><Form.Item name="note" label="调整说明"><Input maxLength={500}/></Form.Item></Form>
    </Modal>
    <Modal title={`${history?.name||''} · 调整记录`} open={!!history} onCancel={()=>setHistory(null)} footer={null} width={700}><Table pagination={{pageSize:8}} rowKey="id" dataSource={history?.adjustments.slice().reverse()||[]} columns={[{title:'记账日期',dataIndex:'date'},{title:'操作',dataIndex:'mode'},{title:'输入金额',render:(_,v)=>money(v.amount)},{title:'调整前 → 调整后',render:(_,v)=>`${money(v.before)} → ${money(v.after)}`},{title:'说明',dataIndex:'note'}]}/></Modal>
  </div>;
}
