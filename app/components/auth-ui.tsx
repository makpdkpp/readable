import type { OAuthProvider } from "~/db/schema";

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-bold mb-6 text-center">{title}</h1>
      <div className="rounded-lg border border-stone-200 dark:border-stone-800 p-6 space-y-4">
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  defaultValue,
  required = true,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 w-full rounded-md border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">
      {message}
    </p>
  );
}

export function SubmitButton({ children, busy }: { children: React.ReactNode; busy?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-md bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

const PROVIDER_LABEL: Record<OAuthProvider, string> = {
  google: "ดำเนินการต่อด้วย Google",
  line: "ดำเนินการต่อด้วย LINE",
};

const PROVIDER_STYLE: Record<OAuthProvider, string> = {
  google: "border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-900",
  line: "bg-[#06C755] text-white hover:bg-[#05b34c]",
};

export function OAuthButtons({
  providers,
  redirectTo,
}: {
  providers: OAuthProvider[];
  redirectTo: string;
}) {
  if (providers.length === 0) return null;
  return (
    <>
      <div className="space-y-2">
        {providers.map((p) => (
          <a
            key={p}
            href={`/auth/${p}?redirectTo=${encodeURIComponent(redirectTo)}`}
            className={`block w-full rounded-md px-4 py-2 text-center font-semibold ${PROVIDER_STYLE[p]}`}
          >
            {PROVIDER_LABEL[p]}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-stone-500">
        <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
        หรือใช้อีเมล
        <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
      </div>
    </>
  );
}
