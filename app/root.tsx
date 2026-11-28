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
import { getCurrentUser } from "~/lib/auth/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  return { user: user && { displayName: user.displayName, isAdmin: user.role === "admin" } };
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,400;0,600;0,700;1,400&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
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
      <nav className="flex items-center gap-4 text-sm">
        <Link to="/login" className="hover:underline">เข้าสู่ระบบ</Link>
        <Link to="/signup" className="rounded-md bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700">
          สมัครสมาชิก
        </Link>
      </nav>
    );
  }
  return (
    <nav className="flex items-center gap-4 text-sm">
      {user.isAdmin && (
        <Link to="/admin/review" className="hover:underline">อนุมัติเรื่อง</Link>
      )}
      <Link to="/write" className="hover:underline">เขียนนิยาย</Link>
      <Link to="/profile" className="font-semibold hover:underline">{user.displayName}</Link>
      <Form method="post" action="/logout">
        <button type="submit" className="text-stone-500 hover:underline">ออกจากระบบ</button>
      </Form>
    </nav>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <a href="/" className="text-xl font-bold tracking-tight">
            readable
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
