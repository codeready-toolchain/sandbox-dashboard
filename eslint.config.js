import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "tmp",
      "coverage",
      "public/mockServiceWorker.js",
      "e2e/node_modules",
      "e2e/test-results",
      "e2e/playwright-report",
      "e2e/blob-report",
      "e2e/playwright/.cache",
      "e2e/playwright/.auth",
    ],
  },

  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Enforce braces on every block statement to improve readability.
      curly: ["error", "all"],
      // Make sure the imports and exports are properly sorted.
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
);
