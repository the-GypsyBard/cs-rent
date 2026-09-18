import {QuoteSource} from './QuoteSource';
import {openMarket} from '../market-link';
import {matchesSearch,searchOption,localizedText} from '../../../shared/presentation';
import { useState } from "react";
import {
  Button,
  Input,
  Select,
  Table,
  Tag,
  Space,
  Drawer,
  Descriptions,
  Tabs,
  Timeline,
  Form,
  Modal,
  InputNumber,
  Checkbox,
  App,
  Alert,
  Popconfirm,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  ArrowRightOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useCatalogSkins } from '../catalog-store';
import { AssetAttributes } from './AssetAttributes';
import { PublicSubitems } from './PublicSubitems';
import { cleanAssetAttributes,updatePublicSubitem } from '../../../shared/asset-rules';
import { specialFields } from '../../../shared/market';
import { useStore, addAsset, downloadJson } from "../store";
import {
  assetMetrics,
  money,
  totals,
  platformNames,
  type Asset,
  type Page,
} from "../model";
import {
  ItemArt,
  Panel,
  PageHead,
  Pill,
  Metric,
  EmptyState,
} from "../components";
export function Assets({ navigate,openCollection }: { navigate: (page: Page) => void;openCollection:(skinId:string)=>void }) {
  const skins = useCatalogSkins();
  const { state, setState,settings,setSettings } = useStore();
  const { message } = App.useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("全部状态");
  const [platform, setPlatform] = useState("全部平台");
  const [kind, setKind] = useState("全部项目");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const visible=settings.assetColumns;const setVisible=(value:string[])=>setSettings({assetColumns:value as typeof settings.assetColumns});
  const [form] = Form.useForm();
  const assetKind = Form.useWatch("kind", form);
  const skinId = Form.useWatch("skinId", form);
  const acquisition = Form.useWatch("acquisition", form);
  const wear = Form.useWatch('wear',form);
  const valuation = Form.useWatch('valuation',form);
  const [saving,setSaving]=useState(false);
  const skin = skins.find((s) => s.id === skinId);
  const [editing, setEditing] = useState(false);
  const [editForm] = Form.useForm();
  const data = state.assets.filter(
    (a) =>
      (!query ||
        `${localizedText(a.name)} ${a.note} ${a.float}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (status === "全部状态" || a.status === status) &&
      (platform === "全部平台" || (a.platform||'无所属平台') === platform) &&
      (kind === "全部项目" || a.kind === kind),
  );
  const summary = totals(data, state.orders);
  const detail = state.assets.find((a) => a.id === detailId);
  const detailSkin=skins.find(s=>s.id===detail?.skinId);
  const detailOrders = state.orders.filter((o) => o.assetId === detailId);
  const metrics: ColumnsType<Asset> = [
    {title:'库存参考价',key:'value',width:160,align:'right',render:(_,a)=>a.kind==='饰品'?<div className="cell-stack"><b className={a.value===null?'warning-text':'money'}>{a.value===null?'待估值':money(a.value)}</b><small>{a.valueSource||'未获取参考价'}</small></div>:'—'},
    {
      title: "购买成本",
      key: "cost",
      align: "right",
      width: 130,
      sorter: (a, b) => (a.cost ?? -1) - (b.cost ?? -1),
      render: (_, a) => (
        <span className={a.cost === null ? "warning-text" : "money"}>
          {money(a.cost)}
        </span>
      ),
    },
    {
      title: "累计租金",
      key: "rent",
      width: 130,
      align: "right",
      sorter: (a, b) =>
        assetMetrics(a, state.orders).rent - assetMetrics(b, state.orders).rent,
      render: (_, a) => (
        <Button
          type="link"
          className="amount-link"
          onClick={() => setDetailId(a.id)}
        >
          {money(assetMetrics(a, state.orders).rent)}
        </Button>
      ),
    },
    {
      title: "出售收入",
      key: "sale",
      align: "right",
      width: 130,
      render: (_, a) => money(a.sale),
    },
    {
      title: "已实现净收益",
      key: "net",
      align: "right",
      width: 145,
      render: (_, a) => (
        <span className="positive money">
          {money(assetMetrics(a, state.orders).net)}
        </span>
      ),
    },
    {
      title: "收支差额",
      key: "cash",
      align: "right",
      width: 140,
      render: (_, a) => {
        const v = assetMetrics(a, state.orders).cash;
        return (
          <span className={`${(v || 0) < 0 ? "negative" : "positive"} money`}>
            {money(v)}
          </span>
        );
      },
    },
  ];
  const columns: ColumnsType<Asset> = [
    {
      title: "饰品 / 项目",
      key: "identity",
      fixed: "left",
      width: 330,
      sorter: (a, b) => a.name.localeCompare(b.name, "zh-CN"),
      defaultSortOrder: "ascend",
      render: (_, a) => (
        <button className="asset-cell" onClick={() => setDetailId(a.id)}>
          <ItemArt src={a.image} name={localizedText(a.name)} rarity={a.rarity} />
          <span>
            <b>{localizedText(a.name)}</b>
            <small>
              {a.kind === "饰品"
                ? `${a.version} · ${a.wear}`
                : "公共收支 · 不计入饰品库存"}
            </small>
            <em>{a.kind === "饰品" ? [`磨损 ${a.float}`,a.fade?`渐变 ${a.fade}%`:'',localizedText(a.style||'')].filter(Boolean).join(' · ') : a.note}</em>
          </span>
        </button>
      ),
    },
    {
      title: "状态 / 平台",
      key: "status",
      width: 145,
      render: (_, a) => (
        <div className="cell-stack">
          <Pill tone={a.status === "持有中" ? "green" : "gray"}>
            {a.kind === "公共收支" ? "公共收支" : a.status}
          </Pill>
          <small>
            {a.platform||'无所属平台'}{" "}
            {a.status === "持有中" && a.kind === "饰品" ? `· ${a.rental}` : ""}
          </small>
        </div>
      ),
    },
    ...metrics.filter((c) => (visible as string[]).includes(String(c.key))),
    {
      title: "用途 / 取得日期",
      width: 175,
      key: "tags",
      render: (_, a) => (
        <div className="cell-stack">
          <div>
            {a.tags.length ? a.tags.map((t) => <Tag key={t}>{t}</Tag>) : "—"}
          </div>
          <small>{a.date}</small>
        </div>
      ),
    },
    {
      title: "",
      key: "open",
      width: 55,
      fixed: "right",
      render: (_, a) => (
        <Button
          type="text"
          aria-label={`查看${localizedText(a.name)}`}
          icon={<ArrowRightOutlined aria-hidden="true" />}
          onClick={() => setDetailId(a.id)}
        />
      ),
    },
  ];
  async function save() {
    const v = await form.validateFields();
    const selected = skins.find((s) => s.id === v.skinId);
    const expense = v.kind === "公共收支";
    const cost = expense
      ? Math.round(v.cost * 100)
      : v.acquisition === "受赠"
        ? 0
        : v.acquisition === "待核对"
          ? null
          : Math.round(v.cost * 100);
    let attributes;try{attributes=expense?{float:'不适用',template:'不适用'}:cleanAssetAttributes(v,selected!,v.wear);}catch(e){message.error((e as Error).message);return;}
    setSaving(true);
    let quote:{value:number|null;valueSource?:string;valueUpdated?:string;valueManual?:boolean}={value:null};
    if(!expense){
      if(v.valuation==='手动输入'){quote={value:Math.round(v.referenceValue*100),valueSource:'用户手动参考价',valueUpdated:new Date().toISOString(),valueManual:true};}
      else try{const result=await window.desktop?.quote({skinId:selected!.id,wear:v.wear,version:v.version});if(result?.ok&&result.value!==undefined)quote={value:result.value,valueSource:result.source,valueUpdated:result.updated,valueManual:false};else message.warning(result?.error||'网页预览无法获取参考报价，已记为待估值');}catch{message.warning('报价暂不可用，已记为待估值');}
    }
    let a: Asset = {
      id: crypto.randomUUID(),
      skinId: selected?.id || "",
      name: expense ? v.name : selected!.label,
      image: expense ? "" : selected!.image,
      rarity: expense ? "#8290a8" : selected!.rarity,
      wear: expense ? "—" : v.wear,
      ...attributes,
      version: expense ? "普通" : v.version,
      platform: !expense&&v.acquisition==='受赠'?null:v.platform,
      acquisition:expense?undefined:v.acquisition,
      status: "持有中",
      rental: v.acquisition === "待核对" ? "状态待核实" : "未出租",
      tags: v.tags || [],
      date: v.date,
      cost,
      ...quote,
      sale: 0,
      note: v.note || "手工录入",
      collection: selected?.collection || "—",
      kind: v.kind,
    };
    if(expense)a=updatePublicSubitem({...a,cost:0,subitems:[]},{name:v.subitemName||'未分类支出',direction:v.direction||'支出',mode:'设置',amount:cost||0,date:v.date,note:v.note||''});
    setState((s) => addAsset(s, a));
    setModal(false);
    form.resetFields();
    message.success("已添加到账本");
    setSaving(false);
  }
  async function refreshValue(asset:Asset){try{const skin=skins.find(s=>s.id===asset.skinId);if(skin?.phase&&asset.style&&localizedText(asset.style)!==localizedText(skin.phase)){message.warning('记录的款式与商品不一致，请先核实款式再获取估值');return;}const quote=await window.desktop?.quote({skinId:asset.skinId,wear:asset.wear,version:asset.version,refresh:true});if(!quote?.ok||quote.value===undefined){message.warning(quote?.error||'当前无法获取参考报价，已保留原估值');return;}setState(s=>({...s,assets:s.assets.map(a=>a.id===asset.id&&a.valueUpdated===asset.valueUpdated&&a.value===asset.value?{...a,value:quote.value!,valueSource:quote.source,valueUpdated:quote.updated,valueManual:false}:a)}));message.success('参考价已更新，库存参考价值同步变化');}catch{message.error('获取失败，已保留原估值');}}
  return (
    <>
      <PageHead
        eyebrow="ASSETS & CASH FLOW"
        title="资产与收支"
        description="饰品、订单与公共收支，归集在一张可追溯的账本中。"
        actions={
          <>
            <Button
              icon={<DownloadOutlined aria-hidden="true" />}
              onClick={() =>
                downloadJson(
                  { scope: "当前筛选", assets: data },
                  "资产筛选.json",
                )
              }
            >
              导出当前列表
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined aria-hidden="true" />}
              onClick={() => {
                form.resetFields();
                setModal(true);
              }}
            >
              新增记录
            </Button>
          </>
        }
      />
      <div className="metrics-grid compact">
        <Metric
          label="当前筛选项目"
          value={String(data.length)}
          note="饰品与公共收支"
        />
        <Metric
          label="已知购买成本"
          value={money(summary.cost)}
          note={`${summary.unknown} 件成本待确认`}
        />
        <Metric
          label="已结算租金"
          value={money(summary.rent)}
          note="点击金额可查看订单"
          tone="teal"
        />
        <Metric
          label="累计收支差额"
          value={money(summary.cash)}
          note="当前筛选 · 已知金额合计"
        />
      </div>
      <Panel className="table-panel">
        <div className="table-toolbar">
          <Input
            aria-label="搜索资产"
            prefix={<SearchOutlined aria-hidden="true" />}
            placeholder="搜索名称、磨损或备注"
            allowClear
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 250 }}
          />
          <Select
            aria-label="资产状态"
            value={status}
            onChange={setStatus}
            options={["全部状态", "持有中", "已售出", "已赠出"].map(
              (value) => ({ value }),
            )}
          />
          <Select
            aria-label="资产平台"
            value={platform}
            onChange={setPlatform}
            options={["全部平台", ...platformNames,'无所属平台'].map((value) => ({ value }))}
          />
          <Select
            aria-label="项目类型"
            value={kind}
            onChange={setKind}
            options={["全部项目", "饰品", "公共收支"].map((value) => ({
              value,
            }))}
          />
          <Button
            type="text"
            onClick={() => {
              setQuery("");
              setStatus("全部状态");
              setPlatform("全部平台");
              setKind("全部项目");
            }}
          >
            重置筛选
          </Button>
          <Button
            className="push-right"
            aria-label="显示列"
            icon={<SettingOutlined aria-hidden="true" />}
            onClick={() => setColumnsOpen(true)}
          >
            显示列
          </Button>
        </div>
        <div className="table-meta">
          共 {data.length} 个项目{" "}
          <span>默认按武器名称排序 · 横向滚动查看更多金额</span>
        </div>
        <Table<Asset>
          rowKey="id"
          columns={columns}
          dataSource={data}
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 7,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 个项目`,
          }}
          locale={{ emptyText: <EmptyState title="没有符合条件的资产" /> }}
          expandable={{
            rowExpandable: (a) => a.kind === "饰品",
            expandedRowRender: (a) => (
              <div className="expanded-orders">
                <b>已关联订单</b>
                {state.orders
                  .filter((o) => o.assetId === a.id)
                  .map((o) => (
                    <div key={o.id}>
                      <span>
                        {o.date} · {o.type} · {o.platform}
                      </span>
                      <span>{o.status}</span>
                      <strong>{money(o.amount)}</strong>
                    </div>
                  ))}
                <Button type="link" onClick={() => navigate("orders")}>
                  前往订单中心
                </Button>
              </div>
            ),
          }}
        />
      </Panel>
      <Drawer
        title="资产档案"
        open={!!detail}
        onClose={() => {
          setDetailId(null);
          setEditing(false);
        }}
        size={650}
      >
        {detail && (
          <>
            <div className="detail-hero">
              <ItemArt
                src={detail.image}
                name={detail.name}
                rarity={detail.rarity}
                large
              />
              <div>
                <Pill tone="green">{detail.status}</Pill>
                <h2>{detail.kind==='饰品'&&detailSkin?<button className="collection-item-link" title="打开此版本与外观的 SteamDT 详情" onClick={async()=>{try{message.info(await openMarket({skinId:detailSkin.id,wear:detailSkin.wears.includes(detail.wear)?detail.wear:detailSkin.wears[0],version:detail.version}));}catch(e){message.error((e as Error).message);}}}>{localizedText(detail.name)} ↗</button>:detail.name}</h2>
                <p>
                  {detail.version} · {detail.wear}
                </p>
                {detail.platform&&<Tag>{detail.platform}</Tag>}{detail.acquisition==='受赠'&&<Tag>受赠</Tag>}
                {detail.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            </div>
            <div className="detail-metrics">
              <Metric
                label="取得成本"
                value={money(detail.cost)}
                note={
                  detail.cost === 0
                    ? "明确零成本"
                    : detail.cost === null
                      ? "缺少取得记录"
                      : "已确认成本"
                }
              />
              <Metric
                label="累计租金"
                value={money(assetMetrics(detail, state.orders).rent)}
                note="仅已完成结算"
              />
              <Metric
                label="已实现净收益"
                value={money(assetMetrics(detail, state.orders).net)}
                note="与列表相同口径"
              />
            </div>
            {detail.kind==='公共收支'&&<PublicSubitems asset={detail}/>}
            {detail.kind==='饰品'&&<div className="asset-valuation"><div><b>库存参考价：{detail.value===null?'待估值':money(detail.value)}</b><p><QuoteSource source={detail.valueSource} updated={detail.valueUpdated} request={{skinId:detail.skinId,wear:detail.wear,version:detail.version}}/></p><small>仅作为同款、同版本、同外观的基础估值，不代表特殊模板或渐变率的溢价。</small></div><Button onClick={()=>refreshValue(detail)}>获取最新参考价</Button></div>}
            <Tabs
              items={[
                {
                  key: "profile",
                  label: "档案与属性",
                  children: (
                    <>
                      <Descriptions
                        column={2}
                        items={[
                          {
                            key: "float",
                            label: "原始磨损",
                            children: detail.float,
                          },
                          {
                            key: "pattern",
                            label: "图案模板",
                            children: detail.template,
                          },
                          ...(specialFields(detailSkin).fade?[{key:'fade',label:'渐变率',children:detail.fade?detail.fade+'%':'待确认'}]:[]),
                          ...(detail.style?[{key:'style',label:'特殊款式',children:localizedText(detail.style)}]:[]),
                          {
                            key: "collection",
                            label: "所属目录",
                            children: detailSkin?<button className="text-link" onClick={()=>{setDetailId(null);setEditing(false);openCollection(detailSkin.id);}}>{detail.collection} · 在收藏室查看 →</button>:detail.collection,
                          },
                          {
                            key: "date",
                            label: "取得日期",
                            children: detail.date,
                          },
                          { key: "id", label: "内部 ID", children: detail.id },
                          {
                            key: "source",
                            label: "数据来源",
                            children: detail.acquisition ? "手工录入" : "导入 / 历史记录",
                          },
                        ]}
                      />
                      <div className="note-box">
                        <b>备注</b>
                        <p>{detail.note || "暂无备注"}</p>
                      </div>
                      {editing ? (
                        <Form
                          form={editForm}
                          layout="vertical"
                          onFinish={(v) => {
                            let attributes={};try{if(detailSkin&&detail.kind==='饰品')attributes=cleanAssetAttributes(v,detailSkin,detail.wear);}catch(e){message.error((e as Error).message);return;}
                            const value=v.referenceValue==null?null:Math.round(v.referenceValue*100);
                            setState((s) => ({
                              ...s,
                              assets: s.assets.map((a) =>
                                a.id === detail.id
                                  ? { ...a, note: v.note, tags: v.tags,...attributes,...(a.kind==='饰品'&&value!==a.value?{value,valueSource:value===null?'':'用户手动参考价',valueManual:value!==null,valueUpdated:new Date().toISOString()}:{}) }
                                  : a,
                              ),
                            }));
                            setEditing(false);
                            message.success("资产档案已更新");
                          }}
                        >
                          {detail.kind==='饰品'&&<><AssetAttributes skin={detailSkin} wear={detail.wear}/><Form.Item name="referenceValue" label="手动参考价（元）" extra="可覆盖自动参考价；留空表示待估值。"><InputNumber min={0} max={100000000} precision={2} style={{width:'100%'}}/></Form.Item></>}
                          <Form.Item name="tags" label="用途">
                            <Select
                              mode="multiple"
                              options={[
                                "出租",
                                "个人自用",
                                "收藏",
                                "倒余额",
                              ].map((value) => ({ value }))}
                            />
                          </Form.Item>
                          <Form.Item name="note" label="备注">
                            <Input.TextArea maxLength={1000} />
                          </Form.Item>
                          <Button htmlType="submit" type="primary">
                            保存修改
                          </Button>{" "}
                          <Button onClick={() => setEditing(false)}>
                            取消
                          </Button>
                        </Form>
                      ) : (
                        <Space>
                          <Button
                            onClick={() => {
                              editForm.setFieldsValue({
                                note: detail.note,
                                tags: detail.tags,
                                float:detail.float==='待确认'?'':detail.float,template:detail.template==='待确认'?'':detail.template,fade:detail.fade,style:localizedText(detail.style||''),referenceValue:detail.value===null?null:detail.value/100,
                              });
                              setEditing(true);
                            }}
                          >
                            编辑属性、估值与备注
                          </Button>
                          {detail.status === "持有中" &&
                            detail.kind === "饰品" && (
                              <Popconfirm
                                title="记录赠出这件资产？"
                                description="将退出当前收藏，保留成本和历史租金。按今天记录赠出日期。"
                                onConfirm={() => {
                                  setState((s) => ({
                                    ...s,
                                    assets: s.assets.map((a) =>
                                      a.id === detail.id
                                        ? {
                                            ...a,
                                            status: "已赠出",
                                            note: `${a.note}\n赠出日期：${new Date().toLocaleDateString("sv-SE")}`,
                                          }
                                        : a,
                                    ),
                                  }));
                                  message.success(
                                    "已记录赠出，收藏拥有状态同步更新",
                                  );
                                }}
                              >
                                <Button>记录赠出</Button>
                              </Popconfirm>
                            )}
                        </Space>
                      )}
                    </>
                  ),
                },
                {
                  key: "orders",
                  label: `关联订单 (${detailOrders.length})`,
                  children: (
                    <Table
                      rowKey="id"
                      dataSource={detailOrders}
                      pagination={false}
                      columns={[
                        {
                          title: "日期 / 业务",
                          render: (_, o) => (
                            <>
                              {o.date}
                              <br />
                              {o.type} · {o.platform}
                            </>
                          ),
                        },
                        { title: "状态", dataIndex: "status" },
                        { title: "金额", dataIndex: "amount", render: money },
                      ]}
                    />
                  ),
                },
                {
                  key: "timeline",
                  label: "持有时间线",
                  children: (
                    <Timeline
                      items={[
                        { title: detail.date, content: "取得 / 观察到资产" },
                        ...detailOrders
                          .filter((o) => o.type !== "购买")
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map((o) => ({
                            title: o.date,
                            content: `${o.type} · ${o.status} · ${money(o.amount)}`,
                          })),
                        ...(detail.status !== "持有中"
                          ? [
                              {
                                title: detail.status,
                                content:
                                  "当前持有周期已结束；保留历史收入与成本。",
                              },
                            ]
                          : []),
                      ]}
                    />
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>
      <Modal
        title="新增记录"
        open={modal}
        onCancel={() => {if(!saving)setModal(false);}}
        confirmLoading={saving}
        cancelButtonProps={{disabled:saving}}
        onOk={save}
        okText="保存记录"
        cancelText="取消"
        width={600}
      >
        <Alert
          type="info"
          showIcon
          title="记录保存于本机账本，可在设置导出完整备份。"
          className="form-alert"
        />
        <Form
          name="asset-entry"
          form={form}
          layout="vertical"
          initialValues={{
            kind: "饰品",
            platform: "BUFF",
            version: "普通",
            wear: "久经沙场",
            acquisition: "购买",
            valuation:'自动参考价',direction:'支出',
            date: new Date().toLocaleDateString("sv-SE"),
            tags: ["收藏"],
          }}
        >
          <div className="form-grid">
            <Form.Item name="kind" label="记录类型">
              <Select
                options={["饰品", "公共收支"].map((value) => ({ value }))}
              />
            </Form.Item>
            {(assetKind==='公共收支'||acquisition!=='受赠')&&<Form.Item name="platform" label="所属平台" rules={[{required:true}]}>
              <Select options={platformNames.map((value) => ({ value }))} />
            </Form.Item>}
          </div>
          {assetKind === "公共收支" ? (
            <><Form.Item
              name="name"
              label="公共收支总项名称"
              rules={[{ required: true, whitespace: true }]}
            >
              <Input maxLength={100} />
            </Form.Item><Form.Item name="subitemName" label="首个子项名称"><Input placeholder="例如 手续费、放心租费用；留空为未分类支出" maxLength={100}/></Form.Item><Form.Item name="direction" label="收支方向"><Select options={[{value:'支出'},{value:'收入'}]}/></Form.Item></>
          ) : (
            <>
              <Form.Item
                name="skinId"
                label="选择商品"
                rules={[{ required: true, message: "请选择商品" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
              filterOption={searchOption}
                  filterSort={(a,b,info)=>a?.label===info.searchValue?-1:b?.label===info.searchValue?1:0}
                  onChange={() =>
                    form.setFieldsValue({ version: "普通", wear: undefined,float:undefined,template:undefined,fade:undefined,style:undefined,referenceValue:undefined })
                  }
                  options={skins.map((s) => ({ value: s.id, label: s.label,searchText:s.label+" "+s.english+" "+(s.phase||"") }))}
                />
              </Form.Item>
              <div className="form-grid">
                <Form.Item name="version" label="版本">
                  <Select
                    options={[
                      { value: "普通" },
                      ...(skin?.stattrak ? [{ value: "StatTrak™" }] : []),
                      ...(skin?.souvenir ? [{ value: '纪念品' }] : []),
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="wear"
                  label="外观等级"
                  rules={[
                    { required: true, message: "请选择该商品支持的外观" },
                  ]}
                >
                  <Select
                    options={(
                      skin?.wears || [
                        "Factory New",
                        "Minimal Wear",
                        "Field-Tested",
                        "Well-Worn",
                        "Battle-Scarred",
                      ]
                    ).map((w) => ({
                      value:
                        (
                          {
                            "Factory New": "崭新出厂",
                            "Minimal Wear": "略有磨损",
                            "Field-Tested": "久经沙场",
                            "Well-Worn": "破损不堪",
                            "Battle-Scarred": "战痕累累",
                          } as Record<string, string>
                        )[w] || w,
                    }))}
                  />
                </Form.Item>
              </div>
              <Form.Item name="acquisition" label="取得方式">
                <Select
                  options={["购买", "受赠", "待核对"].map((value) => ({
                    value,
                  }))}
                />
              </Form.Item>
              {acquisition==='受赠'&&<p className="muted">受赠饰品按明确零成本记录，不指定所属平台。</p>}
              <AssetAttributes skin={skin} wear={wear}/>
              <Form.Item name="valuation" label="库存估值方式"><Select options={[{value:'自动参考价'},{value:'手动输入'}]}/></Form.Item>
              {valuation==='手动输入'?<Form.Item name="referenceValue" label="参考价（元）" rules={[{required:true,message:'请输入参考价'}]}><InputNumber min={0} max={100000000} precision={2} style={{width:'100%'}}/></Form.Item>:<p className="muted">保存时获取 SteamDT 最近 24 小时内可用的平台最低参考价，按人民币元计；无报价则待估值。特殊属性溢价可在档案手动覆盖。</p>}
            </>
          )}
          <div className="form-grid">
            {(assetKind === "公共收支" || acquisition === "购买") && (
              <Form.Item
                name="cost"
                label={
                  assetKind === "公共收支" ? "子项初始金额（元）" : "实付成本（元）"
                }
                rules={[{ required: true, message: "请填写金额" }]}
              >
                <InputNumber
                  min={0}
                  max={100000000}
                  precision={2}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            )}
            <Form.Item
              name="date"
              label="记账日期"
              rules={[
                { required: true, message: "请选择日期" },
                { pattern: /^\d{4}-\d{2}-\d{2}$/, message: "请填写完整日期" },
              ]}
            >
              <Input type="date" max={new Date().toLocaleDateString("sv-SE")} />
            </Form.Item>
          </div>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="选择金额列"
        open={columnsOpen}
        footer={
          <Button type="primary" onClick={() => setColumnsOpen(false)}>
            完成
          </Button>
        }
        onCancel={() => setColumnsOpen(false)}
      >
        <Checkbox.Group
          value={visible}
          onChange={(v) => setVisible(v.map(String))}
          options={[
            { value: 'value',label:'库存参考价' },
            { value: "cost", label: "购买成本" },
            { value: "rent", label: "累计租金" },
            { value: "sale", label: "出售收入" },
            { value: "net", label: "已实现净收益" },
            { value: "cash", label: "收支差额" },
          ]}
        />
        <p className="muted">身份列始终固定，横向滚动时仍能识别饰品。</p>
      </Modal>
    </>
  );
}

