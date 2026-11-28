import { redirect } from "react-router";

import type { Route } from "./+types/auth.$provider.callback";
import {
  clearStateCookie,
  findOrCreateOAuthUser,
  finishOAuth,
  isProvider,
} from "~/lib/auth/oauth.server";
import { createSession } from "~/lib/auth/session.server";
import { safeRedirect } from "~/lib/auth/validation";

// Google/LINE ส่งผู้ใช้กลับมาที่นี่หลังกดยินยอม
export async function loader({ request, params }: Route.LoaderArgs) {
  if (!isProvider(params.provider)) throw new Response("Not Found", { status: 404 });
  const headers = new Headers({ "Set-Cookie": clearStateCookie(request) });

  let result: Awaited<ReturnType<typeof finishOAuth>> = null;
  try {
    result = await finishOAuth(params.provider, request);
  } catch (e) {
    console.error(`oauth ${params.provider} failed`, e);
  }
  if (!result) throw redirect("/login?error=oauth", { headers });

  const userId = await findOrCreateOAuthUser(params.provider, result.profile);
  headers.append("Set-Cookie", await createSession(request, userId));
  throw redirect(safeRedirect(result.redirectTo), { headers });
}
