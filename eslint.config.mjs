// @ts-check

import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";

export default tseslint.config(
    {
        ignores: ["*.d.ts", "**/coverage", "**/dist", "src/stage/fixtures/dmx/open-fixture.ts", "src/rust/pkg/rust.js"],
    },
    {
        extends: [
            eslint.configs.recommended,
            tseslint.configs.strict,
            tseslint.configs.stylistic,
            ...pluginVue.configs["flat/recommended"],
        ],
        files: ["**/*.{ts,vue}"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: globals.browser,
            parserOptions: {
                parser: tseslint.parser,
            },
        },
        rules: {
            "vue/html-indent": ["warn", 4],
            "vue/max-attributes-per-line": "off",
            "vue/html-self-closing": "off",
            "vue/singleline-html-element-content-newline": "off",
            "vue/multi-word-component-names": "off",
            "vue/no-mutating-props": "warn",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    args: "after-used",
                    destructuredArrayIgnorePattern: "^_",
                },
            ],
        },
    },
);
