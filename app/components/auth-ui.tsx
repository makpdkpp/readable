import type { OAuthProvider } from "~/db/schema";

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-3xl font-bold mb-6 text-center">{title}</h1>
      <div className="card p-6 space-y-4">
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
        className="field-input"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

export function SubmitButton({ children, busy }: { children: React.ReactNode; busy?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="btn btn-primary w-full"
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
  google: "btn-secondary",
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
            className={`btn w-full ${PROVIDER_STYLE[p]}`}
          >
            {PROVIDER_LABEL[p]}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        หรือใช้อีเมล
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}
