export default {
  preset: 'vercel',
  entry: './dist/server/server.js',
  publicAssets: [
    {
      dir: './dist/client',
      maxAge: 31536000
    }
  ]
};
