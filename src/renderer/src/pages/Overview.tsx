import { useMemo, useState } from "react";
import { Button, Select, Segmented, Progress, Tooltip } from "antd";
import {
  ArrowRightOutlined,
  SyncOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { useStore } from "../store";
import { RentalIncome } from './RentalIncome';
import {
  assetMetrics,
  money,
  platformNames,
  totals,
  type Page,
} from "../model";
import {
  PageHead,
  Panel,
  Metric,
  ItemArt,
  Pill,
  TrendChart,
  EmptyState,
} from "../components";
export function Overview({
  dark,
  navigate,
}: {
  dark: boolean;
  navigate: (p: Page, pending?: boolean) => void;
}) {
  const { state } = useStore();
  const [platform, setPlatform] = useState("全部平台");
  const [trend, setTrend] = useState("累计走势");
  const assets = state.assets.filter(
    (a) => platform === "全部平台" || (a.platform||'无所属平台') === platform,
  );
  const included = new Set(assets.map((a) => a.id));
  const orders = state.orders.filter(
    (o) => o.assetId && included.has(o.assetId),
  );
  const t = totals(assets, orders);
  const held = assets.filter((a) => a.kind === "饰品" && a.status === "持有中");
  const { dates, series } = useMemo(() => {
    const dates = [
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ];
    const cumulative = trend === "累计走势";
    const within = (date: string, m: string) =>
      cumulative ? date.slice(0, 7) <= m : date.slice(0, 7) === m;
    return {
      dates: dates.map((d) => d.slice(5) + "月"),
      series: [
        {
          name: "购买成本",
          color: "#6578e8",
          data: dates.map(
            (m) =>
              assets
                .filter((a) => a.kind === "饰品" && within(a.date, m))
                .reduce((s, a) => s + (a.cost || 0), 0) / 100,
          ),
        },
        {
          name: "已结算租金",
          color: "#36a995",
          data: dates.map(
            (m) =>
              orders
                .filter(
                  (o) =>
                    o.type === "出租" &&
                    o.status === "已完成" &&
                    !!o.settledAt && within(o.settledAt, m),
                )
                .reduce((s, o) => s + o.amount, 0) / 100,
          ),
        },
        {
          name: "出售收入",
          color: "#d5a461",
          data: dates.map(
            (m) =>
              orders
                .filter(
                  (o) =>
                    o.type === "出售" &&
                    o.status === "已完成" &&
                    within(o.date, m),
                )
                .reduce((s, o) => s + o.amount, 0) / 100,
          ),
        },
      ],
    };
  }, [state, platform, trend]);
  const pending = state.orders.filter((o) => o.status === "待核对").length;
  return (
    <>
      <PageHead
        eyebrow="PORTFOLIO OVERVIEW"
        title="每一件饰品，都有迹可循。"
        description="从资产到收益，在这里看清你的整个收藏与租赁账本。"
        actions={
          <>
            <Button icon={<PlusOutlined aria-hidden="true" />} onClick={() => navigate("assets")}>
              记录资产
            </Button>
            <Button
              type="primary"
              icon={<SyncOutlined aria-hidden="true" />}
              onClick={() => navigate("sync")}
            >
              同步中心
            </Button>
          </>
        }
      />
      <div className="scope-line">
        <div className="scope-tabs">
          <b>资产概况</b>
          <span>全历史 · CNY</span>
        </div>
        <Select
          aria-label="总览所属平台筛选"
          value={platform}
          onChange={setPlatform}
          options={["全部平台", ...platformNames,'无所属平台'].map((value) => ({
            value,
            label: value,
          }))}
        />
      </div>
      <div className="metrics-grid">
        <Metric
          label="购买总成本"
          value={money(t.cost)}
          note={
            t.unknown
              ? `已知成本合计 · ${t.unknown} 件成本待核对`
              : "全部已确认购入成本"
          }
          help="受赠的已知零成本与缺失成本分别处理；此处不含公共支出。"
        />
        <Metric
          label="累计租赁收入"
          value={money(t.rent)}
          note="仅计入已结束且完成结算的租金"
          tone="teal"
        />
        <Metric
          label="已实现净收益"
          value={money(t.net)}
          note="租金 + 已售出盈亏 + 公共收入 − 公共支出"
          tone="accent"
          help="持有中资产的购入成本尚不从已实现净收益扣除，赠出也不冲减已实现净收益。"
        />
        <Metric
          label="库存参考价值"
          value={held.length>0&&t.unvalued===held.length?'待估值':money(t.value)}
          note={`${held.length} 件当前持有 · ${t.unvalued} 件待估值 · 非成交承诺`}
        />
      </div>
      <div className="secondary-metrics">
        <span>
          出售收入 <b>{money(t.sale)}</b>
        </span>
        <span>
          公共支出 <b>{money(t.expense)}</b>
        </span>
        <span>公共收入 <b>{money(t.income)}</b></span>
        <span>
          累计收支差额{" "}
          <b className={t.cash < 0 ? "negative" : "positive"}>
            {money(t.cash)}
          </b>
        </span>
        <Tooltip title="原型暂未实现租期并集、成本天数和完整年化计算。">
          <span>
            加权年化 <b>待业务实现</b>
          </span>
        </Tooltip>
      </div>
      {!assets.length ? (
        <Panel>
          <EmptyState
            action={
              <Button onClick={() => navigate("settings")}>
                前往设置恢复示例
              </Button>
            }
          />
        </Panel>
      ) : (
        <>
          <RentalIncome orders={orders} dark={dark} />
          <div className="dashboard-grid">
            <Panel
              title="收支走势"
              extra={
                <Segmented
                  size="small"
                  value={trend}
                  onChange={(v) => setTrend(String(v))}
                  options={["累计走势", "月度收支"]}
                />
              }
            >
              <div className="chart-caption">
                按资产所属平台筛选 · 日期来自示例账本{" "}
                <span>单位：人民币元</span>
              </div>
              <TrendChart dark={dark} dates={dates} series={series} />
            </Panel>
            <Panel
              title="资产分布"
              extra={<span className="muted">当前持有</span>}
            >
              <div className="distribution-total">
                <strong>{held.length}</strong>
                <span>件饰品</span>
                <Pill tone="green">所有权口径</Pill>
              </div>
              <div className="stacked-bar">
                {[...platformNames,'无所属平台'].map((p, i) => {
                  const count = held.filter((a) => (a.platform||'无所属平台') === p).length;
                  return (
                    <div
                      key={p}
                      style={{
                        width: `${(count / Math.max(held.length, 1)) * 100}%`,
                        background: [
                          "#6679e8",
                          "#56b7a4",
                          "#d5aa68",
                          "#8892a6","#b292c8",
                        ][i],
                      }}
                    />
                  );
                })}
              </div>
              <div className="distribution-list">
                {[...platformNames,'无所属平台'].map((p, i) => {
                  const list = held.filter((a) => (a.platform||'无所属平台') === p);
                  return (
                    <div key={p}>
                      <span
                        className="legend-dot"
                        style={{
                          background: [
                            "#6679e8",
                            "#56b7a4",
                            "#d5aa68",
                            "#8892a6","#b292c8",
                          ][i],
                        }}
                      />
                      <span>{p}</span>
                      <b>{list.length} 件</b>
                      <small>
                        {Math.round(
                          (list.length / Math.max(held.length, 1)) * 100,
                        )}
                        %
                      </small>
                    </div>
                  );
                })}
              </div>
              <div className="soft-note">
                <CheckCircleFilled aria-hidden="true" /> 出租中的饰品仍计入当前持有
              </div>
            </Panel>
          </div>
          <div className="dashboard-grid bottom">
            <Panel
              title="关注资产"
              extra={
                <Button type="link" onClick={() => navigate("assets")}>
                  查看全部 <ArrowRightOutlined aria-hidden="true" />
                </Button>
              }
            >
              <div className="watch-list">
                {held.slice(0, 4).map((a) => (
                  <button
                    className="watch-row"
                    key={a.id}
                    onClick={() => navigate("assets")}
                  >
                    <ItemArt src={a.image} name={a.name} rarity={a.rarity} />
                    <div className="watch-name">
                      <b>{a.name}</b>
                      <small>
                        {a.wear} · {a.platform||'无所属平台'}
                      </small>
                    </div>
                    <Pill tone={a.rental === "出租中" ? "green" : "gray"}>
                      {a.rental}
                    </Pill>
                    <div className="watch-amount">
                      <b>{money(assetMetrics(a, orders).rent)}</b>
                      <small>累计已结算租金</small>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel
              title="需要留意"
              extra={
                <span className="notice-count">
                  {pending +
                    t.unknown +
                    state.orders.filter((o) => o.status === "待结算").length}
                </span>
              }
            >
              <button
                className="attention-row"
                onClick={() => navigate("orders", true)}
              >
                <div className="attention-icon amber">
                  <ExclamationCircleOutlined aria-hidden="true" />
                </div>
                <div>
                  <b>订单等待关联</b>
                  <small>核对候选资产，避免重复或错误归集</small>
                </div>
                <strong>{pending}</strong>
                <ArrowRightOutlined aria-hidden="true" />
              </button>
              <button
                className="attention-row"
                onClick={() => navigate("assets")}
              >
                <div className="attention-icon purple">
                  <ExclamationCircleOutlined aria-hidden="true" />
                </div>
                <div>
                  <b>取得成本待补充</b>
                  <small>未知成本保留为空，不按零计算</small>
                </div>
                <strong>{t.unknown}</strong>
                <ArrowRightOutlined aria-hidden="true" />
              </button>
              <button
                className="attention-row"
                onClick={() => navigate("orders")}
              >
                <div className="attention-icon blue">
                  <ClockCircleOutlined aria-hidden="true" />
                </div>
                <div>
                  <b>租赁尚未结算</b>
                  <small>完成结算前不会计入收益</small>
                </div>
                <strong>
                  {state.orders.filter((o) => o.status === "待结算").length}
                </strong>
                <ArrowRightOutlined aria-hidden="true" />
              </button>
              <div className="review-note">
                <b>把账算清，再看收益。</b>
                <p>
                  所有汇总都应能追溯到具体记录。原型中可在资产详情查看金额组成。
                </p>
                <Button type="link" onClick={() => navigate("orders")}>
                  打开订单中心 <ArrowRightOutlined aria-hidden="true" />
                </Button>
              </div>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

