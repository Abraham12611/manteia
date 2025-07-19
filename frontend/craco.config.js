module.exports = {
  eslint: {
    enable: false,
  },
  typescript: {
    enableTypeChecking: false,
  },
  webpack: {
    configure: (webpackConfig, { env }) => {
      if (env === 'production') {
        webpackConfig.devtool = false;
      }
      return webpackConfig;
    },
  },
};
