import { describe, expect, it } from "vitest";
import { createDemo } from "../src/renderer/src/demo";
import {
  assetMetrics,
  bestWear,
  selectedTasks,
  totals,
  wishStatus,
} from "../src/renderer/src/model";
import { backupSchema } from "../src/renderer/src/store";
describe("原型关键业务口径", () => {
  it("待结算租金和失败购买不改变资产已实现收益", () => {
    const d = createDemo();
    expect(assetMetrics(d.assets[0], d.orders).rent).toBe(41000);
    expect(totals(d.assets, d.orders).rent).toBe(58200);
  });
  it("赠出保留累计支出但不冲减已实现净收益", () => {
    const d = createDemo();
    const m = assetMetrics(
      d.assets.find((a) => a.id === "a8")!,
      d.orders,
    );
    expect(m.net).toBe(6000);
    expect(m.cash).toBe(-44000);
  });
  it("未知成本与受赠零成本分别显示，不制造零成本已售收益", () => {
    const d = createDemo();
    const unknown = d.assets.find((a) => a.id === "a6")!;
    expect(
      assetMetrics({ ...unknown, status: "已售出", sale: 100000 }, d.orders)
        .net,
    ).toBeNull();
    expect(
      assetMetrics(
        d.assets.find((a) => a.id === "a7")!,
        d.orders,
      ).cash,
    ).toBe(0);
    expect(totals(d.assets, d.orders).unknown).toBe(1);
  });
  it("特殊属性及未知币种即使低于目标价也不能判达标", () => {
    const d = createDemo();
    expect(wishStatus({ ...d.wishes[0], target: 100000000,currencyKnown:false })).toBe(
      "币种待确认",
    );
    expect(wishStatus(d.wishes[2])).toBe("需核实特殊属性");
    expect(wishStatus(d.wishes[1])).toBe("已获取报价达标");
    expect(wishStatus({ ...d.wishes[1], failed: true })).toBe("刷新失败");
  });
  it("同步选择只生成指定平台及类型，Steam 出租不可执行", () => {
    expect(selectedTasks({ BUFF: ["出售"], Steam: ["出租", "购买"] })).toEqual([
      { platform: "BUFF", type: "出售" },
      { platform: "Steam", type: "购买" },
    ]);
    expect(selectedTasks({})).toEqual([]);
  });
  it("最佳等级根据持有成员决定，缺磨损不伪造崭新", () => {
    const d = createDemo();
    expect(bestWear([d.assets[2], d.assets[3]])).toBe("崭新出厂");
    expect(bestWear([d.assets[2]])).toBe("略有磨损");
    expect(bestWear([{ ...d.assets[2], wear: "待确认" }])).toBe("磨损待确认");
  });
  it("恢复只接受结构有效且关联完整的原型快照", () => {
    const state = createDemo();
    expect(
      backupSchema.safeParse({ format: "cs-rent-prototype-v1", state }).success,
    ).toBe(true);
    expect(
      backupSchema.safeParse({
        format: "cs-rent-prototype-v1",
        state: { ...state, assets: [] },
      }).success,
    ).toBe(false);
    expect(
      backupSchema.safeParse({
        format: "cs-rent-prototype-v1",
        state: {
          ...state,
          assets: [
            { ...state.assets[0], image: "javascript:alert(1)" },
            ...state.assets.slice(1),
          ],
        },
      }).success,
    ).toBe(false);
  });
});
