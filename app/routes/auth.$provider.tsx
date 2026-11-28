import { redirect } from "react-router";

import type { Route } from "./+types/auth.$provider";
import { isProvider, startOAuth } from "~/lib/auth/oauth.server";
import { safeRedirect } from "~/lib/auth/validation";

// เริ่มล็อกอินด้วย Google/LINE: ส่งผู้ใช้ไปหน้าของผู้ให้บริการ
export function loader({ request, params }: Route.LoaderArgs) {
  if (!isProvider(params.provider)) throw new Response("Not Found", { status: 404 });
  const redirectTo = safeRedirect(new URL(request.url).searchParams.get("redirectTo"));
  const start = startOAuth(params.provider, request, redirectTo);
  if (!start) throw redirect("/login?error=provider");
  throw redirect(start.url, { headers: { "Set-Cookie": start.cookie } });
}
