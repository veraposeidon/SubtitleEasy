const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ZipWebpackPlugin = require('zip-webpack-plugin');
const rimraf = require('rimraf');

module.exports = {
  mode: 'production',
  entry: {
    // No entry point needed if you only want to copy files
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{ from: 'subtitle.dual', to: './' }]
    }),
    new ZipWebpackPlugin({
      path: path.resolve(__dirname, 'dist'),
      filename: 'subtitle_easy.zip'
    })
  ],
  devtool: 'source-map'
};

// 清除 dist 文件夹
rimraf.sync(path.resolve(__dirname, 'dist'));
