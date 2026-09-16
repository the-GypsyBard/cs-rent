export const LIST_URL = 'https://www.igxe.cn/lease/seller-order-list';
export function clean(value = '') { return String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
export function money(value) {
  const match = String(value ?? '').replaceAll(',', '').match(/-?\d+(?:\.\d{1,2})?/);
  return match ? Math.round(Number(match[0]) * 100) : null;
}
export function detailUrl(id) {
  if (!/^\d+$/.test(String(id))) throw new Error('无效订单号');
  return `https://www.igxe.cn/lease/order/detail-${id}?b_type=2`;
}
export function parseList(snapshot) {
  const orders = snapshot.tables.map(table => {
    const id = table.caption.match(/订单号\s*[:：]\s*(\d+)/)?.[1];
    if (!id || !table.rows.length) throw new Error('订单列表结构变化：缺少订单号或商品行');
    if (table.url !== detailUrl(id)) throw new Error(`订单 ${id} 详情链接不匹配`);
    const items = table.rows.map(cells => {
      if (cells.length < 5) throw new Error('订单列表列数变化');
      return {name: clean(cells[0]), dailyCents: money(cells[1]), days: Number(cells[2].match(/\d+/)?.[0]), depositCents: money(cells[3]), status: clean(cells[4].replace('查看订单详情', ''))};
    });
    return {id, url: table.url, createdAt: table.caption.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)?.[0], items, status: items[0].status};
  });
  if (!orders.length) throw new Error('未读取到订单，可能尚未加载、登录失效或页面发生变化；不会按空订单处理');
  return {orders, totalItems: snapshot.totalItems, page: snapshot.page};
}
export function parseDetail(raw, expectedId) {
  const text = clean(raw.text);
  const id = text.match(/订单编号\s*[:：]\s*(\d+)/)?.[1];
  if (id !== String(expectedId)) throw new Error('详情订单号与任务不一致');
  const fields = Object.fromEntries((raw.fields || []).map(f => [clean(f.label).replace(/[:：]$/, ''), clean(f.value)]));
  const read = key => fields[key] || null;
  const date = key => read(key)?.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)?.[0] || null;
  const createdAt = date('创建时间');
  if (!createdAt || !raw.items?.length || raw.items.some(x => !clean(x.name) || /undefined/.test(x.url))) throw new Error('详情未加载完整：缺少创建时间或有效商品');
  const daysText = read('出租天数') || read('租赁天数');
  const events = [...(raw.leaseText || '').matchAll(/(逾期续租|续租|首租)\s*(\d+)天\s*[（(]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s*[）)]/g)].map(m => ({type: m[1], days: Number(m[2]), at: clean(m[3])}));
  const amounts = [...(raw.amountText || '').matchAll(/([^\n:：]+)[:：]\s*[¥￥]\s*([\d,]+(?:\.\d{1,2})?)/g)].map(m => ({label: clean(m[1]), cents: money(m[2])}));
  const status = text.match(/订单编号\s*[:：]\s*\d+\s+(.+?)(?=待承租方|进行系统结算|待出租方|订单类型|赔付方式)/)?.[1]?.trim() || null;
  const order = {id, createdAt, status, type: read('订单类型'), dailyCents: money(read('租赁价格')), depositCents: money(read('饰品押金') || read('租赁押金')), days: Number(daysText?.match(/^(\d+)天/)?.[1]) || null, maxDays: Number(daysText?.match(/最长\s*(\d+)天/)?.[1]) || null, returnedAt: date('归还时间'), dueAt: date('租赁到期时间'), deadlineAt: date('归还截止时间'), amountCents: money(read('订单金额')), events, amounts, items: raw.items, fields, compensation: text.match(/赔付方式[：:](.*?)(?=订单类型)/)?.[1]?.trim() || null, warnings: []};
  if (order.dailyCents === null || order.depositCents === null || !order.status) throw new Error('详情核心字段缺失，保留上次成功数据');
  if (raw.hasLeaseToggle && !events.length) throw new Error('租期展开控件存在，但未成功提取租期事件');
  if (raw.hasAmountToggle && !amounts.length) throw new Error('金额展开控件存在，但未成功提取金额明细');
  if (order.days && events.length && events.reduce((sum,e)=>sum+e.days,0) !== order.days) order.warnings.push('租期事件累计天数与页面出租天数不一致，需人工核对');
  if (order.amountCents !== null && amounts.length && amounts.reduce((sum,e)=>sum+e.cents,0) !== order.amountCents) order.warnings.push('金额明细合计与订单金额不同，可能存在扣款或其他口径，请核对原文');
  if (order.amountCents === null) order.warnings.push('页面未提供订单金额');
  return order;
}
