"use client";

import { useState } from "react";
import { Power, PowerOff } from "lucide-react";
import { Button, Input, Field } from "@/components/ui/controls";
import { Card } from "@/components/ui/surfaces";
import { Label, Display } from "@/components/ui/typography";

/**
 * Admin control for manually setting stream status
 * Use this for testing before Kick webhooks are configured
 */
export function StreamControl({
  initialLive = false,
}: {
  initialLive?: boolean;
}) {
  const [live, setLive] = useState(initialLive);
  const [title, setTitle] = useState("Live on Kick");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSetStatus = async (action: "live" | "offline") => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/stream-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          title: action === "live" ? title : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setLive(action === "live");
        setMessage(data.message);
        // Refresh the page to update UI
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage("Failed to update stream status");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <Label className="mb-2">Manual Stream Control</Label>
        <Display size="s" as="h2">
          Stream Status: {live ? "LIVE" : "OFFLINE"}
        </Display>
        <p className="mt-2 text-[13px] text-muted">
          Use this to manually control stream status while testing. Once Kick
          webhooks are configured, this will be automatic.
        </p>
      </div>

      {live ? (
        <div className="space-y-4">
          <div className="rounded-[3px] border border-online-line bg-online-bg p-4">
            <div className="flex items-center gap-2 text-online">
              <Power size={20} />
              <span className="font-mono text-[13px] uppercase tracking-wider">
                Currently Live
              </span>
            </div>
          </div>
          <Button
            variant="danger"
            onClick={() => handleSetStatus("offline")}
            disabled={loading}
            full
          >
            <PowerOff size={16} />
            Mark as Offline
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Stream Title" htmlFor="stream-title">
            <Input
              id="stream-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter stream title..."
            />
          </Field>
          <Button
            variant="primary"
            onClick={() => handleSetStatus("live")}
            disabled={loading || !title.trim()}
            full
          >
            <Power size={16} />
            Mark as Live
          </Button>
        </div>
      )}

      {message && (
        <div
          className={`mt-4 rounded-[3px] p-3 text-[13px] ${
            message.includes("Error")
              ? "border border-danger-line bg-danger-bg text-danger"
              : "border border-brand-line bg-brand-bg text-brand"
          }`}
        >
          {message}
        </div>
      )}
    </Card>
  );
}
