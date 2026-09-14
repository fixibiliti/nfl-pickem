import './globals.css';

export const metadata = {
  title: "NFL 5-Pick'em",
  description: 'Weekly 5-Pick NFL Challenge'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}