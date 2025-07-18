const { whenProd } = require('@craco/craco');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Ignore all warnings in production
      if (env === 'production') {
        webpackConfig.ignoreWarnings = [/./];

        // Disable source maps in production to reduce bundle size
        webpackConfig.devtool = false;

        // Ignore all ESLint warnings and errors
        webpackConfig.stats = {
          ...webpackConfig.stats,
          warnings: false,
          errors: false,
          errorDetails: false,
          children: false,
          chunks: false,
          chunkModules: false,
          modules: false,
          reasons: false,
          usedExports: false,
          providedExports: false,
          optimizationBailout: false,
          performance: false,
          source: false
        };
      }

      // Disable ESLint plugin completely
      const eslintPlugin = webpackConfig.plugins.find(
        plugin => plugin.constructor.name === 'ESLintWebpackPlugin'
      );
      if (eslintPlugin) {
        webpackConfig.plugins = webpackConfig.plugins.filter(
          plugin => plugin.constructor.name !== 'ESLintWebpackPlugin'
        );
      }

      return webpackConfig;
    },
  },
  eslint: {
    enable: false,
  },
  typescript: {
    enableTypeChecking: false,
  },
  devServer: {
    overlay: false,
  },
  ...whenProd(() => ({
    // Production-only configurations
    performance: {
      hints: false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000
    }
  }), {})
};