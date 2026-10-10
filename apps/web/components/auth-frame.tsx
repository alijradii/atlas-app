import { Button, Card } from "@school2036/ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Brand, PearlScene } from "./pearl";
import { accounts, initials, type Role, roleNames } from "./preview/data";
import { ThemeToggle } from "./theme-toggle";
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen p-4 sm:p-7">
      <header className="mx-auto mb-6 flex max-w-7xl items-center justify-between gap-4">
        <Brand />
        <ThemeToggle />
      </header>
      <main id="main-content" className="mx-auto max-w-7xl">
        <div className="grid overflow-hidden rounded-2xl border shadow-pearl lg:grid-cols-[.9fr_1.1fr]">
          <section className="pearl-panel p-7 sm:p-12 lg:p-16">
            <p className="eyebrow mb-6">
              A little direction. A lot of possibility.
            </p>
            <h1 className="mb-3 text-4xl">Sign in</h1>
            <p className="mb-8 text-muted-foreground">
              Welcome back. Your next step starts here.
            </p>
            {children}
            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
              Use the account created by your operator. Your uploads are private
              to your account.
            </p>
          </section>
          <div className="relative hidden min-h-[550px] lg:block">
            <PearlScene className="absolute inset-0" />
            <div className="absolute inset-x-10 bottom-10 rounded-2xl border border-white/40 bg-surface/75 p-7 backdrop-blur-lg">
              <p className="eyebrow mb-4">Your school. Your direction.</p>
              <h2 className="max-w-sm text-3xl leading-snug">
                Room to learn.
                <br />
                People to guide you.
              </h2>
            </div>
          </div>
        </div>
        <section aria-labelledby="preview-accounts" className="py-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-3">Explore Atlas Pearl</p>
              <h2 id="preview-accounts" className="text-2xl">
                One school. Different perspectives.
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Open a sample workspace. No login required; all school records
                are fictional.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/">
                Explore the design
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <Link key={a.id} href={`/preview/${a.id}/home`}>
                <Card className="h-full flex-row items-center gap-4 p-5 transition-colors hover:bg-surface">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-accent text-sm text-cobalt">
                    {initials(a.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-medium">
                      {a.name}
                    </strong>
                    <small className="mt-1 block text-muted-foreground">
                      {roleNames[a.role as Role]} ·{" "}
                      {a.id === "sami" ? "New student" : a.meta}
                    </small>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
