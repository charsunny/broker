import { defineConfig } from "vitest/config";

// 集成测试: 需要真实 PostgreSQL (docker compose up -d). 与默认 *.spec.ts 单测隔离。
export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.int-spec.ts"],
    environment: "node",
    testTimeout: 20000,
    fileParallelism: false,
  },
});
