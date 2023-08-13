const { defineConfig } = require('cypress')
module.exports = defineConfig({
  experimentalWebKitSupport: true,
  e2e: {
    supportFile: false,
    specPattern: "cypress.spec.js"
  }
},
)
