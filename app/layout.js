import './globals.css';

export const metadata = {
  title: "NFL 5-Pick'em",
  description: 'Weekly 5-Pick NFL Challenge',
  manifest: '/manifest.json',
  themeColor: '#020617',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: "5-Pick'em"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nfl.png&w=192&h=192" />
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}