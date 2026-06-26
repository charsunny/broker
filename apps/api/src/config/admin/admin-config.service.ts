import { Injectable, BadRequestException } from "@nestjs/common";
import type { RatesByYear } from "@insurance/contracts";
import {
  ExcelImportService,
  type ImportedConfig,
} from "../import/excel-import.service";
import { ConfigRepository } from "../config.repository";
import { ConfigWarmupService } from "../config-warmup.service";
import { ConfigStore } from "../../engines/config.store";
import { SunLifeEngine } from "../../engines/sunlife.engine";
import { DynamicEngine } from "../../engines/dynamic.engine";
import { EngineRegistry } from "../../engines/engine.registry";
import { SandboxRunner } from "../../sandbox/sandbox.runner";
import { DryRunService } from "../../sandbox/dry-run.service";
import { ResultCacheService } from "../../cache/result-cache.service";

/**
 * Admin HITL 编排 (需求书 5.3 / 5.4 / 5.5)。
 * 上传 → 解析 → 沙箱/引擎 dry-run → 草稿态 → 人工放行 → 发布日落 + 热重载 → 一键回滚。
 */
@Injectable()
export class AdminConfigService {
  constructor(
    private readonly excel: ExcelImportService,
    private readonly repo: ConfigRepository,
    private readonly warmup: ConfigWarmupService,
    private readonly dryRun: DryRunService,
    private readonly sandbox: SandboxRunner,
    private readonly registry: EngineRegistry,
    private readonly cache?: ResultCacheService,
  ) {}

  /** Step1-3: 上传 Excel → 解析 → 引擎 dry-run → 写草稿 (绝不直接覆盖线上) */
  async importExcel(buffer: Buffer, filename: string) {
    const res = await this.excel.parse(buffer, filename);
    const report = this.dryRunConfigs(res.configs);
    if (!report.passed) {
      throw new BadRequestException({ message: "Dry-run 未通过，已拦截", report });
    }
    for (const p of res.products) {
      await this.repo.upsertProduct({
        productName: p.productName,
        company: p.company,
        terms: p.terms,
        requiredSlots: p.requiredSlots,
        singlePay: p.singlePay ?? false,
      });
    }
    const { staged, blocked } = await this.repo.insertDrafts(
      res.configs.map((c) => ({
        company: c.company,
        productName: c.productName,
        premiumTerm: c.premiumTerm,
        investorStatus: c.investorStatus,
        effectiveDate: res.effectiveDate,
        ratesData: c.ratesByYear,
      })),
    );
    return {
      effectiveDate: res.effectiveDate,
      company: res.company,
      drafts: staged,
      // blocked>0 表示有同 key+生效日的已发布版本未被覆盖 (需运营确认/换生效日)
      blocked,
      report,
    };
  }

  listPending() {
    return this.repo.listDrafts();
  }

  /** 反向解析 JSONB → 保单年度矩阵 (需求书 5.1 Read-Only View) */
  async matrix(productName: string) {
    const rows = await this.repo.listVersions(productName);
    return rows.map((r) => ({
      id: r.id,
      productName: r.productName,
      premiumTerm: r.premiumTerm,
      investorStatus: r.investorStatus,
      effectiveDate: r.effectiveDate,
      effectiveEndDate: r.effectiveEndDate,
      status: r.status,
      matrix: this.toMatrix(r.ratesData),
    }));
  }

  /** Step4: 人工放行 → 发布日落 + 热重载 (无感更新) */
  async approve(effectiveDate: string) {
    const drafts = await this.repo.listDraftsByDate(effectiveDate);
    if (drafts.length === 0) {
      throw new BadRequestException(`没有 ${effectiveDate} 的草稿可发布`);
    }
    for (const d of drafts) {
      await this.repo.publish({
        productName: d.productName,
        premiumTerm: d.premiumTerm,
        investorStatus: d.investorStatus,
        effectiveDate,
      });
    }
    await this.warmup.warm(); // 热重载内存规则字典
    await this.cache?.invalidateAll(); // 清旧费率结果缓存
    return { published: drafts.length, effectiveDate };
  }

  /** 一键回滚至上一稳定版本 + 热重载 (需求书 5.5) */
  async rollback(
    productName: string,
    premiumTerm: string,
    investorStatus: string,
  ) {
    const r = await this.repo.rollback({
      productName,
      premiumTerm,
      investorStatus,
    });
    if (r.ok) {
      await this.warmup.warm();
      await this.cache?.invalidateAll();
    }
    return r;
  }

  /** 动态代码部署 (需求书 5.3/5.5): 沙箱 dry-run 通过 → 热挂载 DynamicEngine */
  async deployDynamic(company: string, code: string) {
    const report = await this.dryRun.dryRun(code);
    if (!report.passed) {
      throw new BadRequestException({
        message: "沙箱 dry-run 未通过，拒绝挂载",
        report,
      });
    }
    this.registry.register(new DynamicEngine(company, code, this.sandbox));
    return { deployed: true, company, report };
  }

  /** config 路径 dry-run: 用真实 SunLife 四步数学跑边界保费, 断言非负有限 (需求书 5.4 影子测试) */
  private dryRunConfigs(configs: ImportedConfig[]) {
    const store = new ConfigStore();
    store.load(
      [],
      configs.map((c) => ({
        productName: c.productName,
        premiumTerm: c.premiumTerm,
        investorStatus: c.investorStatus,
        ratesByYear: c.ratesByYear,
      })),
    );
    const engine = new SunLifeEngine(store);
    const cases: Array<{ name: string; ok: boolean; error?: string }> = [];
    for (const c of configs) {
      for (const premium of [0, 9999999, 100000]) {
        const name = `${c.productName}/${c.premiumTerm}/${c.investorStatus} @${premium}`;
        try {
          const res = engine.calculate({
            company: c.company,
            productName: c.productName,
            premiumTerm: c.premiumTerm,
            investorStatus: c.investorStatus as "PI" | "Non-PI",
            premiumAmount: premium,
            policyYear: null,
          });
          const bad = res.breakdown.some(
            (b) => b.totalComm < 0 || !Number.isFinite(b.totalComm),
          );
          cases.push({ name, ok: !bad, error: bad ? "负数或非有限佣金" : undefined });
        } catch (e) {
          cases.push({ name, ok: false, error: String(e) });
        }
      }
    }
    return { passed: cases.every((c) => c.ok), cases };
  }

  private toMatrix(rates: RatesByYear) {
    return Object.entries(rates)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([year, yr]) => ({
        year: Number(year),
        basic: yr.basicRate,
        extra: yr.allowances.extra,
        smpa: yr.allowances.smpa,
        ma: yr.allowances.ma,
      }));
  }
}
