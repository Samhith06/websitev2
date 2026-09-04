"use client";

import { useState, useEffect } from "react";
import { UserCheck, AlertTriangle } from "lucide-react";
import { Button, Input, Field } from "@/components/ui/controls";
import { Card } from "@/components/ui/surfaces";
import { Label, Display } from "@/components/ui/typography";

interface User {
  id: number;
  discordId: string;
  discordUsername: string;
  createdAt: string;
  kickUsername: string | null;
  verifiedAt: string | null;
  isVerified: boolean;
}

/**
 * Manual Kick verification tool
 * Use this while Kick webhooks are being configured
 */
export function ManualVerify() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Form state
  const [discordId, setDiscordId] = useState("");
  const [kickUserId, setKickUserId] = useState("");
  const [kickUsername, setKickUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadUsers();
  }, [showAll]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/manual-verify?all=${showAll}`);
      const data = await response.json();
      if (data.ok) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/manual-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordId: discordId.trim(),
          kickUserId: kickUserId.trim(),
          kickUsername: kickUsername.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ ${data.message}`);
        setDiscordId("");
        setKickUserId("");
        setKickUsername("");
        loadUsers(); // Refresh list
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setMessage("❌ Failed to verify. Check console for details.");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const quickFill = (user: User) => {
    setDiscordId(user.discordId);
  };

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <Card tone="gold" className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="shrink-0 text-gold" />
          <div className="text-sm">
            <p className="font-semibold text-gold">Temporary Tool</p>
            <p className="mt-1 text-gold/80">
              Use this to manually link Kick accounts while webhooks are being
              configured. This will not be needed once Kick webhooks are set up
              properly.
            </p>
          </div>
        </div>
      </Card>

      {/* Manual Verification Form */}
      <Card>
        <div className="border-b border-line px-5 py-3">
          <Label className="flex items-center gap-2">
            <UserCheck size={16} />
            Manual Kick Verification
          </Label>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <Field
            label="Discord ID"
            htmlFor="discord-id"
            hint="The user's numeric Discord ID (required)"
          >
            <Input
              id="discord-id"
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              placeholder="123456789012345678"
              required
            />
          </Field>

          <Field
            label="Kick User ID"
            htmlFor="kick-user-id"
            hint="Find at kick.com/api/v2/channels/username (numeric ID in user.id field)"
          >
            <Input
              id="kick-user-id"
              value={kickUserId}
              onChange={(e) => setKickUserId(e.target.value)}
              placeholder="987654"
              required
            />
          </Field>

          <Field
            label="Kick Username"
            htmlFor="kick-username"
            hint="The user's Kick username (case-sensitive)"
          >
            <Input
              id="kick-username"
              value={kickUsername}
              onChange={(e) => setKickUsername(e.target.value)}
              placeholder="username"
              required
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !discordId || !kickUserId || !kickUsername}
            full
          >
            {submitting ? "Verifying..." : "Link Kick Account"}
          </Button>

          {message && (
            <div
              className={`rounded-[3px] p-3 text-sm ${
                message.startsWith("✅")
                  ? "border border-brand-line bg-brand-bg text-brand"
                  : "border border-danger-line bg-danger-bg text-danger"
              }`}
            >
              {message}
            </div>
          )}
        </form>
      </Card>

      {/* User List */}
      <Card>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <Label>Users</Label>
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-brand hover:text-brand-dim"
          >
            {showAll ? "Show Unverified Only" : "Show All Users"}
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            {showAll ? "No users found." : "No unverified users found."}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {user.discordUsername}
                    </span>
                    {user.isVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-online-line bg-online-bg px-2 py-0.5 text-xs text-online">
                        <UserCheck size={12} />
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                    <span>Discord: {user.discordId}</span>
                    {user.kickUsername && (
                      <span>Kick: {user.kickUsername}</span>
                    )}
                  </div>
                </div>
                {!user.isVerified && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => quickFill(user)}
                  >
                    Verify
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Instructions */}
      <Card>
        <div className="border-b border-line px-5 py-3">
          <Label>How to Find Kick User ID</Label>
        </div>
        <div className="space-y-3 p-5 text-sm text-ink-2">
          <p>To get a user's Kick ID:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Visit:{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5">
                kick.com/api/v2/channels/username
              </code>
            </li>
            <li>Replace "username" with the actual Kick username</li>
            <li>
              Look for the{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5">user.id</code>{" "}
              field
            </li>
            <li>That's the numeric Kick User ID needed</li>
          </ol>
          <p className="mt-4 border-t border-line pt-3 text-faint">
            <strong>Note:</strong> Once Kick webhooks are configured at
            kick.com/dashboard/settings/developer, this manual process won't be
            needed. Users will just type their code in chat.
          </p>
        </div>
      </Card>
    </div>
  );
}
