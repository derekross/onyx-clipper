const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const browser = env.browser || 'chrome';
  const isFirefox = browser === 'firefox';
  const outputPath = isFirefox ? 'dist_firefox' : 'dist';

  return {
    entry: {
      popup: './src/core/popup.ts',
      settings: './src/core/settings.ts',
      background: './src/background.ts',
      content: './src/content.ts',
      style: './src/styles/style.scss',
      highlighter: './src/styles/highlighter.scss',
    },
    output: {
      path: path.resolve(__dirname, outputPath),
      filename: '[name].js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.scss$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            'sass-loader',
          ],
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
          ],
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new CopyPlugin({
        patterns: [
          {
            from: isFirefox
              ? 'src/manifest.firefox.json'
              : 'src/manifest.chrome.json',
            to: 'manifest.json',
          },
          {
            from: 'src/core/popup.html',
            to: 'popup.html',
          },
          {
            from: 'src/core/settings.html',
            to: 'settings.html',
          },
          {
            from: 'icons',
            to: 'icons',
          },
          {
            from: 'node_modules/webextension-polyfill/dist/browser-polyfill.min.js',
            to: 'browser-polyfill.min.js',
          },
        ],
      }),
    ],
    devtool: argv.mode === 'development' ? 'inline-source-map' : false,
    optimization: {
      minimize: argv.mode === 'production',
      // Use named chunk IDs to avoid conflicts with external scripts
      chunkIds: 'named',
      splitChunks: {
        chunks: 'async',
        name: (module, chunks, cacheGroupKey) => {
          return `chunk-${cacheGroupKey}`;
        },
      },
    },
  };
};
