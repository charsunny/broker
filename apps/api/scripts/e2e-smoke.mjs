/**
 * 端到端冒烟: 驱动运行中的服务跑通"剧本一", 打印每轮下发的 UI 指令。
 * 用法: PORT=3010 node scripts/e2e-smoke.mjs
 */
const BASE = `http://localhost:${process.env.PORT ?? 3010}/api/v1/broker/chat/message`;

async function send(payload) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

function summarize(data) {
  return data
    .map((c) => {
      if (c.type === "text") return `text("${c.content}")`;
      if (c.type === "choice_chips")
        return `choice_chips[${c.targetSlot}] -> ${c.options.map((o) => o.value).join("|")}`;
      if (c.type === "native_input")
        return `native_input[${c.targetSlot}] (${c.inputType})`;
      if (c.type === "commission_card")
        return `commission_card "${c.header}" | ${c.hero_number ?? c.heroNumber} | rows=${c.accordionData?.length ?? c.accordion_data?.length} | risk=${c.riskBanner?.level ?? "none"}`;
      return c.type;
    })
    .join("  ||  ");
}

let threadId = null;
const turns = [
  { label: "回合1 快捷胶囊", body: { messageType: "text", content: "永明产品佣金测算" } },
  { label: "回合2 选产品", body: { messageType: "slot_update", targetSlot: "productName", slotValue: "SunJoy Global 2" } },
  { label: "回合3 选年期", body: { messageType: "slot_update", targetSlot: "premiumTerm", slotValue: "5" } },
  { label: "回合4 选身份", body: { messageType: "slot_update", targetSlot: "investorStatus", slotValue: "Non-PI" } },
  { label: "回合5 NLP微调", body: { messageType: "text", content: "如果是PI客户呢？" } },
];

for (const t of turns) {
  const resp = await send({ ...t.body, threadId });
  threadId = resp.threadId;
  console.log(`\n[${t.label}] code=${resp.code} thread=${resp.threadId.slice(0, 8)}`);
  console.log("  " + summarize(resp.data));
}
console.log("\n✅ 剧本一 端到端跑通");
