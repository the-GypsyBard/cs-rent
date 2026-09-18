import { useEffect, useState } from "react";
import {
  App,
  Button,
  Checkbox,
  Select,
  Progress,
  Alert,
  Tag,
  Modal,
  Table,
  Radio,
  Space,
} from "antd";
import {
  SyncOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  StopOutlined,
  CheckCircleFilled,
  DesktopOutlined,
} from "@ant-design/icons";
import {
  platformNames,
  orderTypes,
  selectedTasks,
  type Platform,
  type OrderType,
} from "../model";
import { PageHead, Panel, Pill } from "../components";
import { useCatalog } from '../catalog-store';
type Task = {
  platform: Platform;
  type: OrderType;
  status: "排队中" | "运行中" | "模拟成功" | "模拟失败" | "已取消";
  progress: number;
  finished?: string;
  lastSuccess?: string;
};
type History = Record<
  string,
  { finished: string; status: string; success?: string }
>;
const supported = (p: Platform) =>
  orderTypes.filter((t) => !(p === "Steam" && t === "出租"));
const key = (p: string, t: string) => `${p}:${t}`;
const now = () =>
  new Date()
    .toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" })
    .slice(0, 16);
export function SyncCenter() {
  const catalog = useCatalog();
  const { message } = App.useApp();
  const [selection, setSelection] = useState<Record<string, string[]>>({
    IGXE: ["购买", "出租", "出售"],
    BUFF: ["购买", "出租", "出售"],
    悠悠有品: ["购买", "出租", "出售"],
    Steam: ["购买", "出售"],
  });
  const [mode, setMode] = useState("日常增量");
  const [outcome, setOutcome] = useState("部分失败");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [failurePlatform, setFailurePlatform] = useState<Platform>("BUFF");
  const [history, setHistory] = useState<History>({});
  const [report, setReport] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [activeMode, setActiveMode] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [failureEnabled, setFailureEnabled] = useState(true);
  const selected = selectedTasks(selection);
  const completed = tasks.filter(
    (t) => !["排队中", "运行中"].includes(t.status),
  ).length;
  const failed = tasks.filter((t) => t.status === "模拟失败").length;
  const percentage = tasks.length
    ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / tasks.length)
    : 0;
  useEffect(() => {
    if (!running || paused) return;
    const timer = setInterval(() => {
      setTasks((previous) => {
        const index = previous.findIndex((t) =>
          ["排队中", "运行中"].includes(t.status),
        );
        if (index < 0) return previous;
        return previous.map((t, i) => {
          if (i !== index) return t;
          const progress = Math.min(100, t.progress + 25);
          return {
            ...t,
            progress,
            status:
              progress === 100
                ? failureEnabled && t.platform === failurePlatform
                  ? "模拟失败"
                  : "模拟成功"
                : "运行中",
            finished: progress === 100 ? now() : undefined,
          };
        });
      });
    }, 450);
    return () => clearInterval(timer);
  }, [running, paused, failureEnabled, failurePlatform]);
  useEffect(() => {
    if (
      !running ||
      !tasks.length ||
      tasks.some((t) => ["排队中", "运行中"].includes(t.status))
    )
      return;
    setRunning(false);
    setHistory((previous) => {
      const next = { ...previous };
      for (const t of tasks) {
        const k = key(t.platform, t.type);
        next[k] = {
          finished: t.finished || now(),
          status: t.status,
          success: t.status === "模拟成功" ? t.finished : previous[k]?.success,
        };
      }
      return next;
    });
  }, [tasks, running]);
  function start() {
    setTasks(selected.map((t) => ({ ...t, status: "排队中", progress: 0 })));
    setFailurePlatform(
      selected.some((t) => t.platform === "BUFF")
        ? "BUFF"
        : selected[0].platform,
    );
    setFailureEnabled(outcome === "部分失败");
    setActiveMode(mode);
    setAttempt((v) => v + 1);
    setPaused(false);
    setRunning(true);
    setConfirm(false);
  }
  function cancel() {
    setTasks((ts) =>
      ts.map((t) =>
        ["排队中", "运行中"].includes(t.status)
          ? { ...t, status: "已取消", finished: now() }
          : t,
      ),
    );
    setPaused(false);
  }
  function retry() {
    const failures = tasks.filter((t) => t.status === "模拟失败");
    setTasks(
      failures.map((t) => ({
        ...t,
        status: "排队中",
        progress: 0,
        finished: undefined,
      })),
    );
    setFailureEnabled(false);
    setPaused(false);
    setRunning(true);
    setAttempt((v) => v + 1);
    message.info(`仅重试 ${failures.length} 个失败子项，演示恢复成功`);
  }
  const allSelected = platformNames.every(
    (p) => selection[p]?.length === supported(p).length,
  );
  return (
    <>
      <PageHead
        eyebrow="SYNC WORKSPACE"
        title="同步中心"
        description="选择平台与订单类型，明确每一次同步的范围。行情和收藏目录独立刷新。"
        actions={<Tag icon={<DesktopOutlined aria-hidden="true" />}>模拟器与浏览器尚未连接</Tag>}
      />
      <Alert
        type="info"
        showIcon
        className="sync-alert"
        title="当前为同步流程演示"
        description="只演示选择、排队、暂停、失败与重试。不会访问外部账户，也不会写入任何真实订单。"
      />
      <div className="sync-layout">
        <Panel
          title="本次同步范围"
          extra={
            <Checkbox
              disabled={running}
              checked={allSelected}
              indeterminate={selected.length > 0 && !allSelected}
              onChange={(e) =>
                setSelection(
                  Object.fromEntries(
                    platformNames.map((p) => [
                      p,
                      e.target.checked ? supported(p) : [],
                    ]),
                  ),
                )
              }
            >
              全选适用类型
            </Checkbox>
          }
        >
          <div className="platform-list">
            {platformNames.map((p, index) => {
              const types = selection[p] || [];
              const platformTasks = tasks.filter((t) => t.platform === p);
              const finished =
                platformTasks.length &&
                platformTasks.every(
                  (t) => !["排队中", "运行中"].includes(t.status),
                );
              const result = finished
                ? platformTasks.some((t) => t.status === "模拟失败")
                  ? "部分失败"
                  : platformTasks.some((t) => t.status === "已取消")
                    ? "已取消"
                    : "模拟完成"
                : undefined;
              const hist = supported(p)
                .map((t) => history[key(p, t)])
                .filter(Boolean);
              const latest = hist.sort((a, b) =>
                b.finished.localeCompare(a.finished),
              )[0];
              return (
                <div className="platform-card" key={p}>
                  <div className="platform-heading">
                    <div className={`platform-logo logo-${index}`}>
                      {p === "悠悠有品"
                        ? "U"
                        : p === "Steam"
                          ? "S"
                          : p.slice(0, 1)}
                    </div>
                    <div className="platform-title">
                      <b>{p}</b>
                      <small>
                        {p === "IGXE" || p === "Steam"
                          ? "登录后的浏览器页面"
                          : "MuMu 模拟器 · ADB · 串行采集"}
                      </small>
                    </div>
                    {result && (
                      <Pill tone={result === "模拟完成" ? "green" : "amber"}>
                        {result}
                      </Pill>
                    )}
                    <Checkbox
                      aria-label={`${p}全部业务`}
                      disabled={running}
                      checked={types.length === supported(p).length}
                      indeterminate={
                        types.length > 0 && types.length < supported(p).length
                      }
                      onChange={(e) =>
                        setSelection((s) => ({
                          ...s,
                          [p]: e.target.checked ? supported(p) : [],
                        }))
                      }
                    >
                      全选
                    </Checkbox>
                  </div>
                  <div className="platform-types">
                    {orderTypes.map((t) => {
                      const unsupported = p === "Steam" && t === "出租";
                      const h = history[key(p, t)];
                      return (
                        <div key={t} className={unsupported ? "disabled" : ""}>
                          <Checkbox
                            disabled={running || unsupported}
                            checked={types.includes(t)}
                            aria-label={`${p}${t}`}
                            onChange={(e) =>
                              setSelection((s) => ({
                                ...s,
                                [p]: e.target.checked
                                  ? [...types, t]
                                  : types.filter((v) => v !== t),
                              }))
                            }
                          >
                            {t}
                          </Checkbox>
                          <small>
                            {unsupported
                              ? "不适用"
                              : h
                                ? `${h.finished} · ${h.status}`
                                : "从未同步"}
                          </small>
                          {h?.success && h.status !== "模拟成功" && (
                            <small>最近模拟成功：{h.success}</small>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="platform-foot">
                    <span>
                      {types.length
                        ? "选中平台同时核对可读取的当前库存"
                        : "未选中 · 不访问该平台"}
                    </span>
                    <small>
                      {latest
                        ? `最近尝试 ${latest.finished} · 类型见上方`
                        : "平台暂无同步记录"}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <div className="sync-right">
          <Panel title="执行设置">
            <div className="setting-field">
              <label>同步模式</label>
              <Radio.Group
                disabled={running}
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                options={["日常增量", "历史全量"]}
              />
              <small>全量用于首次获取仍可访问的历史。</small>
            </div>
            <div className="setting-field">
              <label>本次演示结果</label>
              <Select
                disabled={running}
                value={outcome}
                onChange={setOutcome}
                options={["部分失败", "全部成功"].map((value) => ({ value }))}
              />
              <small>用于验收异常流程，不代表真实平台状态。</small>
            </div>
            <div className="selection-summary">
              <span>已选择</span>
              <b>{new Set(selected.map((t) => t.platform)).size}</b>
              <span> 个平台 / </span>
              <b>{selected.length}</b>
              <span> 个订单子项</span>
            </div>
            {running ? (
              <Space wrap>
                <Button
                  icon={
                    paused ? <PlayCircleOutlined aria-hidden="true" /> : <PauseCircleOutlined aria-hidden="true" />
                  }
                  onClick={() => setPaused(!paused)}
                >
                  {paused ? "继续演示" : "暂停演示"}
                </Button>
                <Button danger icon={<StopOutlined aria-hidden="true" />} onClick={cancel}>
                  取消
                </Button>
              </Space>
            ) : (
              <Button
                type="primary"
                size="large"
                block
                disabled={!selected.length}
                icon={<SyncOutlined aria-hidden="true" />}
                onClick={() => setConfirm(true)}
              >
                开始同步演示
              </Button>
            )}
            {!selected.length && (
              <p className="warning-text">请至少选择一个适用的订单类型。</p>
            )}
            <div className="soft-note">
              <CheckCircleFilled aria-hidden="true" /> 未选中的平台与子项保持原状
            </div>
          </Panel>
          <Panel title="独立资料刷新">
            <div className="independent-source">
              <div>
                <b>SteamDT 行情与基础资料</b>
                <p>独立手动刷新，遵守接口额度。</p>
              </div>
              <Button
                onClick={() =>
                  message.info(
                    "原型未接入 SteamDT；愿望单可演示报价刷新失败状态。",
                  )
                }
              >
                查看状态
              </Button>
            </div>
            <div className="independent-source">
              <div>
                <b>收藏目录</b>
                <p>{catalog.snapshot.groups.length} 组本机目录 · {new Date(catalog.snapshot.updatedAt).toLocaleString('zh-CN')}</p>
              </div>
              <Button
                loading={catalog.busy}
                disabled={!catalog.ready}
                onClick={()=>catalog.refresh()}
              >
                刷新目录
              </Button>
            </div>
            {(catalog.error || catalog.notice) && <Alert type={catalog.error ? 'warning' : 'success'} title={catalog.error || catalog.notice} />}
          </Panel>
        </div>
      </div>
      {tasks.length > 0 && (
        <Panel
          title={`第 ${attempt} 次演示 · ${activeMode}`}
          extra={
            <Space>
              {!running && failed > 0 && (
                <Button icon={<ReloadOutlined aria-hidden="true" />} onClick={retry}>
                  仅重试失败子项
                </Button>
              )}
              <Button onClick={() => setReport(true)}>任务报告</Button>
            </Space>
          }
        >
          <div className="sync-progress">
            <Pill
              tone={
                paused ? "amber" : running ? "blue" : failed ? "amber" : "green"
              }
            >
              {paused
                ? "已暂停"
                : running
                  ? "演示运行中"
                  : failed
                    ? "演示部分失败"
                    : tasks.some((t) => t.status === "已取消")
                      ? "已取消"
                      : "演示结束"}
            </Pill>
            <span>
              {completed} / {tasks.length} 个子项已结束
            </span>
          </div>
          <Progress
            percent={percentage}
            status={
              running && !paused ? "active" : failed ? "exception" : "normal"
            }
          />
          <div className="task-rows">
            {tasks.map((t) => (
              <div key={key(t.platform, t.type)}>
                <b>{t.platform}</b>
                <span>{t.type}</span>
                <small>
                  {t.status === "模拟失败"
                    ? "模拟登录失效，需要用户接手"
                    : t.status === "模拟成功"
                      ? "流程演示完成 · 未获取真实订单"
                      : t.status}
                </small>
                <Pill
                  tone={
                    t.status === "模拟失败"
                      ? "red"
                      : t.status === "模拟成功"
                        ? "green"
                        : "gray"
                  }
                >
                  {t.status}
                </Pill>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <Modal
        title="确认本次演示范围"
        open={confirm}
        onCancel={() => setConfirm(false)}
        onOk={start}
        okText="开始演示"
        cancelText="返回调整"
      >
        <p>启动后固定本次范围；任务期间不能追加其他平台或订单类型。</p>
        {platformNames
          .filter((p) => selection[p]?.length)
          .map((p) => (
            <p key={p}>
              <b>{p}</b>：{selection[p].join("、")}
            </p>
          ))}
        <Alert
          type="info"
          title="不会调用 SteamDT，不会执行交易操作。模拟任务中的成功只表示演示流程完成。"
        />
      </Modal>
      <Modal
        title="同步演示报告"
        open={report}
        onCancel={() => setReport(false)}
        footer={<Button onClick={() => setReport(false)}>关闭</Button>}
        width={720}
      >
        <Alert
          type="warning"
          title="真实新增、更新、跳过、替换订单均未统计：本轮没有采集真实数据。"
        />
        <Table
          rowKey={(t) => key(t.platform, t.type)}
          dataSource={tasks}
          pagination={false}
          columns={[
            { title: "平台", dataIndex: "platform" },
            { title: "业务", dataIndex: "type" },
            { title: "结果", dataIndex: "status" },
            {
              title: "本次结束时间",
              dataIndex: "finished",
              render: (v) => v || "尚未结束",
            },
          ]}
        />
      </Modal>
    </>
  );
}

