'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { coins } from '@/lib/format';
import { Button, Chip, ChipRow, Input } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { Label } from '@/components/ui/typography';
import { CoinMark } from '@/components/ui/marks';
import { AdminRow, AdminTable, Cell, StatusPill } from './Table';
import { saveItem, setItemActive, setItemStock, type ActionResult } from '@/app/admin/shop/actions';
import type { ShopCategory } from '@/lib/types';

type Item = {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: ShopCategory;
  stock: number | null;
  cooldownDays: number | null;
  needsReview: boolean;
  active: boolean;
};

const COLS = 'lg:grid-cols-[1fr_110px_110px_120px_110px_150px]';
const CATEGORIES: ShopCategory[] = ['entries', 'discord', 'merch', 'stream'];

export function ShopEditor({ items }: { items: Item[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          size="sm"
          onClick={() => { setCreating(true); setEditing(null); setResult(null); }}
        >
          New item
        </Button>
      </div>

      {creating || editing ? (
        <ItemForm
          item={editing}
          onDone={(r) => { setResult(r); if (r.ok) { setCreating(false); setEditing(null); } }}
          onCancel={() => { setCreating(false); setEditing(null); }}
        />
      ) : null}

      {result ? (
        <p
          className={cn('mb-4 text-[13px]', result.ok ? 'text-brand' : 'text-danger')}
          role="status"
        >
          {result.ok ? result.message : result.error}
        </p>
      ) : null}

      <AdminTable cols={COLS} columns={['Item', 'Category', 'Cost', 'Stock', 'Cooldown', '']}>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-[13.5px] text-muted">
            No items yet. A shop with nothing in it makes the coins people are earning pointless,
            so this is worth filling first.
          </p>
        ) : null}
        {items.map((item) => (
          <ItemRow key={item.id} item={item} onEdit={() => { setEditing(item); setCreating(false); }} onResult={setResult} />
        ))}
      </AdminTable>

      <p className="mt-5 max-w-3xl text-[12.5px] leading-relaxed text-muted">
        An out-of-stock item stays visible on the public shop with its price shown and the button
        replaced by a chip. Hiding it removes a reason to keep earning, which is the opposite of
        what the shop is for. Changing a price never rewrites history — a redemption records the
        cost it was made at.
      </p>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function ItemRow({
  item,
  onEdit,
  onResult,
}: {
  item: Item;
  onEdit: () => void;
  onResult: (r: ActionResult) => void;
}) {
  const [pending, start] = useTransition();
  const out = item.stock === 0;

  return (
    <AdminRow cols={COLS} tint={out ? 'gold' : undefined}>
      <Cell>
        <span className={cn('block truncate', item.active ? 'text-ink' : 'text-muted line-through')}>
          {item.name}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-muted">{item.description}</span>
      </Cell>
      <Cell label="Category" className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted">
        {item.category}
      </Cell>
      <Cell label="Cost">
        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-brand">
          <CoinMark size={13} />
          {coins(item.cost)}
        </span>
      </Cell>
      <Cell label="Stock" className="font-mono tabular-nums text-ink-2">
        {item.stock === null ? '∞' : item.stock}
      </Cell>
      <Cell label="Cooldown" className="font-mono text-[12.5px] tabular-nums text-faint">
        {item.cooldownDays ? `${item.cooldownDays} days` : '—'}
      </Cell>
      <Cell>
        <span className={cn('flex flex-wrap items-center gap-3 font-mono text-[11.5px]', pending && 'opacity-50')}>
          <StatusPill tone={out ? 'gold' : item.active ? 'brand' : 'muted'}>
            {out ? 'Out of stock' : item.active ? 'Live' : 'Hidden'}
          </StatusPill>
          <button type="button" onClick={onEdit} className="text-brand hover:underline">Edit</button>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => onResult(await setItemActive(Number(item.id), !item.active)))}
            className="text-muted hover:underline"
          >
            {item.active ? 'Hide' : 'Show'}
          </button>
          {out ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => onResult(await setItemStock(Number(item.id), 1)))}
              className="text-gold hover:underline"
            >
              Restock 1
            </button>
          ) : null}
        </span>
      </Cell>
    </AdminRow>
  );
}

/* -------------------------------------------------------------------------- */

function ItemForm({
  item,
  onDone,
  onCancel,
}: {
  item: Item | null;
  onDone: (r: ActionResult) => void;
  onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  const [category, setCategory] = useState<ShopCategory>(item?.category ?? 'entries');
  const [needsReview, setNeedsReview] = useState(item?.needsReview ?? false);
  const [active, setActive] = useState(item?.active ?? true);

  return (
    <Card className="mb-5">
      <div className="border-b border-line px-4 py-3">
        <Label>{item ? `Edit — ${item.name}` : 'New item'}</Label>
      </div>

      <form
        action={(data) => {
          if (item) data.set('id', item.id);
          data.set('category', category);
          if (needsReview) data.set('needsReview', 'on');
          if (active) data.set('active', 'on');
          start(async () => onDone(await saveItem(data)));
        }}
      >
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1.5">Name</Label>
            <Input name="name" defaultValue={item?.name ?? ''} className="h-9 text-[13px]" required />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5">Description</Label>
            <Input name="description" defaultValue={item?.description ?? ''} className="h-9 text-[13px]" />
          </div>
          <div>
            <Label className="mb-1.5">Cost in coins</Label>
            <Input name="cost" type="number" min={1} defaultValue={item?.cost ?? ''} className="h-9 text-[13px]" required />
          </div>
          <div>
            <Label className="mb-1.5">Stock — blank for unlimited</Label>
            <Input name="stock" type="number" min={0} defaultValue={item?.stock ?? ''} className="h-9 text-[13px]" />
          </div>
          <div>
            <Label className="mb-1.5">Cooldown in days — blank for none</Label>
            <Input name="cooldownDays" type="number" min={1} defaultValue={item?.cooldownDays ?? ''} className="h-9 text-[13px]" />
          </div>
          <div>
            <Label className="mb-1.5">Category</Label>
            <ChipRow label="">
              {CATEGORIES.map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>
              ))}
            </ChipRow>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 border-t border-line px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)} className="size-4 accent-[#2B8FFF]" />
            A moderator reviews this before it is granted
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[#2B8FFF]" />
            Live in the shop
          </label>
          <span className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
            <Button size="sm" disabled={pending}>{pending ? 'Saving…' : 'Save item'}</Button>
          </span>
        </div>
      </form>

      <p className="border-t border-line px-4 py-3 text-[12.5px] leading-relaxed text-muted">
        Leave stock blank for unlimited; zero means sold out. Entries and Discord roles are usually
        granted straight away, merch and on-stream items reviewed — that is what the review box
        controls, and the public shop already says so.
      </p>
    </Card>
  );
}
