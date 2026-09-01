"use client";

import { useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import { Button, Input, Field } from "@/components/ui/controls";
import { Card } from "@/components/ui/surfaces";
import { Label, Display } from "@/components/ui/typography";

/**
 * Admin tool to manually link Kick accounts
 * Use this while Kick webhooks are being configured
 */
export function ManualKickLink() {
  const [discordId, setDiscordId] = useState("");
  const [kickUsername, setKickUsername] = useState("");
  const [kickUserId, setKickUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleLink = async () => {
    if (!discordId || !kickUsername || !kickUserId) {
      setMessage("Please fill in all fields");
      setIsError(true);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/manual-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordId,
          kickUsername,
          kickUserId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || "Account linked successfully!");
        setIsError(false);
        // Clear form
        setDiscordId("");
        setKickUsername("");
        setKickUserId("");
      } else {
        setMessage(data.error || "Failed to link account");
        setIsError(true);
      }
    } catch (error) {
      setMessage("Network error. Please try again.");
      setIsError(true);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckLink = async () => {
    if (!discordId) {
      setMessage("Enter Discord ID to check");
      setIsError(true);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/manual-link?discordId=${discordId}`,
      );
      const data = await response.json();

      if (response.ok) {
        if (data.isLinked) {
          setMessage(
            `✅ Linked: @${data.discordUsername} → ${data.kickUsername} (ID: ${data.kickUserId})`,
          );
          setKickUsername(data.kickUsername);
          setKickUserId(data.kickUserId);
        } else {
          setMessage(
            `❌ Not linked: @${data.discordUsername} has no Kick account`,
          );
        }
        setIsError(false);
      } else {
        setMessage(data.error || "Failed to check link");
        setIsError(true);
      }
    } catch (error) {
      setMessage("Network error. Please try again.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <Label className="mb-2">Manual Kick Link Tool</Label>
        <Display size="s" as="h2">
          Link Kick Account
        </Display>
        <p className="mt-2 text-[13px] text-muted">
          Use this to manually link Kick accounts while webhooks are being
          configured. Find Discord ID in user profile or members list.
        </p>
      </div>

      <div className="space-y-4">
        <Field label="Discord ID" htmlFor="discord-id">
          <Input
            id="discord-id"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder="1234567890123456789"
          />
        </Field>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCheckLink}
            disabled={loading || !discordId}
            size="sm"
          >
            Check Current Link
          </Button>
        </div>

        <Field label="Kick Username" htmlFor="kick-username">
          <Input
            id="kick-username"
            value={kickUsername}
            onChange={(e) => setKickUsername(e.target.value)}
            placeholder="sunny_the_indian_gambler"
          />
        </Field>

        <Field label="Kick User ID" htmlFor="kick-user-id">
          <Input
            id="kick-user-id"
            value={kickUserId}
            onChange={(e) => setKickUserId(e.target.value)}
            placeholder="Get from Kick profile URL or API"
          />
          <p className="mt-1 text-[11.5px] text-faint">
            Tip: Visit kick.com/USERNAME and check the page source for user ID
          </p>
        </Field>

        <Button
          variant="primary"
          onClick={handleLink}
          disabled={loading || !discordId || !kickUsername || !kickUserId}
          full
        >
          <LinkIcon size={16} />
          {loading ? "Linking..." : "Link Accounts"}
        </Button>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-[3px] p-3 text-[13px] ${
            isError
              ? "border border-danger-line bg-danger-bg text-danger"
              : "border border-brand-line bg-brand-bg text-brand"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-6 rounded-[3px] border border-line bg-surface-2 p-4">
        <Label className="mb-2">How to find Kick User ID</Label>
        <ol className="space-y-2 text-[13px] text-ink-2">
          <li>1. Go to kick.com/USERNAME</li>
          <li>2. Right-click → View Page Source</li>
          <li>3. Search for "user_id" or "userId"</li>
          <li>4. Copy the numeric ID</li>
        </ol>
        <p className="mt-3 text-[12px] text-muted">
          Alternative: Use browser DevTools Network tab when loading profile
        </p>
      </div>
    </Card>
  );
}
