const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ZipWebpackPlugin = require('zip-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');

const rimraf = require('rimraf');

module.exports = {
  mode: 'production',
  entry: {
    // No entry point needed if you only want to copy files
  },
  plugins: [
    new CopyWebpackPlugin({
      // copy subtitle.dual folder to dist except manifest.json
      patterns: [
        {
          from: path.resolve(__dirname, 'subtitle.dual'),
          to: path.resolve(__dirname, 'dist'),
          globOptions: {
            ignore: ['**/manifest.json']
          }
        }
      ]
    }),
    new WebpackManifestPlugin({
      fileName: 'manifest.json',
      seed: require('./subtitle.dual/manifest.json'),
      generate: (seed, files) => {
        const manifest = seed || {};

        // set version to current git commit tag and rm the prefix 'v'
        const version = require('child_process')
          .execSync('git describe --tags --always')
          .toString()
          .trim()
          .replace(/^v/, '');

        console.log('version', version);
        manifest.version = version.toString();

        return manifest;
      }
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
