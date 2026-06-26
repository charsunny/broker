import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Admin 挂在 broker.wxenv.com/admin 子路径下, 资源路径需带 /admin/ 前缀
  base: "/admin/",
  plugins: [react()],
  server: { port: 4200 },
});
