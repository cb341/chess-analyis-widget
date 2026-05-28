const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    ignores: ["node_modules/**"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        console: "readonly",
        customElements: "readonly",
        document: "readonly",
        HTMLElement: "readonly",
        JSON: "readonly",
        Number: "readonly",
        RegExp: "readonly",
        String: "readonly",
        URL: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
