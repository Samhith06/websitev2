import { AdminHeader } from "@/components/admin/AdminShell";
import { ManualKickLink } from "@/components/admin/ManualKickLink";

export const metadata = { title: "Kick Account Linking" };

export const dynamic = "force-dynamic";

export default function KickLinkPage() {
  return (
    <>
      <AdminHeader
        title="Kick Account Linking"
        eyebrow="Manual verification while webhooks are being configured"
      />

      <div className="max-w-2xl">
        <ManualKickLink />
      </div>

      <div className="mt-6 rounded-[3px] border border-gold-line bg-gold-bg p-4">
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          <strong className="text-gold">Temporary tool:</strong> Once Kick
          webhooks are properly configured, verification will happen
          automatically when users type their code in chat. This manual tool is
          only needed during setup.
        </p>
      </div>
    </>
  );
}
