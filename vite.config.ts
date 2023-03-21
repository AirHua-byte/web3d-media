import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { URL, fileURLToPath } from "node:url";
import eslintPlugin from "vite-plugin-eslint";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    eslintPlugin({
      include: [
        "src/**/*.ts",
        "src/**/*.js",
        "src/**/*.vue",
        "src/*.ts",
        "src/*.js",
        "src/*.vue",
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // 将 ammo.js 模块路径指向安装的包
      // "ammo.js": "ammo.js/builds/ammo.js",
    },
  },
  css: {
    preprocessorOptions: {
      //define global scss variable
      scss: {
        additionalData: `@import "@/common/styles/_mixin.scss";`,
      },
    },
  },
});
