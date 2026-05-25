import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: [
      ".vercel/**",
      "node_modules/**",
      "package-lock.json",
      "tsconfig.tsbuildinfo",
    ],
  },
];
