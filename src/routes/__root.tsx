import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AuthProvider } from "@/lib/auth/provider";
import appCss from "../styles.css?url";

const APP_NAME = "Atelier";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Catalogue your wardrobe, plan looks, and let a style analyzer dress you for the weather.",
      },
      { name: "theme-color", content: "#e3e4df" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      {
        rel: "preload",
        href: "/fonts/outfit.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: "/fonts/cormorant-italic.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/pwa/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/pwa/icon-180.png" },
    ],
  }),
  component: RootDocument,
});

const THEME_BOOT = `try{document.documentElement.setAttribute('data-theme','light');var keys=['atelier-wardrobe-v2','atelier-wardrobe-v1'];for(var i=0;i<keys.length;i++){var r=localStorage.getItem(keys[i]);if(!r)continue;var s=JSON.parse(r);var t=s&&s.state&&s.state.profile&&s.state.profile.theme;if(t==='dark'){document.documentElement.setAttribute('data-theme','light');break;}}}catch(e){}`;

function RootDocument() {
  return (
    <html lang="en" className="antialiased" data-theme="light" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="bg-bg text-fg">
        <PreviewHostBridge />
        <AuthProvider>
          <AppShell>
            <Outlet />
          </AppShell>
          <Toaster
            theme="system"
            position="top-center"
            toastOptions={{
              className: "bg-surface text-fg border-border",
            }}
          />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
