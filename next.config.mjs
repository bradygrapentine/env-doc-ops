/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["postgres", "pdfkit"],
  },
};

export default nextConfig;
