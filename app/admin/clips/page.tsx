import { hasDatabase } from '@/lib/db';
import { listClips, pinnedCount } from '@/lib/store/clips';
import { AdminHeader } from '@/components/admin/AdminShell';
import { ClipEditor } from '@/components/admin/ClipEditor';
import { Card } from '@/components/ui/surfaces';

export const metadata = { title: 'Clips' };
export const dynamic = 'force-dynamic';

export default async function AdminClipsPage() {
  if (!hasDatabase()) {
    return (
      <>
        <AdminHeader eyebrow="Clips and big wins" title="Clip editor" />
        <Card tone="gold">
          <div className="px-5 py-5">
            <p className="text-[15px] text-ink">No database is configured.</p>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-2">
              Clips are rows in Postgres. Add a Postgres service and set{' '}
              <code className="font-mono text-gold">DATABASE_URL</code>; the schema creates itself
              on the next request and this editor starts saving. Nothing else needs configuring.
            </p>
          </div>
        </Card>
      </>
    );
  }

  const [clips, pinned] = await Promise.all([listClips({ limit: 100 }), pinnedCount()]);

  return (
    <>
      <AdminHeader eyebrow="Clips and big wins" title="Clip editor" />
      <ClipEditor clips={clips} pinnedCount={pinned} />
    </>
  );
}
