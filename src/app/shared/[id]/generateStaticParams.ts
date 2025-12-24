// For static export, we need to return an empty array
// This allows the route to exist but be rendered client-side
export function generateStaticParams() {
  return [];
}
