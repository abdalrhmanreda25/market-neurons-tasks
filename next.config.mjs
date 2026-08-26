/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,

  // The whole app runs in the browser against Firebase - there are no API
  // routes or server data fetches - so it exports to plain HTML/JS that any
  // static host (Hostinger shared hosting included) can serve from public_html.
  output: 'export',

  // Emits /dashboard/index.html rather than /dashboard.html, which is what
  // Apache expects when someone opens the URL directly.
  trailingSlash: true,

  // No Next image server exists on a static host.
  images: { unoptimized: true },
}

export default nextConfig
