// Example: How to wire fonts in your Next.js layout
// For App Router: app/layout.tsx
// For Pages Router: pages/_app.tsx

import "./styles/globals.v2.css";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({ 
  subsets: ["latin"], 
  variable: "--font-jetbrains",
  display: "swap",
});

const serifAccent = Source_Serif_4({ 
  subsets: ["latin"], 
  variable: "--font-serif-accent",
  display: "swap",
});

// App Router example
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} ${serifAccent.variable}`}>
      <body className="font-sans bg-role-bg-primary text-role-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}

// Alternative: If using Fraunces instead of Source Serif 4
// import { Fraunces } from "next/font/google";
// const serifAccent = Fraunces({ 
//   subsets: ["latin"], 
//   variable: "--font-serif-accent",
//   weight: ["400", "500", "600", "700"],
//   display: "swap",
// });
