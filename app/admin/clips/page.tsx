import { bigWins, clips } from '@/lib/mock';
import { AdminHeader } from '@/components/admin/AdminShell';
import { ClipEditor } from '@/components/admin/ClipEditor';

export const metadata = { title: 'Clips' };

export default function AdminClipsPage() {
  return (
    <>
      <AdminHeader eyebrow="Clips and big wins" title="Clip editor" />
      <ClipEditor clips={[...bigWins, ...clips]} />
    </>
  );
}
