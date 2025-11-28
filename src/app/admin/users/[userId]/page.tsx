import UserDetailClient from './UserDetailClient';

interface UserDetailPageProps {
  params: {
    userId: string;
  };
}

// Required for static export with output: 'export'
// Returns empty array - admin pages will be handled via client-side routing
export function generateStaticParams() {
  return [];
}

// Enable dynamic params so any userId value works at runtime
export const dynamicParams = true;

export default function UserDetailPage({ params }: UserDetailPageProps) {
  return <UserDetailClient userId={params.userId} />;
}
