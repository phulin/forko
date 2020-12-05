const path = require('path');

module.exports = {
  entry: {
    minehobo2: './src/minehobo2.ts',
    'minehobo2-combat': './src/combat.ts',
    'minehobo2-lib': './src/lib.ts',
    asdonlib: './src/asdon.ts',
    wl: './src/wl.ts',
    hobostatus: './src/status.ts',
    sewers: './src/sewers.ts',
    ee: './src/ee.ts',
    rescue: './src/rescue.ts',
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
