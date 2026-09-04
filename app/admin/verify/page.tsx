import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/AdminShell";
import { ManualVerify } from "@/components/admin/ManualVerify";

export const metadata: Metadata = {
  title: "Manual Verification",
};

export const dynamic = "force-dynamic";

/**
 * Manual Kick verification page
 * Temporary tool while Kick webhooks are being configured
 */
export default function ManualVerifyPage() {
  return (
    <>
      <AdminHeader
        title="Manual Verification"
        eyebrow="Temporary tool · Use while Kick webhooks are being set up"
      />

      <div className="mt-6">
        <ManualVerify />
      </div>
    </>
  );
}
