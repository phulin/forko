const path = require('path');

module.exports = {
  entry: {
    lib: './src/lib.ts',
    minehobo2: './src/minehobo2.ts',
    combat: './src/combat.ts',
    wl: './src/wl.ts',
  },
  mode: 'development',
  devtool: false,
  output: {
    path: path.resolve(__dirname, 'build', 'scripts', 'minehobo2'),
    filename: '[name].js',
    libraryTarget: 'commonjs',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
  },
  module: {
    rules: [
      {
        // Include ts, tsx, js, and jsx files.
        test: /\.(ts|js)x?$/,
        // exclude: /node_modules/,
        loader: 'babel-loader',
      },
    ],
  },
  plugins: [],
  externals: {
    kolmafia: 'commonjs kolmafia',
  },
};
