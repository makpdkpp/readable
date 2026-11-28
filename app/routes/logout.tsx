import { redirect } from "react-router";

import type { Route } from "./+types/logout";
import { assertSameOrigin, destroySession } from "~/lib/auth/session.server";

export async function action({ request }: Route.ActionArgs) {
  assertSameOrigin(request);
  throw redirect("/", { headers: { "Set-Cookie": await destroySession(request) } });
}

export function loader() {
  throw redirect("/");
}
