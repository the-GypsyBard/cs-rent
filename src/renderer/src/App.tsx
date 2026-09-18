import { useState, useEffect } from "react";
import type { BootData } from './store';
import { CatalogProvider } from './catalog-store';
import {
  ConfigProvider,
  App as AntApp,
  theme,
  Button,
  Select,
  Tooltip,
  Badge,
  Alert,
} from "antd";
import zhCN from "antd/locale/zh_CN";
import {
  AppstoreOutlined,
  WalletOutlined,
  UnorderedListOutlined,
  HeartOutlined,
  TrophyOutlined,
  SyncOutlined,
  SettingOutlined,
  SunOutlined,
  MoonOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  BellOutlined,
} from "@ant-design/icons";
import { Provider, useStore } from "./store";
import { type Page } from "./model";
import { Overview } from "./pages/Overview";
import { Assets } from "./pages/Assets";
import { Orders } from "./pages/Orders";
import { Wishlist } from "./pages/Wishlist";
import { Collection } from "./pages/Collection";
import { SyncCenter } from "./pages/SyncCenter";
import { Settings } from "./pages/Settings";
const nav = [
  { id: "overview", label: "总览", icon: <AppstoreOutlined aria-hidden="true" /> },
  { id: "assets", label: "资产与收支", icon: <WalletOutlined aria-hidden="true" /> },
  { id: "orders", label: "订单中心", icon: <UnorderedListOutlined aria-hidden="true" /> },
  { id: "wishlist", label: "愿望单", icon: <HeartOutlined aria-hidden="true" /> },
  { id: "collection", label: "收藏室", icon: <TrophyOutlined aria-hidden="true" /> },
  { id: "sync", label: "同步中心", icon: <SyncOutlined aria-hidden="true" /> },
  { id: "settings", label: "设置", icon: <SettingOutlined aria-hidden="true" /> },
] as const;
function Shell({
  dark,
  setDark,
}: {
  dark: boolean;
  setDark: (value: boolean) => void;
}) {
  const { state, reset, storageError,readError,space } = useStore();
  const { modal } = AntApp.useApp();
  const [page, setPage] = useState<Page>("overview");
  const [collectionTarget,setCollectionTarget]=useState<{skinId:string;nonce:number}>();
  const [ordersPending, setOrdersPending] = useState(false);
  const navigate = (to: Page, pending = false) => {
    setPage(to);
    setOrdersPending(pending);
    document.querySelector(".content-scroll")?.scrollTo(0, 0);
  };
  const scenario = (value: string) =>
    modal.confirm({
      title: value === "empty" ? "切换为空数据场景？" : "恢复标准验收示例？",
      content:
        "这会替换当前资产、订单和愿望单。请先在设置导出完整备份；个人设置保留。",
      okText: "切换场景",
      cancelText: "保留当前",
      onOk: () => reset(value === "empty"),
    });
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-symbol">
            C<span>S</span>
          </div>
          <div>
            <b>CS 饰品平台</b>
            <small>个人资产工作台</small>
          </div>
        </div>
        <div className="workspace">
          <span className="workspace-avatar">G</span>
          <div>
            <b>我的资产空间</b>
            <small>
              <span className="online-dot" /> 本地 · 交互原型
            </small>
          </div>
        </div>
        <div className="nav-label">资产管理</div>
        <nav aria-label="主导航">
          {nav.slice(0, 3).map((item) => (
            <button
              aria-label={item.label}
              key={item.id}
              className={page === item.id ? "nav-item active" : "nav-item"}
              onClick={() => navigate(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.id === "orders" &&
                state.orders.some((o) => o.status === "待核对") && (
                  <span className="nav-count">
                    {state.orders.filter((o) => o.status === "待核对").length}
                  </span>
                )}
            </button>
          ))}
          <div className="nav-label second">发现与收藏</div>
          {nav.slice(3, 5).map((item) => (
            <button
              aria-label={item.label}
              key={item.id}
              className={page === item.id ? "nav-item active" : "nav-item"}
              onClick={() => navigate(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
          <div className="nav-label second">工作空间</div>
          {nav.slice(5).map((item) => (
            <button
              aria-label={item.label}
              key={item.id}
              className={page === item.id ? "nav-item active" : "nav-item"}
              onClick={() => navigate(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <CheckCircleOutlined aria-hidden="true" />
            <div>
              <b>数据留在本机</b>
              <small>账本与偏好自动保存</small>
            </div>
          </div>
          <div className="build-label">
            CS RENT <span>v0.8 · 原型</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            我的工作台 <span>/</span>{" "}
            <b>{nav.find((n) => n.id === page)?.label}</b>
          </div>
          <div className="topbar-right">
            <span className="prototype-badge">
              <ExperimentOutlined aria-hidden="true" /> 交互验收版
            </span>
            <Tooltip title={dark ? "切换浅色主题" : "切换深色主题"}>
              <Button
                aria-label={dark ? "切换浅色主题" : "切换深色主题"}
                type="text"
                shape="circle"
                icon={dark ? <SunOutlined aria-hidden="true" /> : <MoonOutlined aria-hidden="true" />}
                onClick={() => setDark(!dark)}
              />
            </Tooltip>
            <Tooltip title="查看待核对订单">
              <Badge dot={state.orders.some((o) => o.status === "待核对")}>
                <Button
                  aria-label="查看待核对订单"
                  type="text"
                  shape="circle"
                  icon={<BellOutlined aria-hidden="true" />}
                  onClick={() => navigate("orders", true)}
                />
              </Badge>
            </Tooltip>
            <div className="user-avatar">G</div>
          </div>
        </header>
        <div className="demo-bar">
          <span>
            <ExperimentOutlined aria-hidden="true" /> <b>{space==='demo'?'示例空间':'本地账本'}</b>
            <span className="demo-copy">
              {space==='demo'?'示例账本用于验收；':'手动记录保存在本机；'}平台同步仍为演示，目录与参考报价可联网获取。
            </span>
          </span>
          <Select
            aria-label="验收场景"
            value="current"
            variant="borderless"
            onChange={scenario}
            options={[
              { value: "current", label: "验收场景" },
              { value: "standard", label: "恢复标准示例" },
              { value: "empty", label: "切换空数据场景" },
            ]}
          />
        </div>
        {storageError && (
          <Alert
            type="error"
            title={readError||'保存失败：请勿关闭应用，检查用户数据目录并导出备份。'}
          />
        )}
        <main className="content-scroll">
          <div hidden={page !== "overview"}>
            {page === "overview" && (
              <Overview dark={dark} navigate={navigate} />
            )}
          </div>
          <div hidden={page !== "assets"}>
            <Assets navigate={navigate} openCollection={skinId=>{setCollectionTarget({skinId,nonce:Date.now()});navigate('collection');}} />
          </div>
          <div hidden={page !== "orders"}>
            <Orders pending={ordersPending} />
          </div>
          <div hidden={page !== "wishlist"}>
            <Wishlist />
          </div>
          <div hidden={page !== "collection"}>
            <Collection active={page==='collection'} target={collectionTarget} />
          </div>
          <div hidden={page !== "sync"}>
            <SyncCenter />
          </div>
          <div hidden={page !== "settings"}>
            <Settings dark={dark} setDark={setDark} />
          </div>
          <footer className="page-footer">
            个人 CS2 饰品管理 · 只读采集与记账 <span>首轮验收：界面与交互</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default function App({initialData}:{initialData:BootData}) {return <Provider initial={initialData}><ThemedApp/></Provider>;}
function ThemedApp() {
  const {settings,setSettings}=useStore();const dark=settings.theme==='dark';
  const setDark=(value:boolean)=>setSettings({theme:value?'dark':'light'});
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.zoom=settings.largeText?'1.08':'1';
  }, [dark,settings.largeText]);
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: dark ? "#8395ff" : "#5165d8",
          colorSuccess: dark ? "#52c7ae" : "#178774",
          colorError: dark ? "#f28a8f" : "#cf515c",
          borderRadius: 8,
          fontFamily: 'Inter, "Segoe UI", "Microsoft YaHei", sans-serif',
          fontSize: 13,
          colorBgContainer: dark ? "#1b2535" : "#ffffff",
        },
        components: {
          Button: { controlHeight: 35 },
          Table: {
            cellPaddingBlock: 14,
            headerBg: dark ? "#202b3c" : "#f8f9fc",
            headerColor: dark ? "#aeb9cc" : "#6b778c",
          },
          Select: { controlHeight: 35 },
          Input: { controlHeight: 35 },
        },
      }}
    >
      <AntApp>
        <CatalogProvider>
          <Shell dark={dark} setDark={setDark} />
        </CatalogProvider>
      </AntApp>
    </ConfigProvider>
  );
}

