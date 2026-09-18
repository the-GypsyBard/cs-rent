import {matchesSearch,searchOption,localizedText,styleLabel} from '../../../shared/presentation';
import { useState } from "react";
import {
  App,
  Button,
  Input,
  Select,
  Modal,
  Form,
  InputNumber,
  Tag,
  Popconfirm,
  Alert,
  Segmented,
  AutoComplete,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  HeartOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useCatalogSkins } from '../catalog-store';
import { useStore, addWish } from "../store";
import { money, wishStatus, type Wish } from "../model";
import { PageHead, ItemArt, Pill, EmptyState } from "../components";
import { cleanTargets,floatBounds,lowestPlatform,specialFields,targetDescription } from '../../../shared/market';
import { openMarket } from '../market-link';
export function Wishlist() {
  const skins = useCatalogSkins();
  const { state, setState } = useStore();
  const { message } = App.useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("全部愿望");
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Wish | null>(null);
  const [form] = Form.useForm();
  const selected = Form.useWatch("skinId", form);
  const selectedWear = Form.useWatch("wear", form);
  const skin = skins.find((s) => s.id === selected);
  const bounds=skin?floatBounds(skin,selectedWear):undefined;
  const fields=specialFields(skin);
  const [opening,setOpening]=useState<string|null>(null);
  async function openWish(w:Wish,steamdt=false){setOpening(w.id);try{message.info(await openMarket({skinId:w.skinId,wear:w.wear,version:w.version,...(!steamdt?{platform:lowestPlatform(w)}:{})}));}catch(e){message.error((e as Error).message);}finally{setOpening(null);}}
  async function save() {
    const v = await form.validateFields();
    const s = skins.find((m) => m.id === v.skinId)!;
    let targets;try{targets=cleanTargets(v.targets||{},s,v.wear);}catch(e){message.error((e as Error).message);return;}
    if (editing) {
      const unchanged =
        editing.skinId === s.id &&
        editing.wear === v.wear &&
        editing.version === v.version;
      setState((prev) => ({
        ...prev,
        wishes: prev.wishes.map((w) =>
          w.id === editing.id
            ? {
                ...w,
                skinId: s.id,
                name: s.label,
                image: s.image,
                wear: v.wear,
                version: v.version,
                target: Math.round(v.target * 100),
                special: v.special || "",
                targets,
                ...(!unchanged
                  ? {
                      buff: null,
                      youpin: null,
                      igxe: null,
                      updated: "尚未刷新",
                      currencyKnown: true,
                    }
                  : {}),
              }
            : w,
        ),
      }));
    } else {
      setState((prev) =>
        addWish(prev, {
          id: crypto.randomUUID(),
          skinId: s.id,
          name: s.label,
          image: s.image,
          wear: v.wear,
          version: v.version,
          target: Math.round(v.target * 100),
          buff: null,
          youpin: null,
          igxe: null,
          special: v.special || "",
          targets,
          currencyKnown: true,
          updated: "尚未刷新",
        }),
      );
    }
    setOpened(false);
    message.success("愿望已保存在原型中");
  }
  const [refreshing,setRefreshing]=useState(false);
  async function refresh() {
    if(refreshing)return;setRefreshing(true);let succeeded=0,failed=0;
    try{for(const wish of state.wishes){
      let patch:Partial<Wish>;
      try{
        const quote=await window.desktop?.quote({skinId:wish.skinId,wear:wish.wear,version:wish.version,refresh:true});
        if(!quote?.ok)throw Error(quote?.error||'请在桌面应用中刷新报价');
        if(quote.kind==='style-close')throw Error('官方 API 仅提供此款式的收盘参考价，请到收藏室查看；不能代替平台当前在售价。');
        const prices=quote.prices||[];const pick=(platform:string)=>prices.find(p=>p.platform===platform)?.cents??null;
        patch={buff:pick('BUFF'),youpin:pick('悠悠有品'),igxe:pick('IGXE'),updated:quote.updated||new Date().toISOString(),currencyKnown:true,failed:false,quoteError:undefined};succeeded++;
      }catch(e){patch={failed:true,quoteError:(e as Error).message};failed++;}
      setState(current=>({...current,wishes:current.wishes.map(w=>w.id===wish.id&&w.skinId===wish.skinId&&w.wear===wish.wear&&w.version===wish.version?{...w,...patch}:w)}));
    }
    if(succeeded)message.success('已通过 SteamDT 官方 API 刷新 '+succeeded+' 个愿望');if(failed)message.warning(failed+' 个愿望未取得有效在售价，已保留旧报价并标注原因');
    }finally{setRefreshing(false);}
  }
  const shown = state.wishes.filter(
    (w) =>
      matchesSearch(w.name,query) &&
      (filter === "全部愿望" ||
        (filter === "报价达标" && wishStatus(w) === "已获取报价达标") ||
        (filter === "需要核实" &&
          wishStatus(w) !== "已获取报价达标" &&
          wishStatus(w) !== "未达目标价")),
  );
  return (
    <>
      <PageHead
        eyebrow="YOUR NEXT FIND"
        title="愿望单"
        description="记录心仪的饰品，让价格与目标条件都有据可查。"
        actions={
          <>
            <Button
              icon={<ReloadOutlined aria-hidden="true" />}
              onClick={refresh}
              disabled={!state.wishes.length} loading={refreshing}
            >
              刷新 SteamDT 报价
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined aria-hidden="true" />}
              onClick={() => {
                setEditing(null);
                form.resetFields();
                setOpened(true);
              }}
            >
              添加愿望
            </Button>
          </>
        }
      />
      <div className="wishlist-summary">
        <div>
          <HeartOutlined aria-hidden="true" />
          <span>
            <b>{state.wishes.length}</b> 个心愿
          </span>
        </div>
        <div>
          <span className="online-dot" />
          <span>
            <b>
              {
                state.wishes.filter((w) => wishStatus(w) === "已获取报价达标")
                  .length
              }
            </b>{" "}
            个已获取报价达标
          </span>
        </div>
        <small>人民币元 · 缺失平台不视为零价；特殊条件仍需核实</small>
      </div>
      <div className="standalone-toolbar">
        <Segmented
          value={filter}
          onChange={(v) => setFilter(String(v))}
          options={["全部愿望", "报价达标", "需要核实"]}
        />
        <Input
          aria-label="搜索愿望"
          prefix={<SearchOutlined aria-hidden="true" />}
          placeholder="搜索心仪饰品"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
          style={{ width: 250 }}
        />
      </div>
      {shown.length ? (
        <div className="wish-grid">
          {shown.map((w) => {
            const status = wishStatus(w);
            const known = [w.buff, w.youpin, w.igxe].filter(
              (v): v is number => v !== null,
            );
            const price = known.length ? Math.min(...known) : null;
            return (
              <article className="wish-card" key={w.id}>
                <div className="wish-art">
                  <button className="wish-item-image" aria-label={`在 SteamDT 查看${localizedText(w.name)}`} title="打开此饰品的 SteamDT 页面" disabled={opening===w.id} onClick={()=>openWish(w,true)}><ItemArt src={w.image} name={localizedText(w.name)} large /></button>
                  <div className="wish-tools">
                    <Button
                      type="text"
                      aria-label={`编辑${localizedText(w.name)}`}
                      icon={<EditOutlined aria-hidden="true" />}
                      onClick={() => {
                        setEditing(w);
                        form.resetFields();
                        form.setFieldsValue({ ...w, targets:{...w.targets,style:styleLabel(w.targets?.style)}, target: w.target / 100 });
                        setOpened(true);
                      }}
                    />
                    <Popconfirm
                      title="移除这个示例愿望？"
                      onConfirm={() =>
                        setState((s) => ({
                          ...s,
                          wishes: s.wishes.filter((x) => x.id !== w.id),
                        }))
                      }
                    >
                      <Button
                        type="text"
                        aria-label={`移除${localizedText(w.name)}`}
                        icon={<DeleteOutlined aria-hidden="true" />}
                      />
                    </Popconfirm>
                  </div>
                  <span className="wish-number">
                    WISHLIST / {w.id.slice(0, 4).toUpperCase()}
                  </span>
                </div>
                <div className="wish-content">
                  <h2><button className="wish-item-name" title="打开此饰品的 SteamDT 页面" disabled={opening===w.id} onClick={()=>openWish(w,true)}>{localizedText(w.name)}<small aria-hidden="true"> ↗</small></button></h2>
                  <div className="wish-tags">
                    <Tag>{w.version}</Tag>
                    <Tag>{w.wear}</Tag>
                  </div>
                  <div className="wish-price">
                    <div>
                      <span>
                        已获取最低参考{w.currencyKnown ? "价" : "数值"}
                      </span>
                      <strong>
                        {price === null
                          ? "暂无报价"
                          : w.currencyKnown
                            ? money(price)
                            : (price / 100).toLocaleString("zh-CN", {
                                minimumFractionDigits: 2,
                              })}
                      </strong>
                    </div>
                    <div>
                      <span>目标买入价</span>
                      <b>{money(w.target)}</b>
                    </div>
                  </div>
                  <div className="quote-table">
                    {[
                      ["BUFF", w.buff],
                      ["悠悠有品", w.youpin],
                      ["IGXE", w.igxe],
                    ].map(([p, v]) => (
                      <div key={String(p)}>
                        <span>{p}</span>
                        <b>
                          {v === null
                            ? "未获取"
                            : w.currencyKnown
                              ? money(Number(v))
                              : (Number(v) / 100).toLocaleString("zh-CN", {
                                  minimumFractionDigits: 2,
                                })}
                        </b>
                      </div>
                    ))}
                  </div>
                  <div className="wish-result">
                    <button className="wish-link" disabled={opening===w.id} title="打开最低参考价平台；链接缺失时打开 SteamDT" onClick={()=>openWish(w)}>
                    <Pill
                      tone={
                        status === "已获取报价达标"
                          ? "green"
                          : status === "未达目标价"
                            ? "gray"
                            : "amber"
                      }
                    >
                      {status}
                    </Pill>
                    <span>{opening===w.id?'正在打开…':'查看详情 ↗'}</span>
                    </button>
                    <small>{w.updated}</small>
                  </div>
                  {(w.special || targetDescription(w.targets)) && (
                    <button className="wish-caveat wish-link" onClick={()=>openWish(w)} disabled={opening===w.id}>
                      {[w.special,targetDescription(w.targets)].filter(Boolean).join(' · ')} · 当前报价未证明符合特殊条件。 ↗
                    </button>
                  )}
                  {!w.currencyKnown && (
                    <p className="wish-caveat">
                      币种尚未确认，不能正式判断是否达到目标价。
                    </p>
                  )}
                  {w.failed && (
                    <p className="wish-caveat">
                      {w.quoteError||'刷新失败：保留最近报价，本次没有取得新报价。'}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="这里还没有心愿"
          action={
            <Button
              onClick={() => {
                setEditing(null);
                form.resetFields();
                setOpened(true);
              }}
            >
              添加第一个愿望
            </Button>
          }
        />
      )}
      <div className="bottom-note">
        SteamDT
        行情刷新与交易平台订单同步分开执行。特殊属性匹配不足时，不自动判定目标达成。
      </div>
      <Modal
        title={editing ? "编辑愿望" : "添加愿望"}
        open={opened}
        onCancel={() => setOpened(false)}
        onOk={save}
        okText="保存愿望"
        cancelText="取消"
      >
        <Form name="wish-entry" form={form} layout="vertical" initialValues={{ version: "普通" }}>
          <Form.Item
            name="skinId"
            label="商品"
            rules={[{ required: true, message: "请选择商品" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              filterOption={searchOption}
              filterSort={(a,b,info)=>a?.label===info.searchValue?-1:b?.label===info.searchValue?1:0}
              options={skins.map((s) => ({ value: s.id, label: s.label,searchText:s.label+" "+s.english+" "+(s.phase||"") }))}
              onChange={() =>
                form.setFieldsValue({ version: "普通", wear: undefined,targets:{template:'',floatMin:'',floatMax:'',fadeMin:'',fadeMax:'',style:undefined},special:'' })
              }
            />
          </Form.Item>
          <div className="form-grid">
            <Form.Item name="version" label="版本">
              <Select
                options={[
                  { value: "普通" },
                  ...(skin?.stattrak ? [{ value: "StatTrak™" }] : []),
                  ...(skin?.souvenir ? [{value:'纪念品'}] : []),
                ]}
              />
            </Form.Item>
            <Form.Item
              name="wear"
              label="外观"
              rules={[{ required: true, message: "请选择外观" }]}
            >
              <Select
                options={(skin?.wears || []).map((w) => ({
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
          <Form.Item
            name="target"
            label="目标买入价（人民币元）"
            rules={[{ required: true, message: "请输入目标价" }]}
          >
            <InputNumber
              min={0.01}
              max={100000000}
              precision={2}
              style={{ width: "100%" }}
            />
          </Form.Item>
          {skin && <div className="special-targets"><h3>特殊目标条件 <small>选填</small></h3>
            {fields.template && <Form.Item name={['targets','template']} label="图案模板"><Input placeholder="0–1000，例如 387" maxLength={4}/></Form.Item>}
            {fields.float && bounds && <><p className="float-range" data-testid="float-range">{bounds.known?`皮肤磨损范围：${skin.minFloat}–${skin.maxFloat}`:'皮肤磨损范围待核实，暂按 0–1 校验'}{selectedWear&&` · ${selectedWear}：${bounds.min}–${bounds.max}${bounds.maxExclusive?'（不含上界）':''}`}<br/>支持 0.001、0.0001 等小数，按原精度保存。范围来自饰品目录，手动刷新可同步；不是市场现存最低磨损纪录。</p><div className="form-grid"><Form.Item name={['targets','floatMin']} label="磨损下限"><Input inputMode="decimal" placeholder={`最低 ${bounds.min}，留空不限`} /></Form.Item><Form.Item name={['targets','floatMax']} label="磨损上限"><Input inputMode="decimal" placeholder={`最高 ${bounds.max}，留空不限`} /></Form.Item></div></>}
            {fields.fade && <div className="form-grid"><Form.Item name={['targets','fadeMin']} label="渐变率下限（%）"><Input placeholder="不限"/></Form.Item><Form.Item name={['targets','fadeMax']} label="渐变率上限（%）"><Input placeholder="不限"/></Form.Item></div>}
            {fields.style && <Form.Item name={['targets','style']} label={skin.phase?'多普勒款式':'特殊款式'}><AutoComplete allowClear placeholder="选填，可选择或自行输入" options={fields.styles.map(value=>({value:styleLabel(value)}))}><Input maxLength={80}/></AutoComplete></Form.Item>}
            {!fields.float&&!fields.template&&!fields.fade&&!fields.style&&<p className="muted">此饰品没有适用的特殊筛选条件。</p>}
          </div>}
          {editing?.special && <Form.Item name="special" label="原有特殊条件备注（可保留或迁入上方字段）">
            <Input.TextArea
              placeholder="例如：磨损 0.10 以下、图案模板 387"
              maxLength={1000}
            />
          </Form.Item>}
          <Alert
            type="info"
            title="SteamDT 价格默认按人民币元展示。特殊条件均可留空；参考报价不代表具体在售饰品已满足这些条件。"
          />
        </Form>
      </Modal>
    </>
  );
}

