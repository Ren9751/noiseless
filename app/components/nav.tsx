"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav() {
  const pathname = usePathname();
  if (pathname?.startsWith("/onboarding")) return null;

  return (
    <nav className="border-b sticky top-0 bg-background z-10">
      <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          noiseless
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/likes" className="hover:text-foreground">
            いいね
          </Link>
          <Link href="/settings" className="hover:text-foreground">
            設定
          </Link>
        </div>
      </div>
    </nav>
  );
}
