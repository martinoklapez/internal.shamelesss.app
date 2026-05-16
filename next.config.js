/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [{ source: '/profiles-cleanup', destination: '/profiles', permanent: true }]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig

