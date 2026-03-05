/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js", "**/*.test.js"],
  roots: ["<rootDir>/assets/js"],
  moduleFileExtensions: ["js"],
  collectCoverageFrom: ["assets/js/quizEngine.js"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
};
