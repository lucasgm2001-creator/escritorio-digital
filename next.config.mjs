/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // lucide-react e o unico pacote-barril grande usado (29 arquivos). Declaracao explicita/defensiva:
    // o Next 14.2 ja inclui lucide-react na lista default de optimizePackageImports, entao o ganho
    // pratico tende a ~0 — mantido explicito por clareza e caso a default mude. Sem mudanca de comportamento.
    optimizePackageImports: ['lucide-react'],
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
};

export default nextConfig;
