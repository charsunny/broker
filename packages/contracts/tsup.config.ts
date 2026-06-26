import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  // 同时产出 .js(esm) 与 .cjs(cjs)，兼容 NestJS(cjs) 与其它 JS 消费方(esm, 如 Admin)
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
