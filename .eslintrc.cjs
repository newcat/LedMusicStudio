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
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-redundant-type-constituents": "off",
        "@typescript-eslint/restrict-template-expressions": ["error", { allowNever: true }],
        "vue/multi-word-component-names": "off",
        "vue/no-mutating-props": ["error", { shallowOnly: true }],
    },
    globals: {
        defineModel: "readonly",
    },
};
