import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["node_modules/", ".wrangler/", "public/"],
  },
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    rules: {
      "no-console": "error",
      "@typescript-eslint/prefer-readonly": "error",
    },
  },
  {
    // src/ belongs to tsconfig.json, tests/ to tsconfig.test.json (AGENTS §9.2).
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Tool config files are in neither tsconfig; type-check them with the test project's options.
    files: ["eslint.config.mjs", "vitest.config.ts"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs", "vitest.config.ts"],
          defaultProject: "tsconfig.test.json",
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
);
