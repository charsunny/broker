/**
 * Admin HITL HTTP 冒烟: 登录 → 上传 Excel → 审批 → 矩阵 → 鉴权拦截。
 * 用法: PORT=3000 node scripts/admin-smoke.mjs
 */
import ExcelJS from "exceljs";

const BASE = `http://localhost:${process.env.PORT ?? 3000}/api/v1`;
const P = "__SMOKE__";

async function main() {
  const login = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "13800000000" }),
  });
  const { token } = await login.json();
  console.log(`login: ${login.status} token=${token ? "ok" : "FAIL"}`);

  const wb = new ExcelJS.Workbook();
  const b = wb.addWorksheet("Basic_Commission");
  b.addRow(["Product", "Term", "Yr 1", "Yr 2"]);
  b.addRow([P, "5", 0.2, 0.02]);
  const a = wb.addWorksheet("Allowances_Schedule");
  a.addRow(["Product", "Term", "Investor", "EligibleYears", "Extra", "SMPA", "MA"]);
  a.addRow([P, "5", "Non-PI", "1-2", 0.5, 0.3, 0.1]);
  const buf = Buffer.from(await wb.xlsx.writeBuffer());

  const fd = new FormData();
  fd.append("file", new Blob([buf]), "SunLife_Rates_20260101生效.xlsx");
  const imp = await fetch(`${BASE}/admin/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  console.log(`import: ${imp.status} ${JSON.stringify(await imp.json())}`);

  const ap = await fetch(`${BASE}/admin/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ effectiveDate: "2026-01-01" }),
  });
  console.log(`approve: ${ap.status} ${JSON.stringify(await ap.json())}`);

  const mx = await fetch(`${BASE}/admin/matrix/${P}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`matrix: ${mx.status} ${JSON.stringify(await mx.json()).slice(0, 260)}`);

  const noauth = await fetch(`${BASE}/admin/pending`);
  console.log(`no-auth pending (expect 401): ${noauth.status}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
