// CRACO Configuration
// This file customizes the Create React App webpack configuration
module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Disable source-map-loader for node_modules
      webpackConfig.module.rules.forEach(rule => {
        if (rule.oneOf) {
          rule.oneOf.forEach(oneOfRule => {
            if (
              oneOfRule.use &&
              oneOfRule.use.some(use => use.loader && use.loader.includes('source-map-loader'))
            ) {
              oneOfRule.exclude = /node_modules/;
            }
          });
        }
      });

      return webpackConfig;
    },
  },
};