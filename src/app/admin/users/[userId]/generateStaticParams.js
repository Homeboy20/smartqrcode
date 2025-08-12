// Generate static params for admin user detail pages
// Return empty array as these are admin pages that should be rendered client-side
export async function generateStaticParams() {
  return [];
}

// Allow dynamic parameters at runtime
export const dynamicParams = true;