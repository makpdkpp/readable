import {
  Form,
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { ThemeSwitcher, useActiveTheme } from "~/components/theme-switcher";
import { parseCookies } from "~/lib/auth/cookies";
import { getCurrentUser } from "~/lib/auth/session.server";
import { THEMES, THEME_COOKIE, resolveTheme } from "~/lib/theme";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  const theme = resolveTheme(user?.theme, parseCookies(request.headers.get("Cookie"))[THEME_COOKIE]);
  return { theme, user: user && { displayName: user.displayName, isAdmin: user.role === "admin" } };
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  // ธีมมาจาก cookie หรือบัญชี จึง render ได้ถูกตั้งแต่ฝั่ง server หน้าไม่กระพริบ
  const theme = useActiveTheme();
  return (
    <html lang="th" data-theme={theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <link rel="stylesheet" href={THEMES[theme].fontsHref} />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function UserNav() {
  const data = useRouteLoaderData<typeof loader>("root");
  const user = data?.user;
  if (!user) {
    return (
      <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm">
        <ThemeSwitcher />
        <Link to="/search" className="hover:underline">ค้นหา</Link>
        <Link to="/login" className="hover:underline">เข้าสู่ระบบ</Link>
        <Link to="/signup" className="btn btn-primary min-h-9! px-3! py-1! text-sm">
          สมัครสมาชิก
        </Link>
      </nav>
    );
  }
  return (
    <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm">
      <ThemeSwitcher />
      {user.isAdmin && (
        <Link to="/admin/review" className="hover:underline">แอดมิน</Link>
      )}
      <Link to="/search" className="hover:underline">ค้นหา</Link>
      <Link to="/library" className="hover:underline">ชั้นหนังสือ</Link>
      <Link to="/write" className="hover:underline">เขียนนิยาย</Link>
      <Link to="/profile" className="font-semibold hover:underline">{user.displayName}</Link>
      <Form method="post" action="/logout">
        <button type="submit" className="text-muted hover:underline">ออกจากระบบ</button>
      </Form>
    </nav>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="site-header">
        <div className="mx-auto max-w-5xl px-4 min-h-14 py-1 flex items-center justify-between gap-3">
          <a href="/" className="wordmark">
            readable<span className="wordmark-dot">.</span>
          </a>
          <UserNav />
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "เกิดข้อผิดพลาด";
  let details = "มีบางอย่างผิดพลาด ลองใหม่อีกครั้ง";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "เกิดข้อผิดพลาด";
    details =
      error.status === 404
        ? "ไม่พบหน้าที่ต้องการ"
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
