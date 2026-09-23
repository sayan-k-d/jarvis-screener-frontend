import type { Metadata } from "next";
import "../styles/globals.css";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "Jarvis — Weekly Momentum Screener",
  description: "Alpha Vantage-powered weekly momentum stock screener.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Font Awesome — used by the Jarvis AI assistant panel's icons. */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          referrerPolicy="no-referrer"
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

// import type { Metadata } from 'next';
// import '@/styles/globals.css';
// import { ThemeProvider } from '@/context/ThemeContext';

// export const metadata: Metadata = {
//   title: 'Jarvis — Weekly Momentum Screener',
//   description: 'Alpha Vantage-powered weekly momentum stock screener.',
// };

// export default function RootLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <html lang="en" data-theme="dark" suppressHydrationWarning>
//       <body>
//         <ThemeProvider>{children}</ThemeProvider>
//       </body>
//     </html>
//   );
// }
