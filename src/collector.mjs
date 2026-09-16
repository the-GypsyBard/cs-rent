import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { getPlaywright } from './dependencies.mjs';
import { LIST_URL, parseList, parseDetail, detailUrl } from './parser.mjs';

export class Collector {
  constructor(store) { this.store=store; this.context=null; this.busy=false; this.stopRequested=false; this.state={phase:'idle',message:'请先打开采集浏览器，在 IGXE 完成登录',log:[]}; }
  emit(message,extra={}) { this.state={...this.state,...extra,message,log:[...this.state.log,{at:new Date().toISOString(),message}].slice(-100)}; }
  check() { if(this.stopRequested) throw new Error('用户暂停；已完成订单已保存，可继续未完成任务'); }
  async open() {
    if(this.context) return;
    const {chromium}=getPlaywright();
    try {
      this.context=await chromium.launchPersistentContext(join(this.store.dir,'browser-profile'),{channel:process.env.IGXE_BROWSER_CHANNEL || 'msedge',headless:false,chromiumSandbox:true,viewport:{width:1280,height:850},acceptDownloads:false});
    } catch(e) {
      if(/EPERM|EACCES/.test(e.message)) throw new Error('当前运行环境禁止启动 Edge 子进程。请从项目文件夹双击“启动应用.cmd”运行，或允许本地应用启动浏览器后重试。');
      throw new Error(`无法启动采集浏览器。请确认已安装 Edge、该采集窗口没有被其他程序占用。${e.message.split('\n')[0]}`);
    }
    this.context.on('close',()=>{this.context=null; this.emit('采集浏览器已关闭；再次打开后可以继续');});
    this.listPage=this.context.pages()[0] || await this.context.newPage();
    await this.listPage.goto(LIST_URL,{waitUntil:'domcontentloaded'});
    this.emit('采集浏览器已打开，请完成登录，再点击开始采集');
  }
  async ready(page,kind,id) {
    this.check();
    try {
      await page.waitForFunction(({kind,id})=>{
        if(kind==='list') return [...document.querySelectorAll('table')].some(t=>/订单号\s*[:：]\s*\d+/.test(t.innerText) && t.querySelector('a[href*="/lease/order/detail-"]'));
        const root=document.querySelector('.deliveryDetails');
        return root && root.innerText.includes(String(id)) && /创建时间[：:]\s*\d{4}-/.test(root.innerText) && [...document.querySelectorAll('a[href*="/lease/trade/"]')].some(a=>a.innerText.trim()&&!a.href.includes('undefined'));
      },{kind,id},{timeout:25000});
    } catch { throw new Error('页面未准备好：请检查采集浏览器是否需要登录、人工验证或网络恢复，再继续。未将占位数据写入订单。'); }
    this.check();
  }
  async identity(page) {
    const nickname=await page.locator('a[href]').evaluateAll(links=>links.filter(a=>new URL(a.href).pathname==='/profile').map(a=>a.innerText.trim()).find(Boolean));
    if(!nickname) throw new Error('无法确认登录账户，已暂停');
    const saved=this.store.get('accountNickname');
    if(saved && saved!==nickname) throw new Error(`当前登录账户 ${nickname} 与本地库绑定账户 ${saved} 不同，请切回原账户`);
    if(!saved) this.store.set('accountNickname',nickname);
  }
  async readList() {
    return parseList(await this.listPage.evaluate(()=>({
      page:Number(document.querySelector('.mod-pagination a.active')?.textContent.trim() || 1),
      totalItems:Number(document.body.innerText.match(/总商品数量[：:]\s*(\d+)件/)?.[1] ?? NaN),
      tables:[...document.querySelectorAll('table')].filter(t=>t.querySelector('a[href*="/lease/order/detail-"]')).map(t=>({caption:t.querySelector('caption')?.innerText || '',url:t.querySelector('a[href*="/lease/order/detail-"]')?.href,rows:[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText))}))
    })));
  }
  async scan(pass) {
    await this.listPage.goto(LIST_URL,{waitUntil:'domcontentloaded'}); await this.ready(this.listPage,'list'); await this.identity(this.listPage);
    const found=new Map(); let duplicate=0,total=null,changedTotal=false,pageNum=1,itemCount=0;
    for(;;) {
      this.check(); const current=await this.readList();
      if(current.page!==pageNum) throw new Error(`分页校验失败：期望第${pageNum}页，页面显示${current.page}`);
      if(!Number.isFinite(current.totalItems)) throw new Error('未识别到总商品数量，停止以免错误判断完整性');
      if(total!==null && total!==current.totalItems) changedTotal=true; total=current.totalItems;
      for(const order of current.orders) { if(found.has(order.id)) duplicate++; else {found.set(order.id,order); itemCount+=order.items.length;} }
      this.emit(`目录核对 ${pass}/2 · 第 ${pageNum} 页 · 已发现 ${found.size} 个订单`,{phase:'listing',page:pageNum,discovered:found.size});
      const next=this.listPage.locator('.mod-pagination a.next');
      if(!await next.count() || !await next.isVisible()) break;
      const before=current.orders.map(o=>o.id).join(',');
      await delay(900); this.check(); await next.click();
      await this.listPage.waitForFunction(({target,before})=>{
        const active=Number(document.querySelector('.mod-pagination a.active')?.textContent.trim());
        const ids=[...document.querySelectorAll('table caption')].map(x=>x.innerText.match(/订单号\s*[:：]\s*(\d+)/)?.[1]).filter(Boolean).join(',');
        return active===target && ids && ids!==before;
      },{target:pageNum+1,before},{timeout:25000});
      pageNum++; if(pageNum>10000) throw new Error('分页超出保护上限，需检查页面结构');
    }
    return {orders:[...found.values()],duplicate,totalItems:total,itemCount,pages:pageNum,changedTotal};
  }
  async readDetail(id) {
    this.check(); await this.detailPage.goto(detailUrl(id),{waitUntil:'domcontentloaded'}); await this.ready(this.detailPage,'detail',id); await this.identity(this.detailPage);
    const root=this.detailPage.locator('.deliveryDetails');
    const toggle=async label=>{
      // Use the label's direct parent, not a global icon index; both tips can close each other.
      const field=root.locator('.label').filter({hasText:label}).first();
      if(!await field.count()) return {exists:false,text:''};
      const host=field.locator('..');
      const icon=host.locator('.tips-icon').first();
      if(!await icon.count()) return {exists:false,text:''};
      await icon.click();
      const box=host.locator('.tips-content').first();
      await box.waitFor({state:'visible',timeout:5000});
      const text=await box.innerText();
      // Close explicitly so the next open is deterministic.
      await icon.click();
      return {exists:true,text};
    };
    const lease=await toggle(/出租天数|租赁天数/), amount=await toggle('订单金额');
    const raw=await root.evaluate(el=>({text:el.innerText,fields:[...el.querySelectorAll('.label')].map(label=>{const host=label.parentElement.cloneNode(true);host.querySelectorAll('.label,.tips-content').forEach(x=>x.remove());return {label:label.innerText,value:host.textContent};})}));
    raw.items=await this.detailPage.locator('a[href*="/lease/trade/"]').evaluateAll(links=>links.map(a=>{const text=a.parentElement.parentElement.innerText;return {name:a.innerText.trim(),url:a.href,wear:text.match(/磨损\s*([\d.]+)/)?.[1]||null,percentage:text.match(/\d+(?:\.\d+)?%/)?.[0]||null,quantity:Number(a.closest('.ord-item')?.innerText.match(/x\s*(\d+)/)?.[1]||1)};}));
    Object.assign(raw,{leaseText:lease.text,amountText:amount.text,hasLeaseToggle:lease.exists,hasAmountToggle:amount.exists,url:detailUrl(id)});
    return {raw,order:parseDetail(raw,id)};
  }
  start(mode='incremental') {
    if(this.busy) throw new Error('正在采集，请勿重复启动');
    if(!this.context) throw new Error('请先打开采集浏览器并登录 IGXE');
    this.busy=true; this.stopRequested=false; this.state={phase:'starting',message:'准备采集',log:[]};
    this.job=this.run(mode).finally(()=>{this.busy=false;}); return this.job;
  }
  async run(mode) {
    const runId=this.store.startRun(); let report={mode,success:0,failed:[],warnings:[],coverageVerified:false};
    try {
      if(!this.listPage || this.listPage.isClosed()) this.listPage=await this.context.newPage();
      if(mode!=='resume') {
        const first=await this.scan(1), second=await this.scan(2);
        const set1=new Set(first.orders.map(o=>o.id)),set2=new Set(second.orders.map(o=>o.id));
        const same=set1.size===set2.size && [...set1].every(x=>set2.has(x));
        report={...report,pages:second.pages,orders:second.orders.length,totalItems:second.totalItems,readItems:second.itemCount,coverageVerified:same && !first.duplicate && !second.duplicate && !first.changedTotal && !second.changedTotal && first.totalItems===second.totalItems && second.itemCount===second.totalItems};
        if(!report.coverageVerified) report.warnings.push('两次目录扫描或商品数量未完全一致，不能宣称全量完整，请再次全量同步');
        const previous=new Map(this.store.list().map(x=>[x.id,x]));
        const union=new Map([...first.orders,...second.orders].map(x=>[x.id,x]));
        const ids=[];
        for(const order of union.values()) {
          const old=previous.get(order.id);
          if(mode==='full' || !old?.detail || old.error || JSON.stringify(old.summary)!==JSON.stringify(order) || !/^交易完成/.test(order.status) || !old.updatedAt || Date.now()-Date.parse(old.updatedAt)>7*86400000) ids.push(order.id);
          this.store.summary(order);
        }
        const missing=[...previous.keys()].filter(id=>!union.has(id));
        if(missing.length) report.warnings.push(`${missing.length}个本地历史订单未出现在本轮目录，已保留，不自动删除`);
        this.store.enqueue(ids); this.store.set('lastDirectoryReport',report);
      } else {
        report={...report,directory:this.store.get('lastDirectoryReport')};
        report.warnings.push('本次仅继续未完成详情，不重新验证当前目录完整性');
        await this.listPage.goto(LIST_URL,{waitUntil:'domcontentloaded'}); await this.ready(this.listPage,'list'); await this.identity(this.listPage);
      }
      if(!this.detailPage || this.detailPage.isClosed()) this.detailPage=await this.context.newPage();
      const pending=this.store.pending(); report.scheduled=pending.length;
      for(let index=0;index<pending.length;index++) {
        this.check(); const id=pending[index]; this.emit(`采集详情 ${index+1}/${pending.length} · 订单 ${id}`,{phase:'details',current:id,completed:index,total:pending.length});
        let success=false;
        for(let attempt=0;attempt<3;attempt++) {
          try { const {order,raw}=await this.readDetail(id); this.store.save(id,order,raw); report.success++; success=true; break; }
          catch(e) {
            if(this.stopRequested) throw e;
            if(/登录|人工验证|账户|浏览器|closed/i.test(e.message)) throw e;
            if(attempt===2) {this.store.fail(id,e.message);report.failed.push({id,error:e.message});}
            else {this.emit(`订单 ${id} 读取失败，稍后重试 (${attempt+1}/2)`); await delay(1500*2**attempt);}
          }
        }
        if(success) await delay(900);
      }
      const all=this.store.list(); report.stored=all.length; report.details=all.filter(o=>o.detail).length; report.remaining=this.store.pending().length;
      report.fieldWarnings=all.filter(o=>o.detail?.warnings.length).map(o=>({id:o.id,warnings:o.detail.warnings}));
      const complete=report.coverageVerified && report.remaining===0 && !report.failed.length;
      const state=complete?'complete':'partial';
      this.store.finishRun(runId,state,report); this.emit(complete?'同步完成，目录覆盖与详情任务已核对':'本轮处理结束，请查看报告中的覆盖范围和待核对项',{phase:state,report});
    } catch(e) {
      report.error=e.message;report.remaining=this.store.pending().length;
      this.store.finishRun(runId,'paused',report);this.emit(e.message,{phase:'paused',report});
    }
  }
}
