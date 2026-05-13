export default {
  preset: 'vercel',
  entry: './dist/server/server.js',
  compatibilityDate: '2026-05-14',
  publicAssets: [
    {
      dir: './dist/client',
      maxAge: 31536000
    }
  ]
};
