import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [react(), svgr()],
  server: {
    port: 5173,
    proxy: {
      // Endpoint to catch the requests to the "/token" endpoint of the SSO.
      // It helps avoiding the CORS issues of that particular endpoint. The
      // rest of them do not give us any CORS issues.
      "/vite-sso-token-proxy": {
        changeOrigin: true,
        rewrite: (path) => path.replace("/vite-sso-token-proxy", ""),
        target: "https://sso.redhat.com",
      },
    },
    strictPort: true,
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
    css: false,
  },
});
