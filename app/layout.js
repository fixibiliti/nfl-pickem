export const metadata = {
  title: "NFL 5-Pick'em",
  description: 'Weekly 5-Pick NFL Challenge',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: "5-Pick'em"
  }
};

export const viewport = {
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="apple-touch-icon"
          href="https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nfl.png&w=192&h=192"
        />
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}