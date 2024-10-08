import type { Metadata, Viewport } from "next";
import { Inter, Syne, Poppins } from "next/font/google";
import "./globals.css";
import Link from "next/link";

import { marketingConfig } from "@/config/marketing";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { MainNav } from "@/components/main-nav";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { siteConfig } from "@/config/site";

// Import fonts
const inter = Inter({ subsets: ["latin"] });
const syne = Syne({ subsets: ["latin"], weight: ["500", "700"] });
const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "600"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "BARK - BLINK COMMERCE",
  description:
    "The Blink E-Commerce Platform provides a streamlined solution for creating and managing online stores.",
  // Add more SEO metadata
  openGraph: {
    title: "BARK - BLINK COMMERCE",
    description:
      "The Blink E-Commerce Platform provides a streamlined solution for creating and managing online stores.",
    type: "website",
    url: "https://blinkcommerce.app", // Replace with your actual URL
    images: [
      {
        url: "https://ucarecdn.com/92d4d7ea-f9d8-429c-bf68-6f3bc69c1c02/goldenshoppingcart.jpg", // Replace with actual image URL
        width: 1200,
        height: 630,
        alt: "BARK Commerce",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.className} ${poppins.className}`}>
      <body
        className={cn(
          inter.className,
          "bg-gray-100 dark:bg-gray-900 min-h-screen"
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex min-h-screen flex-col relative">
            <header className="container z-50 bg-background">
              <div className="flex h-20 items-center justify-between py-6">
                <MainNav items={marketingConfig.mainNav} />
                <nav className="flex items-center gap-2">
                  <Button asChild>
                    <Link
                      target="_blank"
                      rel="noopener noreferrer"
                      href={siteConfig.links.docs}
                      className={cn(
                        buttonVariants({ variant: "secondary", size: "sm" }),
                        "px-4"
                      )}
                    >
                      Connect Wallet
                    </Link>
                  </Button>
                  <ThemeModeToggle />
                </nav>
              </div>
            </header>

            <div
              className={cn(
                "absolute inset-0 -z-10 bg-gray-100 dark:bg-gray-900"
              )}
            ></div>

            <main className="flex-1 space-y-20 container mx-auto">
              {children}
            </main>

            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
