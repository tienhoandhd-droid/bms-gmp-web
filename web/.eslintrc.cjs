// Lưới an toàn cho đợt tách App.jsx: chỉ bắt biến/component CHƯA KHAI BÁO.
// Không bật rule style — không phải linter trình bày.
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
  plugins: ["react", "react-hooks"],
  settings: { react: { version: "detect" } },
  globals: { __BMS_VERSION__: "readonly", __BMS_BUILD_TIME__: "readonly" },
  rules: {
    "no-undef": "error",
    "react/jsx-no-undef": "error",
    // Đợt D 04/09/2026: luật hook — gọi sai thứ tự là lỗi thật; thiếu dependency chỉ cảnh báo (8 chỗ cũ đã có eslint-disable có chủ đích).
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
  },
};
