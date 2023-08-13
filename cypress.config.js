const { defineConfig } = require('cypress')
module.exports = defineConfig({
  experimentalWebKitSupport: true,
  e2e: {
    testIsolation: false,
    supportFile: false,
    specPattern: "cypress.spec.js"
  }
},
)
