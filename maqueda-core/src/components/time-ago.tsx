"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";

/**
 * Relative time that never causes hydration mismatches: the server value may differ by a few seconds
 * from the client's, so the span opts out of the comparison and then re-renders every 30 s.
 */
export function TimeAgo({ date, className }: { date: Date | string | null | undefined; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    <span className={className} suppressHydrationWarning title={d ? d.toLocaleString("en-GB") : undefined}>
      {timeAgo(d)}
    </span>
  );
}
