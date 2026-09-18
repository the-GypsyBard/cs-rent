import { useEffect, useRef, useState, type ReactNode } from "react";
import { Tag, Empty, Button, Tooltip } from "antd";
import {
  ArrowRightOutlined,
  InfoCircleOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import * as echarts from "echarts/core";
import { LineChart, BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);
export function PageHead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{actions}</div>
    </div>
  );
}
export function Panel({
  title,
  extra,
  children,
  className = "",
}: {
  title?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || extra) && (
        <div className="panel-heading">
          <h2>{title}</h2>
          {extra}
        </div>
      )}
      {children}
    </section>
  );
}
export function Pill({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`pill ${tone}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
export function ItemArt({
  src,
  name,
  rarity,
  large = false,
}: {
  src: string;
  name: string;
  rarity?: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div
      className={`item-art ${large ? "large" : ""}`}
      style={{ "--rarity": rarity || "#7f8aab" } as React.CSSProperties}
    >
      {src && !failed ? <img key={src} src={src} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : src ? <span className="art-placeholder" aria-label="图片暂不可用">◇</span> : <WalletOutlined aria-hidden="true" />}
    </div>
  );
}
export function Metric({
  label,
  value,
  note,
  tone,
  help,
}: {
  label: string;
  value: string;
  note: string;
  tone?: string;
  help?: string;
}) {
  return (
    <div className={`metric ${tone || ""}`}>
      <div className="metric-label">
        {label}{" "}
        {help && (
          <Tooltip title={help}>
            <InfoCircleOutlined aria-hidden="true" />
          </Tooltip>
        )}
      </div>
      <strong>{value}</strong>
      <span>{note}</span>
    </div>
  );
}
export function EmptyState({
  title = "暂无记录",
  description = "可以添加示例记录，或到设置恢复验收示例。",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-wrap">
      <Empty
        description={
          <>
            <b>{title}</b>
            <p>{description}</p>
          </>
        }
      />
      {action}
    </div>
  );
}
export function LinkButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button type="link" onClick={onClick}>
      {children}
      <ArrowRightOutlined aria-hidden="true" />
    </Button>
  );
}
export function SourceTag() {
  return (
    <Tag variant="filled" color="blue">
      示例数据
    </Tag>
  );
}
export function TrendChart({
  dark,
  dates,
  series,
}: {
  dark: boolean;
  dates: string[];
  series: { name: string; data: number[]; color: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption({
      animation: false,
      textStyle: { fontFamily: "Segoe UI, Microsoft YaHei, sans-serif" },
      grid: { left: 55, right: 28, top: 25, bottom: 65 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: number) =>
          `¥ ${v.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`,
      },
      legend: {
        bottom: 5,
        itemWidth: 16,
        itemHeight: 3,
        textStyle: { color: dark ? "#abb7ca" : "#6a7689" },
        icon: "roundRect",
      },
      xAxis: {
        type: "category",
        data: dates,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: dark ? "#93a0b5" : "#8490a1", margin: 16 },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: dark ? "#93a0b5" : "#8490a1",
          formatter: (v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v,
        },
        splitLine: {
          lineStyle: { color: dark ? "#29364a" : "#edf0f5", type: "dashed" },
        },
      },
      series: series.map((s, i) => ({
        name: s.name,
        type: "line",
        data: s.data,
        smooth: false,
        symbol: "circle",
        symbolSize: 5,
        showSymbol: false,
        lineStyle: { width: 2.5 },
        itemStyle: { color: s.color },
        areaStyle:
          i === 0
            ? {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: dark ? "#526ee522" : "#5873ea22" },
                  { offset: 1, color: "#5873ea00" },
                ]),
              }
            : undefined,
      })),
    });
    const resize = new ResizeObserver(() => chart.resize());
    resize.observe(ref.current);
    return () => {
      resize.disconnect();
      chart.dispose();
    };
  }, [dark, dates, series]);
  return (
    <div
      ref={ref}
      className="trend-chart"
      role="img"
      aria-label="按示例账本日期生成的金额趋势图"
    />
  );
}

