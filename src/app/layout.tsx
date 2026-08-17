import type { Metadata, Viewport } from "next";
import { Frank_Ruhl_Libre, David_Libre, Noto_Serif_Hebrew, Assistant } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

// Self-hosted Hebrew fonts (selectable in Settings). Each exposes a CSS variable.
const frank = Frank_Ruhl_Libre({ subsets: ["hebrew"], variable: "--font-frank", display: "swap" });
const david = David_Libre({
  subsets: ["hebrew"],
  weight: ["400", "500", "700"],
  variable: "--font-david",
  display: "swap",
});
const notoSerif = Noto_Serif_Hebrew({
  subsets: ["hebrew"],
  variable: "--font-notoserif",
  display: "swap",
});
const assistant = Assistant({ subsets: ["hebrew"], variable: "--font-assistant", display: "swap" });

const fontVars = `${frank.variable} ${david.variable} ${notoSerif.variable} ${assistant.variable}`;

export const metadata: Metadata = {
  title: "שילוש · לימוד יומי",
  description: "דף יומי, נ״ך יומי, ושניים מקרא ואחד תרגום — הלימוד היומי שלך במקום אחד.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "שילוש",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efe0" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1710" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

// Sets the theme before paint to avoid a flash of the wrong theme.
const themeBootstrap = `
(function(){
  try {
    var t = localStorage.getItem('shilush:theme');
    if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    var st = JSON.parse(localStorage.getItem('shilush:settings:v1') || '{}');
    var fs = typeof st.fontScale === 'number' ? st.fontScale : 1;
    document.documentElement.style.setProperty('--reader-scale', String(fs));
    document.documentElement.setAttribute('data-font', typeof st.font === 'string' ? st.font : 'shofar');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={fontVars} suppressHydrationWarning>
      <body>
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <div className="app">{children}</div>
        <BottomNav />
        <ServiceWorkerRegister />
        {/* Analytics */}
        <Script
          src="https://nitur.dev/track.js"
          data-site-id="fd5b1ddf28f82afe49f49978"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
