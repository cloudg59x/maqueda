import { cn } from "@/lib/utils";

/**
 * Maqueda mark: an abstract hex "vault" with an orbit ring and a keystone node.
 * Monochrome, uses currentColor so it inherits the text color (white on the dark admin).
 */
export function Logo({ className, title = "Maqueda" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={cn("size-6 shrink-0", className)}
    >
      <title>{title}</title>
      {/* outer hexagon */}
      <path
        d="M32 4 L56 18 V46 L32 60 L8 46 V18 Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* inner hexagon, rotated 30deg feel via inset */}
      <path
        d="M32 16 L45 24 V40 L32 48 L19 40 V24 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {/* orbit ring, broken to feel like a circuit trace */}
      <path
        d="M12 32 A20 20 0 0 1 32 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M52 32 A20 20 0 0 1 32 52"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* core: solid diamond */}
      <path d="M32 24 L39 32 L32 40 L25 32 Z" fill="currentColor" />
      {/* keystone nodes */}
      <circle cx="32" cy="12" r="2.2" fill="currentColor" />
      <circle cx="32" cy="52" r="2.2" fill="currentColor" />
      <circle cx="12" cy="32" r="2.2" fill="currentColor" />
      <circle cx="52" cy="32" r="2.2" fill="currentColor" />
      {/* trace from core to right node */}
      <path d="M39 32 H49" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <path d="M15 32 H25" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}
