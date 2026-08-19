import type { Metadata, Viewport } from "next"
import { DM_Sans, JetBrains_Mono, Outfit } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const _dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const _jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const _outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] })

export const metadata: Metadata = {
  title: "Technik Solutions — Dashboard de Cotizaciones y Operaciones",
  description:
    "ERP interno de Technik Solutions: revisa, cotiza, aprueba y despacha cotizaciones de ingeniería desde el panel de administración.",
  applicationName: "Technik Solutions",
  authors: [{ name: "Technik Solutions" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#141C28",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="dark bg-background" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=location.pathname,s=location.search||"",h=location.hash||"",u=h+s;if(p.indexOf("/auth/callback")===0||/access_token=|refresh_token=|[?&]code=|token_hash=|type=invite|type=recovery|type=signup|type=magiclink|setup=password/.test(u)){sessionStorage.setItem("technik_must_set_password","1");sessionStorage.setItem("technik_auth_callback",JSON.stringify({s:s,h:h}))}}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans antialiased grain">
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
