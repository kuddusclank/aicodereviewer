"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
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

  const utils = trpc.useUtils();
  const isConnected = trpc.linear.isConnected.useQuery(undefined, {
    enabled: open,
  });

  const saveApiKey = trpc.linear.saveApiKey.useMutation({
    onSuccess: () => {
      utils.linear.isConnected.invalidate();
      utils.linear.getIssuesForPRs.invalidate();
      utils.linear.getIssueForPR.invalidate();
      setApiKey("");
    },
  });

  const handleConnect = () => {
    if (!apiKey.trim()) return;
    saveApiKey.mutate({ apiKey: apiKey.trim() });
  };

  const handleDisconnect = () => {
    saveApiKey.mutate({ apiKey: null });
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

        {isConnected.data?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500" />
              Linear is connected
            </div>
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={saveApiKey.isPending}
              >
                {saveApiKey.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
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
                disabled={!apiKey.trim() || saveApiKey.isPending}
              >
                {saveApiKey.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Connect
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
