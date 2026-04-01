export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Meeting Intelligence Hub</title>
      </head>
      <body>{children}</body>
    </html>
  );
}