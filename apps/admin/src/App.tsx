import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Layout,
  message,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { UploadProps } from "antd";
import { api, type ConfigVersion, type ImportResult, type MatrixRow } from "./api";

const statusColor: Record<string, string> = {
  Active: "green",
  Draft: "gold",
  Sunset: "default",
};

function ImportPanel() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const props: UploadProps = {
    accept: ".xlsx",
    showUploadList: false,
    beforeUpload: (file) => {
      api
        .importExcel(file as File)
        .then((r) => {
          setResult(r);
          message.success(`已生成 ${r.drafts} 条草稿 @ ${r.effectiveDate}`);
        })
        .catch((e) => message.error(e?.response?.data?.message ?? "导入失败"));
      return false;
    },
  };
  return (
    <Card title="上传矩阵式 Excel (文件名含生效日, 如 SunLife_Rates_20260101生效.xlsx)">
      <Upload {...props}>
        <Button type="primary">选择 .xlsx 上传</Button>
      </Upload>
      {result && (
        <div style={{ marginTop: 16 }}>
          <Alert
            type={result.report.passed ? "success" : "error"}
            message={`沙箱 Dry-run ${result.report.passed ? "全绿通过" : "未通过"} · ${result.company} · 生效日 ${result.effectiveDate} · 草稿 ${result.drafts} 条`}
          />
          <Table
            style={{ marginTop: 12 }}
            size="small"
            rowKey="name"
            pagination={false}
            dataSource={result.report.cases}
            columns={[
              { title: "边界用例", dataIndex: "name" },
              {
                title: "结果",
                dataIndex: "ok",
                render: (ok: boolean) => (
                  <Tag color={ok ? "green" : "red"}>{ok ? "PASS" : "FAIL"}</Tag>
                ),
              },
              { title: "错误", dataIndex: "error" },
            ]}
          />
        </div>
      )}
    </Card>
  );
}

function PendingPanel() {
  const [rows, setRows] = useState<ConfigVersion[]>([]);
  const load = () =>
    api.pending().then(setRows).catch(() => message.error("加载失败"));
  const dates = [...new Set(rows.map((r) => r.effectiveDate))];
  const approve = (d: string) =>
    api
      .approve(d)
      .then((r) => {
        message.success(`已发布 ${r.published} 条 + 热重载`);
        load();
      })
      .catch((e) => message.error(e?.response?.data?.message ?? "发布失败"));

  return (
    <Card
      title="待审批草稿 (HITL 人工放行点)"
      extra={<Button onClick={load}>刷新</Button>}
    >
      <Space style={{ marginBottom: 12 }} wrap>
        {dates.map((d) => (
          <Button key={d} type="primary" onClick={() => approve(d)}>
            ✅ Approve &amp; Publish {d}
          </Button>
        ))}
        {dates.length === 0 && <Typography.Text type="secondary">暂无草稿</Typography.Text>}
      </Space>
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={rows}
        columns={[
          { title: "产品", dataIndex: "productName" },
          { title: "年期", dataIndex: "premiumTerm" },
          { title: "身份", dataIndex: "investorStatus" },
          { title: "生效日", dataIndex: "effectiveDate" },
          {
            title: "状态",
            dataIndex: "status",
            render: (s: string) => <Tag color={statusColor[s]}>{s}</Tag>,
          },
        ]}
      />
    </Card>
  );
}

function MatrixPanel() {
  const [product, setProduct] = useState("SunJoy Global 2");
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const load = () =>
    api.matrix(product).then(setRows).catch(() => message.error("加载失败"));
  const rollback = (r: MatrixRow) =>
    api
      .rollback(r.productName, r.premiumTerm, r.investorStatus)
      .then((res) => {
        if (res.ok) {
          message.success("已回滚至上一版本 + 热重载");
          load();
        } else message.warning(res.reason ?? "无法回滚");
      })
      .catch(() => message.error("回滚失败"));

  return (
    <Card
      title="版本历史 + JSONB 矩阵反向解析 (需求书 5.1 Read-Only View)"
      extra={
        <Space>
          <Input
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            style={{ width: 240 }}
          />
          <Button onClick={load}>查询</Button>
        </Space>
      }
    >
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={rows}
        expandable={{
          expandedRowRender: (r) => (
            <Table
              size="small"
              rowKey="year"
              pagination={false}
              dataSource={r.matrix}
              columns={[
                { title: "保单年度", dataIndex: "year" },
                { title: "基础佣金", dataIndex: "basic" },
                { title: "Extra", dataIndex: "extra" },
                { title: "SMPA", dataIndex: "smpa" },
                { title: "MA", dataIndex: "ma" },
              ]}
            />
          ),
        }}
        columns={[
          { title: "年期", dataIndex: "premiumTerm" },
          { title: "身份", dataIndex: "investorStatus" },
          { title: "生效日", dataIndex: "effectiveDate" },
          { title: "日落日", dataIndex: "effectiveEndDate", render: (v) => v ?? "—" },
          {
            title: "状态",
            dataIndex: "status",
            render: (s: string) => <Tag color={statusColor[s]}>{s}</Tag>,
          },
          {
            title: "操作",
            render: (_, r: MatrixRow) =>
              r.status === "Active" ? (
                <Button danger size="small" onClick={() => rollback(r)}>
                  1-Click Rollback
                </Button>
              ) : null,
          },
        ]}
      />
    </Card>
  );
}

export function App() {
  const [logged, setLogged] = useState(api.hasToken());
  const [phone, setPhone] = useState("13800000000");

  if (!logged) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <Card title="佣金配置 Admin 登录" style={{ width: 360 }}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Input
              placeholder="手机号 (白名单)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button
              type="primary"
              block
              onClick={() =>
                api
                  .login(phone)
                  .then(() => setLogged(true))
                  .catch(() => message.error("手机号不在白名单"))
              }
            >
              登录
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Header style={{ color: "#fff", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 18 }}>佣金配置 Admin · HITL 闭环</span>
        <Button
          ghost
          onClick={() => {
            api.logout();
            setLogged(false);
          }}
        >
          退出
        </Button>
      </Layout.Header>
      <Layout.Content style={{ padding: 24 }}>
        <Tabs
          items={[
            { key: "import", label: "导入费率", children: <ImportPanel /> },
            { key: "pending", label: "待审批", children: <PendingPanel /> },
            { key: "matrix", label: "版本/矩阵/回滚", children: <MatrixPanel /> },
          ]}
        />
      </Layout.Content>
    </Layout>
  );
}
