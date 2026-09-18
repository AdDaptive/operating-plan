import SetPasswordForm from "@/components/SetPasswordForm";

/** Public landing page for a "forgot password" link (see POST /api/forgot-password). */
export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  return <SetPasswordForm token={searchParams?.token ?? ""} mode="reset" />;
}
