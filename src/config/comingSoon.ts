// Tenant slugs that should be routed to a pre-launch coming-soon landing
// page instead of the regular /auth/create signup flow.
//
// Add a slug here to opt a tenant into the waitlist experience. The slug
// must match exactly what QrLanding resolves from the qr_codes table or
// what's passed via the `?tenant=` URL parameter.
export const COMING_SOON_TENANT_SLUGS = new Set<string>([
  'st-joseph-medical-center-moq54rfp',
]);

export const isComingSoonTenant = (slug: string | null | undefined): boolean => {
  if (!slug) return false;
  return COMING_SOON_TENANT_SLUGS.has(slug.trim());
};
