/**
 * The staff area's eleven screens, in three groups.
 *
 * Moderation first because it is the work: those are what a mod has open
 * during a stream. Data and System are reference and configuration, reached
 * occasionally.
 */
export type AdminSection = {
  href: string;
  label: string;
  group: 'work' | 'data' | 'sys';
  /** Owner-only screens are hidden from mods rather than shown disabled. */
  ownerOnly?: boolean;
};

export const ADMIN_SECTIONS: AdminSection[] = [
  { href: '/admin', label: 'Approvals', group: 'work' },
  { href: '/admin/payouts', label: 'Payouts', group: 'work' },
  { href: '/admin/leaderboard', label: 'Leaderboard', group: 'work' },
  { href: '/admin/milestones', label: 'Milestone tiers', group: 'work', ownerOnly: true },
  { href: '/admin/raffles', label: 'Raffles', group: 'work' },
  { href: '/admin/store', label: 'Store', group: 'work' },
  { href: '/admin/users', label: 'Users', group: 'data' },
  { href: '/admin/razed', label: 'Razed wagerers', group: 'data' },
  { href: '/admin/badges', label: 'Badges', group: 'data' },
  { href: '/admin/settings', label: 'Coin settings', group: 'sys', ownerOnly: true },
  { href: '/admin/audit', label: 'Audit log', group: 'sys' },
];

export const GROUP_LABELS: Record<AdminSection['group'], string> = {
  work: 'Moderation',
  data: 'Data',
  sys: 'System',
};
