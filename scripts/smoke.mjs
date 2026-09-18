import { _electron as electron } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const artifacts = resolve("artifacts");
await mkdir(artifacts, { recursive: true });
const testData = resolve(`artifacts/test-profile-${Date.now()}`);
await mkdir(testData, { recursive: true });
const env = { ...process.env, CS_RENT_TEST_DEMO:'1',CS_RENT_TEST_DATA:testData };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  args: ["out/main/index.js"],
  env,
  timeout: 30000,
});
const page = await app.firstWindow();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error") logs.push(m.text());
});
const nav = page.getByRole("navigation", { name: "主导航" });
const go = async (name) => {
  await nav.getByRole("button", { name: new RegExp("^" + name) }).click();
};
const visible = async (name) =>
  assert.equal(
    await page.getByRole("heading", { name, exact: true }).isVisible(),
    true,
    name,
  );
try {
  await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('market:quote');ipcMain.handle('market:quote',()=>({ok:true,value:123456,source:'测试报价',updated:new Date().toISOString()}));});
  await page
    .getByRole("heading", { name: "每一件饰品，都有迹可循。" })
    .waitFor();
  await page.screenshot({ path: resolve(artifacts, "01-overview-light.png") });
  const pages = [
    ["资产与收支", "02-assets"],
    ["订单中心", "03-orders"],
    ["愿望单", "04-wishlist"],
    ["收藏室", "05-collection"],
    ["同步中心", "06-sync"],
    ["设置", "07-settings"],
  ];
  for (const [name, file] of pages) {
    await go(name);
    await visible(name);
    await page.screenshot({ path: resolve(artifacts, `${file}-light.png`) });
  }
  await go("资产与收支");
  await page.getByRole("textbox", { name: "搜索资产" }).fill("变色龙");
  assert.equal(await page.locator("main .ant-table-row:visible").count(), 2);
  await page.getByRole("textbox", { name: "搜索资产" }).fill("");
  await page.getByRole("button", { name: "新增记录", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("选择商品").fill('MAC-10 | 炽热');
  await page
    .locator(".ant-select-item-option-content")
    .getByText("MAC-10 | 炽热", { exact: true })
    .click();
  await dialog.getByLabel("外观等级").click();
  await page
    .locator(".ant-select-item-option-content")
    .getByText("略有磨损", { exact: true })
    .click();
  await dialog.getByLabel("实付成本（元）").fill("100");
  await dialog.getByRole("button", { name: "保存记录", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("textbox", { name: "搜索资产" }).fill("炽热");
  assert.equal(await page.locator("main .ant-table-row:visible").count(), 1);
  await page.getByRole("textbox", { name: "搜索资产" }).fill("");
  await go("收藏室");
  await page.getByRole('textbox',{name:'搜索收藏分组'}).fill('凤凰');
  await page.locator('.collection-nav').click();
  assert.ok(
    (await page.locator(".collection-progress").innerText()).includes("4 / 13"),
  );
  assert.equal(await page.getByText("拥有纪念品").count(), 0);
  await go("订单中心");
  await page.getByRole("button", { name: "补录订单", exact: true }).click();
  await dialog.getByLabel("关联资产").click();
  await page
    .locator(".ant-select-item-option-content")
    .filter({ hasText: "MAC-10 | 炽热" })
    .click();
  await dialog.getByLabel("最终净金额 / 待结算金额（元）").fill("25");
  await dialog.getByRole("button", { name: "保存订单", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await go("资产与收支");
  await page.getByRole("textbox", { name: "搜索资产" }).fill("炽热");
  assert.ok(
    (await page.locator("main .ant-table-row:visible").innerText()).includes(
      "25.00",
    ),
  );
  await page.getByRole("textbox", { name: "搜索资产" }).fill("");
  await go("同步中心");
  await page
    .getByRole("checkbox", { name: "全选适用类型", exact: true })
    .uncheck();
  assert.equal(
    await page
      .getByRole("button", { name: "开始同步演示", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("checkbox", { name: "BUFF出售", exact: true }).check();
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Steam出租", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "开始同步演示", exact: true }).click();
  await dialog.getByRole("button", { name: "开始演示", exact: true }).click();
  await page
    .getByRole("button", { name: "仅重试失败子项", exact: true })
    .waitFor({ timeout: 15000 });
  assert.equal(await page.locator(".task-rows>div").count(), 1);
  assert.ok((await page.locator(".task-rows").innerText()).includes("BUFF"));
  await page.screenshot({ path: resolve(artifacts, "08-sync-failure.png") });
  await page
    .getByRole("button", { name: "仅重试失败子项", exact: true })
    .click();
  await page
    .locator(".task-rows .pill")
    .getByText("模拟成功", { exact: true })
    .waitFor({ timeout: 15000 });
  assert.equal(await page.locator(".task-rows>div").count(), 1);
  await page.getByRole("button", { name: "切换深色主题", exact: true }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await go("总览");
  await page.screenshot({ path: resolve(artifacts, "09-overview-dark.png") });
  await go("收藏室");
  await page.screenshot({ path: resolve(artifacts, "10-collection-dark.png") });
  await page.reload();
  await page
    .getByRole("heading", { name: "每一件饰品，都有迹可循。" })
    .waitFor();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await go("资产与收支");
  await page.getByRole("textbox", { name: "搜索资产" }).fill("炽热");
  assert.equal(await page.locator("main .ant-table-row:visible").count(), 1);
  assert.deepEqual(errors, []);
  assert.deepEqual(
    logs.filter((m) => !m.includes("Electron Security Warning")),
    [],
  );
  await writeFile(
    resolve(artifacts, "smoke-result.json"),
    JSON.stringify(
      {
        passed: true,
        date: new Date().toISOString(),
        checks: [
          "七页面无运行错误",
          "资产筛选",
          "新增合法商品与购买记录",
          "收藏进度随资产变化",
          "补录已结算租金联动",
          "同步空选择禁用",
          "Steam出租禁用",
          "仅BUFF出售及失败重试",
          "深色切换与重启保持",
          "示例资产跨重启保持",
        ],
        errors,
        consoleErrors: logs,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: Electron interaction smoke checks. Screenshots saved to artifacts/.",
  );
} catch (error) {
  await page.screenshot({path:resolve(artifacts,'failure.png')});
  await writeFile(resolve(artifacts,'failure-state.txt'),await page.locator('body').innerText());
  console.error('Renderer errors:', errors, logs);
  throw error;
} finally {
  await app.close();
}
