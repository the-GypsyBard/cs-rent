import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.mjs';
import { Collector } from '../src/collector.mjs';
const order={id:'123',createdAt:'2026-01-01 00:00:00',status:'交易完成',items:[{name:'测试饰品'}]};
function setup() {
  const store=new Store(mkdtempSync(join(tmpdir(),'igxe-collector-')));
  const collector=new Collector(store);
  const page={isClosed:()=>false,goto:async()=>{}};
  collector.context={newPage:async()=>page};collector.listPage=page;collector.detailPage=page;
  collector.ready=async()=>{};collector.identity=async()=>{};
  collector.scan=async()=>({orders:[order],duplicate:0,totalItems:1,itemCount:1,pages:1,changedTotal:false});
  collector.readDetail=async()=>({order:{id:'123',warnings:[],amountCents:100},raw:{text:'测试订单'}});
  return {collector,store};
}
test('两次目录一致且详情成功才报告完整，增量跳过新鲜终态订单',async()=>{const {collector:c,store:s}=setup();await c.start('full');assert.equal(c.state.phase,'complete');assert.equal(s.list().length,1);await c.start('incremental');assert.equal(c.state.report.scheduled,0);assert.equal(c.state.phase,'complete');s.db.close();});
test('目录漂移不得报告完整，仍保留两次扫描并集',async()=>{const {collector:c,store:s}=setup();let n=0;c.scan=async()=>({orders:n++?[{...order,id:'124'}]:[order],duplicate:0,totalItems:1,itemCount:1,pages:1,changedTotal:false});c.readDetail=async id=>({order:{id,warnings:[]},raw:{id}});await c.start('full');assert.equal(c.state.phase,'partial');assert.equal(c.state.report.coverageVerified,false);assert.equal(s.list().length,2);s.db.close();});
test('需要登录会暂停并保留任务，续采不虚报完整目录',async()=>{const {collector:c,store:s}=setup();c.readDetail=async()=>{throw new Error('页面需要登录');};await c.start('full');assert.equal(c.state.phase,'paused');assert.deepEqual(s.pending(),['123']);c.readDetail=async()=>({order:{id:'123',warnings:[]},raw:{text:'恢复成功'}});await c.start('resume');assert.equal(c.state.phase,'partial');assert.equal(c.state.report.coverageVerified,false);assert.equal(s.pending().length,0);s.db.close();});
test('重复分页或商品数量不一致不得通过覆盖核验',async()=>{const {collector:c,store:s}=setup();c.scan=async()=>({orders:[order],duplicate:1,totalItems:2,itemCount:1,pages:2,changedTotal:false});await c.start('full');assert.equal(c.state.phase,'partial');assert.equal(c.state.report.coverageVerified,false);s.db.close();});
