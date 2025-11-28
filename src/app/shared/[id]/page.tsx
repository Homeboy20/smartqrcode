import SharedFileClient from './SharedFileClient';

interface SharedFilePageProps {
  params: {
    id: string;
  };
}

// Required for static export with output: 'export'
// Generates a placeholder page at build time; actual IDs are handled client-side
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

// Enable dynamic params so any id value works at runtime
export const dynamicParams = true;

export default function SharedFilePage({ params }: SharedFilePageProps) {
  return <SharedFileClient id={params.id} />;
}