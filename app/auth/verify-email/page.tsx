import { VerifyEmailComponent } from '@/components/auth/VerifyEmailComponent';

export const metadata = {
  title: 'Verify Email | Meeting Intelligence Hub',
};

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <VerifyEmailComponent />
    </div>
  );
}
