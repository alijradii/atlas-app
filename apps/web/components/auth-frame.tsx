import { Brand, PearlScene } from "./pearl";
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
      </main>
    </div>
  );
}
