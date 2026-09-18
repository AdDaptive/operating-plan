import ActivateForm from "./ActivateForm";

/**
 * Public landing page for an invite link (see POST /api/admin/invite and
 * src/lib/notifications.ts's sendAccountInviteEmail). Reads `token` via
 * the server-side `searchParams` prop rather than the client `useSearchParams`
 * hook, so this page doesn't need a Suspense boundary or opt out of static
 * rendering just to read one query param.
 */
export default function ActivatePage({ searchParams }: { searchParams: { token?: string } }) {
  return <ActivateForm token={searchParams?.token ?? ""} />;
}
