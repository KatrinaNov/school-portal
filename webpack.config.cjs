const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
  const isProd = argv.mode === "production";

  return {
    mode: isProd ? "production" : "development",
    entry: {
      main: path.resolve(__dirname, "src", "index.js"),
      admin: path.resolve(__dirname, "src", "admin.js"),
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].bundle.js",
      clean: true,
      publicPath: "",
    },
    devtool: isProd ? false : "source-map",
    devServer: {
      static: {
        directory: path.resolve(__dirname, "dist"),
      },
      port: 5173,
      open: true,
      compress: true,
      client: {
        overlay: true,
      },
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "src", "index.html"),
        inject: "body",
        chunks: ["main"],
        filename: "index.html",
      }),
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "src", "admin.html"),
        inject: "body",
        chunks: ["admin"],
        filename: "admin.html",
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: path.resolve(__dirname, "assets"), to: "assets" },
          { from: path.resolve(__dirname, "data"), to: "data" },
          { from: path.resolve(__dirname, "favicon.svg"), to: "favicon.svg" },
        ],
      }),
    ],
    module: {
      rules: [],
    },
    resolve: {
      extensions: [".js"],
    },
    performance: {
      hints: false,
    },
    optimization: {
      splitChunks: false,
    },
  };
};

