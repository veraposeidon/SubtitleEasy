const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');

module.exports = {
  mode: 'production',
  entry: {
    // No entry point needed if you only want to copy files
  },
  plugins: [
    new WebpackManifestPlugin({
      fileName: 'manifest.json',
      seed: require('./subtitle.dual/manifest.json'),
      generate: (seed) => {
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
    })
  ],
  devtool: 'source-map'
};
