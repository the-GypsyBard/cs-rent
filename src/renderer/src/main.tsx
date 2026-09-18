import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { loadUserData } from './store';
loadUserData().then(initial => {
document.documentElement.dataset.theme = initial.data.settings.theme;
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App initialData={initial} />
  </React.StrictMode>,
);
}).catch(()=>{document.getElementById('root')!.textContent='读取用户数据失败，原数据未修改。请重新启动后导入备份恢复。';});
