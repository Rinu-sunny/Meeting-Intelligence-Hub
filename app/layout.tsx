import './globals.css';
import { AuthProvider } from '@/lib/auth/context';
import { Header } from '@/components/Header';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className="min-h-screen bg-transparent">
            <Header />
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}