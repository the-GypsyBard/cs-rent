import { useEffect, useState } from "react";
import {
  App,
  Button,
  Input,
  Select,
  Table,
  Tabs,
  Drawer,
  Descriptions,
  Alert,
  Form,
  Modal,
  InputNumber,
  Tag,
  Space,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  LinkOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useStore } from "../store";
import { money, platformNames, type Order } from "../model";
import { PageHead, Panel, Pill, EmptyState } from "../components";
import { validDate } from '../rental-chart';
export function Orders({ pending }: { pending: boolean }) {
  const { state, setState } = useStore();
  const { message } = App.useApp();
  const [tab, setTab] = useState("全部订单");
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("全部平台");
  const [type, setType] = useState("全部业务");
  const [detail, setDetail] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm();
  const [undo, setUndo] = useState<Order | null>(null);
  const [settlement, setSettlement] = useState('');
  const addStatus = Form.useWatch('status', form);
  const addType = Form.useWatch("type", form);
  const addAssetId = Form.useWatch("assetId", form);
  useEffect(() => {
    setTab(pending ? "待核对" : "全部订单");
  }, [pending]);
  const data = state.orders.filter(
    (o) =>
      (tab === "全部订单" ||
        (tab === "待核对" && o.status === "待核对") ||
        (tab === "待结算" && o.status === "待结算") ||
        (tab === "手工补录" && o.source === "手工补录")) &&
      (platform === "全部平台" || o.platform === platform) &&
      (type === "全部业务" || o.type === type) &&
      `${o.name} ${o.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  const order = state.orders.find((o) => o.id === detail);
  async function save() {
    const v = await form.validateFields();
    const asset = state.assets.find((a) => a.id === v.assetId)!;
    if (v.type === '出租' && v.status === '已完成' && (!validDate(v.settledAt || '') || v.settledAt < v.date || v.settledAt > new Date().toLocaleDateString('sv-SE'))) {
      message.error('请填写不早于订单日期、且不晚于今天的完成结算日期'); return;
    }
    if (v.type === "出售" && asset.status !== "持有中") {
      message.error("该资产已结束持有");
      return;
    }
    if (v.date < asset.date) {
      message.error("订单日期不能早于所选资产取得日期");
      return;
    }
    if (v.type === "出租" && v.platform === "Steam") {
      message.error("Steam 不提供出租业务");
      return;
    }
    const entry: Order = {
      id: crypto.randomUUID(),
      assetId: asset.id,
      name: asset.name,
      platform: v.platform,
      type: v.type,
      status: v.status,
      amount: Math.round(v.amount * 100),
      date: v.date,
      settledAt: v.type === '出租' && v.status === '已完成' ? v.settledAt : undefined,
      source: "手工补录",
      term: v.type === "出租" ? v.term : undefined,
      note: v.note || "原型手工补录",
    };
    setState((s) => ({
      ...s,
      orders: [entry, ...s.orders],
      assets:
        entry.type === "出售" && entry.status === "已完成"
          ? s.assets.map((a) =>
              a.id === asset.id
                ? {
                    ...a,
                    status: "已售出",
                    rental: "未出租",
                    sale: entry.amount,
                  }
                : a,
            )
          : s.assets,
    }));
    setAdding(false);
    message.success("示例订单已保存，相关资产汇总已更新");
  }
  function link() {
    if (!order || !candidate) return;
    setUndo({ ...order });
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === order.id
          ? {
              ...o,
              assetId: candidate,
              note: o.note + "；用户已关联，结算状态仍待确认。",
            }
          : o,
      ),
    }));
    message.success("关联已保存；仍需确认结算，暂不计入收入");
  }
  return (
    <>
      <PageHead
        eyebrow="ORDER LEDGER"
        title="订单中心"
        description="每笔金额保留来源，每次关联都可核对。待结算与失败订单不计入收益。"
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined aria-hidden="true" />}
            onClick={() => {
              form.resetFields();
              setAdding(true);
            }}
          >
            补录订单
          </Button>
        }
      />
      <div className="order-status-strip">
        <div>
          <b>{state.orders.length}</b>
          <span>全部示例订单</span>
        </div>
        <div>
          <b className="positive">
            {state.orders.filter((o) => o.status === "已完成").length}
          </b>
          <span>已完成</span>
        </div>
        <div>
          <b className="warning-text">
            {state.orders.filter((o) => o.status === "待核对").length}
          </b>
          <span>需要核对</span>
        </div>
        <div>
          <b>{state.orders.filter((o) => o.status === "待结算").length}</b>
          <span>等待结算</span>
        </div>
      </div>
      {undo && (
        <Alert
          type="success"
          showIcon
          title="已保存最近一次关联操作"
          action={
            <Button
              size="small"
              onClick={() => {
                setState((s) => ({
                  ...s,
                  orders: s.orders.map((o) => (o.id === undo.id ? undo : o)),
                }));
                setUndo(null);
                message.success("已撤销关联");
              }}
            >
              撤销关联
            </Button>
          }
          closable
          onClose={() => setUndo(null)}
        />
      )}
      <Panel className="table-panel">
        <Tabs
          className="table-tabs"
          activeKey={tab}
          onChange={setTab}
          items={["全部订单", "待核对", "待结算", "手工补录"].map((key) => ({
            key,
            label:
              key === "待核对" ? (
                <>
                  待核对{" "}
                  <span className="count-badge">
                    {state.orders.filter((o) => o.status === "待核对").length}
                  </span>
                </>
              ) : (
                key
              ),
          }))}
        />
        <div className="table-toolbar">
          <Input
            aria-label="搜索订单"
            prefix={<SearchOutlined aria-hidden="true" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索饰品名称或订单编号"
            allowClear
            style={{ width: 300 }}
          />
          <Select
            aria-label="订单平台"
            value={platform}
            onChange={setPlatform}
            options={["全部平台", ...platformNames].map((value) => ({ value }))}
          />
          <Select
            aria-label="订单业务"
            value={type}
            onChange={setType}
            options={["全部业务", "购买", "出租", "出售"].map((value) => ({
              value,
            }))}
          />
          <span className="push-right muted">共 {data.length} 条记录</span>
        </div>
        <Table<Order>
          rowKey="id"
          dataSource={data}
          pagination={{ pageSize: 9, showSizeChanger: false }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <EmptyState title="没有符合条件的订单" /> }}
          columns={[
            {
              title: "订单 / 饰品",
              width: 280,
              render: (_, o) => (
                <button
                  className="order-name"
                  onClick={() => {
                    setDetail(o.id);
                    setCandidate(o.assetId || undefined);
                  }}
                >
                  <b>{o.name}</b>
                  <small>
                    {o.id.startsWith("DEMO")
                      ? o.id
                      : `手工 · ${o.id.slice(0, 8)}`}
                  </small>
                </button>
              ),
            },
            {
              title: "平台 / 业务",
              render: (_, o) => (
                <div className="cell-stack">
                  <span>{o.platform}</span>
                  <small>
                    {o.type}
                    {o.term ? ` · ${o.term}` : ""}
                  </small>
                </div>
              ),
            },
            {
              title: "账本日期",
              dataIndex: "date",
              sorter: (a, b) => a.date.localeCompare(b.date),
              defaultSortOrder: "descend",
            },
            {
              title: "状态",
              render: (_, o) => (
                <Pill
                  tone={
                    o.status === "已完成"
                      ? "green"
                      : o.status === "待核对"
                        ? "amber"
                        : o.status === "失败"
                          ? "red"
                          : "blue"
                  }
                >
                  {o.status}
                </Pill>
              ),
            },
            {
              title: "记录金额",
              align: "right",
              render: (_, o) => (
                <div className="cell-stack right">
                  <b className="money">{money(o.amount)}</b>
                  {o.status !== "已完成" && <small>不计入收益</small>}
                </div>
              ),
            },
            { title: "来源", render: (_, o) => <Tag>{o.source}</Tag> },
            {
              title: "操作",
              render: (_, o) => (
                <Button
                  type="link"
                  onClick={() => {
                    setDetail(o.id);
                    setCandidate(o.assetId || undefined);
                  }}
                >
                  {o.status === "待核对" ? "核对关联" : "查看详情"}
                </Button>
              ),
            },
          ]}
        />
      </Panel>
      <Drawer
        title="订单详情与来源"
        open={!!order}
        onClose={() => setDetail(null)}
        size={560}
      >
        {order && (
          <>
            <Pill tone={order.status === "已完成" ? "green" : "amber"}>
              {order.status}
            </Pill>
            <h2>{order.name}</h2>
            <div className="order-amount">
              {money(order.amount)}
              <span>
                {order.status === "已完成"
                  ? "已确认记录金额"
                  : "尚未计入已实现收入"}
              </span>
            </div>
            <Descriptions
              column={1}
              bordered
              items={[
                { key: "id", label: "原型订单编号", children: order.id },
                {
                  key: "platform",
                  label: "平台 / 业务",
                  children: `${order.platform} / ${order.type}`,
                },
                { key: "date", label: "账本日期", children: order.date },
                ...(order.type === '出租' ? [{ key:'settlement',label:'完成结算日期',children:order.settledAt || '尚未确认' }] : []),
                { key: "source", label: "来源", children: order.source },
                {
                  key: "asset",
                  label: "关联资产",
                  children:
                    state.assets.find((a) => a.id === order.assetId)?.name ||
                    "未关联",
                },
              ]}
            />
            <div className="note-box">
              <FileTextOutlined aria-hidden="true" /> <b>来源说明与金额口径</b>
              <p>{order.note}</p>
              <small>
                此处展示原型说明。生产版将提供只读原始证据及修正历史。
              </small>
            </div>
            {order.type === '出租' && (order.status === '待结算' || (order.status === '已完成' && !order.settledAt)) && <div className="association">
              <h3>{order.status === '已完成' ? '补充完成结算日期' : '确认整单结算'}</h3>
              <Input aria-label="完成结算日期" type="date" value={settlement} min={order.date} max={new Date().toLocaleDateString('sv-SE')} onChange={e=>setSettlement(e.target.value)} />
              <Button style={{marginTop:12}} disabled={!order.assetId} onClick={()=>{
                if(!validDate(settlement)||settlement<order.date||settlement>new Date().toLocaleDateString('sv-SE')) {message.error('请填写有效的完成结算日期');return;}
                setState(s=>({...s,orders:s.orders.map(o=>o.id===order.id?{...o,status:'已完成',settledAt:settlement}:o)})); setSettlement('');message.success('结算日期已保存，租赁收入图表已更新');
              }}>保存完成结算日期</Button>
            </div>}
            {order.status === "待核对" && (
              <div className="association">
                <h3>
                  <LinkOutlined aria-hidden="true" /> 人工关联
                </h3>
                <p>
                  选择唯一对应的持有资产。仅关联不会将未知结算状态直接视为成功。
                </p>
                <Select
                  aria-label="关联候选资产"
                  style={{ width: "100%" }}
                  value={candidate}
                  onChange={setCandidate}
                  options={state.assets
                    .filter((a) => a.kind === "饰品" && a.status === "持有中")
                    .map((a) => ({
                      value: a.id,
                      label: `${a.name} · ${a.wear} · ${a.id.slice(0, 8)}`,
                    }))}
                />
                {order.type === '出租' && <Input style={{marginTop:12}} aria-label="核对完成结算日期" type="date" value={settlement} min={order.date} max={new Date().toLocaleDateString('sv-SE')} onChange={e=>setSettlement(e.target.value)} />}
                <Space style={{ marginTop: 16 }}>
                  <Button type="primary" disabled={!candidate} onClick={link}>
                    保存关联
                  </Button>
                  <Button
                    disabled={!order.assetId}
                    onClick={() => {
                      if(order.type === '出租' && (!validDate(settlement)||settlement<order.date||settlement>new Date().toLocaleDateString('sv-SE'))) {message.error('请填写有效的完成结算日期');return;}
                      setState((s) => ({
                        ...s,
                        orders: s.orders.map((o) =>
                          o.id === order.id
                            ? {
                                ...o,
                                status: "已完成",
                                settledAt: o.type === '出租' ? settlement : undefined,
                                note:
                                  o.note +
                                  "；用户在示例中确认已经结束并全部结算。",
                              }
                            : o,
                        ),
                      }));
                      setUndo(null);
                      message.success("已按示例确认结算，收益已更新");
                    }}
                  >
                    确认整单已结算
                  </Button>
                </Space>
              </div>
            )}
          </>
        )}
      </Drawer>
      <Modal
        title="补录示例订单"
        open={adding}
        onCancel={() => setAdding(false)}
        onOk={save}
        okText="保存订单"
        cancelText="取消"
      >
        <Alert
          className="form-alert"
          type="info"
          title="购买记录请到「资产与收支 → 新增记录」录入，本表补录既有资产的出租与出售。"
        />
        <Form
          name="order-entry"
          form={form}
          layout="vertical"
          initialValues={{
            type: "出租",
            platform: "BUFF",
            status: "已完成",
            term: "未知",
            date: new Date().toLocaleDateString("sv-SE"),
            settledAt: new Date().toLocaleDateString('sv-SE'),
          }}
        >
          <Form.Item
            name="assetId"
            label="关联资产"
            rules={[{ required: true, message: "请选择资产" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={state.assets
                .filter((a) => a.kind === "饰品" && a.status === "持有中")
                .map((a) => ({
                  value: a.id,
                  label: `${a.name} · ${a.version} · ${a.wear}`,
                }))}
            />
          </Form.Item>
          <div className="form-grid">
            <Form.Item name="type" label="业务类型">
              <Select
                options={["出租", "出售"].map((value) => ({ value }))}
                onChange={(v) => {
                  if (
                    v === "出租" &&
                    form.getFieldValue("platform") === "Steam"
                  )
                    form.setFieldValue("platform", "BUFF");
                }}
              />
            </Form.Item>
            <Form.Item name="platform" label="平台">
              <Select
                options={platformNames
                  .filter((p) => addType !== "出租" || p !== "Steam")
                  .map((value) => ({ value }))}
              />
            </Form.Item>
          </div>
          <div className="form-grid">
            <Form.Item name="status" label="结算状态">
              <Select
                options={["已完成", "待结算"].map((value) => ({ value }))}
              />
            </Form.Item>
            <Form.Item
              name="amount"
              label="最终净金额 / 待结算金额（元）"
              rules={[{ required: true, message: "请填写金额" }]}
            >
              <InputNumber
                min={0}
                max={100000000}
                precision={2}
                style={{ width: "100%" }}
              />
            </Form.Item>
          </div>
          {addType === "出租" && (
            <Form.Item name="term" label="平台租赁分类">
              <Select
                options={["短租", "长租", "未知"].map((value) => ({ value }))}
              />
            </Form.Item>
          )}
          <Form.Item
            name="date"
            label="账本日期"
            rules={[{ required: true, message: "请选择日期" }]}
          >
            <Input
              type="date"
              min={state.assets.find((a) => a.id === addAssetId)?.date}
              max={new Date().toLocaleDateString("sv-SE")}
            />
          </Form.Item>
          {addType === '出租' && addStatus === '已完成' && <Form.Item name="settledAt" label="完成结算日期" rules={[{required:true,message:'请选择完成结算日期'}]}><Input type="date" max={new Date().toLocaleDateString('sv-SE')} /></Form.Item>}
          <Form.Item name="note" label="补录依据">
            <Input.TextArea maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

