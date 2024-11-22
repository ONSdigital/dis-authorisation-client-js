// eslint.config.js
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jest from "eslint-plugin-jest";
import babelParser from "@babel/eslint-parser";

// airbnb base config isn't compatible with eslint 7/8/9 so we need to use flat compat
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends("airbnb-base"),
  {
    files: ["**/*.js"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        babelOptions: {
          presets: ["@babel/preset-env"],
        },
        ecmaVersion: "2024",
        sourceType: "module",
      },
      globals: {
        window: "readonly",
        document: "readonly",
      },
    },
  },
  {
    files: ["**/*.test.js"],
    languageOptions: {
      globals: {
        ...jest.environments.globals.globals,
      },
    },
    plugins: {
      jest,
    },
    rules: {},
  },
];
