import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ekko Permissions - Hierarchical RBAC Demo",
  description: "Demonstration of hierarchical role-based access control with CQRS patterns",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center space-x-4">
                  <h1 className="text-xl font-semibold text-gray-900">
                    🌿 Ekko Permissions
                  </h1>
                  <span className="text-sm text-gray-500">
                    Hierarchical RBAC System
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  CQRS + Event Sourcing Demo
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1">
            {children}
          </main>
          <SpeedInsights />

          <footer className="bg-white border-t mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="text-center text-sm text-gray-500">
                Built with Next.js 14, TypeScript, Prisma, GraphQL & Tailwind CSS
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
