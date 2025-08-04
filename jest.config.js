// jest.config.js
export default {
    testEnvironment: 'node',
    transform: {}, // Disable default Babel transform for ESM
    extensionsToTreatAsEsm: ['.js'],
    moduleNameMapper: {
        // Map CDN imports to local npm packages for testing in Node.js
        "^https://cdn\\.jsdelivr\\.net/npm/tweetnacl@(.*)/nacl\\.min\\.js$": "<rootDir>/node_modules/tweetnacl/nacl.js",
        "^https://cdn\\.jsdelivr\\.net/npm/text-encoding@(.*)/lib/encoding\\.min\\.js$": "<rootDir>/node_modules/text-encoding/lib/encoding.js",
        "^https://cdn\\.jsdelivr\\.net/npm/js-sha256@(.*)/src/sha256\\.min\\.js$": "<rootDir>/node_modules/js-sha256/src/sha256.js"
    },
    // Ensure Jest can resolve imports correctly from src/
    modulePaths: ["<rootDir>/src"],
    // Collect coverage from your source files
    collectCoverageFrom: [
        "src/**/*.js",
        "!src/index.js" // Exclude main entry point if it's just an orchestrator
    ],
    coverageDirectory: "coverage",
    coverageReporters: ["json", "lcov", "text", "clover"],
};