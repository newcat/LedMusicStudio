module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended-type-checked", "plugin:vue/vue3-essential"],
    overrides: [
        {
            env: {
                node: true,
            },
            files: [".eslintrc.{js,cjs}"],
            parserOptions: {
                sourceType: "script",
            },
        },
    ],
    parserOptions: {
        ecmaVersion: "latest",
        parser: "@typescript-eslint/parser",
        sourceType: "module",
        project: "tsconfig.json",
        extraFileExtensions: [".vue"],
    },
    plugins: ["@typescript-eslint", "vue"],
    rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": ["error", { destructuredArrayIgnorePattern: "^_" }],
        "vue/multi-word-component-names": "off",
        "vue/no-mutating-props": ["error", { shallowOnly: true }],
    },
    globals: {
        defineModel: "readonly",
    },
};
