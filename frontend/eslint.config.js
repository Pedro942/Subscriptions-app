const tsParser = require("@typescript-eslint/parser");

module.exports = [
  {
    ignores: ["node_modules/**", ".expo/**", "dist/**"],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
];
