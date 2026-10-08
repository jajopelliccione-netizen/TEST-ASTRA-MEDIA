/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strumento interno: non deve essere indicizzato ne' raggiungibile da fuori.
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};
export default nextConfig;
