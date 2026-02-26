"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

export function LinearConnect({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Convex query is reactive — auto-updates when the mutation changes the data
  const isConnected = useQuery(api.linear.isConnected);
  const saveApiKeyMutation = useMutation(api.linear.saveApiKey);

  const handleConnect = async () => {
    if (!apiKey.trim()) return;
    setIsSaving(true);
    try {
      await saveApiKeyMutation({ apiKey: apiKey.trim() });
      setApiKey("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsSaving(true);
    try {
      await saveApiKeyMutation({ apiKey: null });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Linear</DialogTitle>
          <DialogDescription>
            Link your Linear account to see issue details on pull requests.
            Create a personal API key in Linear Settings &gt; API.
          </DialogDescription>
        </DialogHeader>

        {isConnected?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500" />
              Linear is connected
            </div>
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                Disconnect
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="linear-api-key">API Key</Label>
              <Input
                id="linear-api-key"
                type="password"
                placeholder="lin_api_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={handleConnect}
                disabled={!apiKey.trim() || isSaving}
              >
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                Connect
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
