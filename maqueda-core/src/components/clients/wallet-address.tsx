"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { explorerAddressUrl } from "@/lib/chains";
import { shortAddress } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export function WalletAddress({ address, chainId, full = false, className }: { address: string; chainId: string | null; full?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const explorer = explorerAddressUrl(chainId, address);

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable (http, permissions): nothing to do
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-sm", className)}>
      <span className={full ? "break-all" : undefined}>{full ? address : shortAddress(address)}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-6" onClick={copy} aria-label="Copy address">
            {copied ? <CheckIcon className="size-3 text-success" /> : <CopyIcon className="size-3" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied" : "Copy address"}</TooltipContent>
      </Tooltip>
      {explorer && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" className="size-6" aria-label="Open in explorer">
              <a href={explorer} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                <ExternalLinkIcon className="size-3" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open in explorer</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}
