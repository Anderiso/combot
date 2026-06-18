import Link from "next/link";

const links = [
  { href: "/", label: "Generate" },
  { href: "/remix", label: "Remix" },
  { href: "/work-orders", label: "Work orders" },
  { href: "/library", label: "Library" },
  { href: "/load", label: "Load" },
  { href: "/brand", label: "Brand" },
];

export function Nav() {
  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Ad Concept Research
        </Link>
        <nav className="flex flex-wrap gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
