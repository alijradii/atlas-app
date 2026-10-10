import type { Metadata } from "next";
import Script from "next/script";
import "./styles.css";
import { AssistantProvider } from "@/components/assistant/provider";
import { WorkspacePreferencesProvider } from "@/components/workspace-preferences";

export const metadata: Metadata = {
  title: {
    default: "Atlas — Learning, with people in your corner",
    template: "%s · Atlas",
  },
  description:
    "Explore Atlas: home learning, human guidance and honest evidence.",
};
const themeScript = `try{var t=localStorage.getItem('atlas-theme');document.documentElement.classList.toggle('dark',t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))}catch{}`;
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <Script id="atlas-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <a
          href="#main-content"
          className="sr-only fixed top-3 left-3 z-[100] rounded-full bg-surface px-5 py-3 focus:not-sr-only"
        >
          Skip to content
        </a>
        <WorkspacePreferencesProvider>
          <AssistantProvider>{children}</AssistantProvider>
        </WorkspacePreferencesProvider>
      </body>
    </html>
  );
}
