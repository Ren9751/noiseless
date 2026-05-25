import Link from "next/link";

export function Nav() {
  return (
    <nav className="border-b sticky top-0 bg-background z-10">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          noiseless
        </Link>
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          設定
        </Link>
      </div>
    </nav>
  );
}
