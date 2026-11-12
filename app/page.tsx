import { ArrowRight, BedDouble, Stethoscope } from 'lucide-react';

const forms = [
  {
    href: '/outpatient',
    title: 'Outpatient',
    description: 'You came for a visit or treatment and went home the same day.',
    icon: Stethoscope,
  },
  {
    href: '/inpatient',
    title: 'Inpatient',
    description: 'You were admitted and stayed with us overnight or longer.',
    icon: BedDouble,
  },
];

export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3">
          <img
            src="/value-family-hospital-logo.png"
            alt="Value Family Hospital logo"
            className="size-12 rounded-full object-cover"
          />
          <div className="space-y-0.5">
            <p className="text-base font-semibold text-primary">Value Family Hospital</p>
            <p className="text-xs text-muted-foreground">Kitende · Service with a difference</p>
          </div>
        </div>

        <h1 className="mt-12 text-3xl font-semibold text-balance">
          Tell us about your visit
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose the option that fits your stay.</p>

        <div className="mt-10 grid gap-3">
          {forms.map(({ href, title, description, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="group flex items-center gap-4 rounded-lg border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-muted-foreground">{description}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
