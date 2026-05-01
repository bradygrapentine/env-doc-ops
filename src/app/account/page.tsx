import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { userRepo } from "@/lib/db";
import ChangePasswordForm from "./ChangePasswordForm";
import ChangeEmailForm from "./ChangeEmailForm";
import EmailVerificationStatus from "./EmailVerificationStatus";
import EmailChangeBanner from "./EmailChangeBanner";
import DeleteAccountSection from "./DeleteAccountSection";

export default async function AccountPage(props: { searchParams?: { email_change?: string } }) {
  const searchParams = props?.searchParams;
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/signin");
  }
  const user = userRepo.findById(userId);
  if (!user) {
    redirect("/signin");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Account</h1>

      <EmailVerificationStatus verified={!!user.emailVerifiedAt} />
      <EmailChangeBanner status={searchParams?.email_change} />

      <section className="bg-white border rounded p-6">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex gap-3">
            <dt className="w-24 text-gray-500">Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 text-gray-500">Email</dt>
            <dd>{user.email}</dd>
          </div>
        </dl>
      </section>

      <section className="bg-white border rounded p-6">
        <h2 className="text-lg font-semibold mb-4">Change email</h2>
        <ChangeEmailForm currentEmail={user.email} />
      </section>

      <section className="bg-white border rounded p-6">
        <h2 className="text-lg font-semibold mb-4">Change password</h2>
        <ChangePasswordForm />
      </section>

      <section className="bg-white border border-red-200 rounded p-6">
        <h2 className="text-lg font-semibold mb-4 text-red-700">Danger zone</h2>
        <DeleteAccountSection />
      </section>
    </div>
  );
}
