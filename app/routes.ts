import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("logout", "routes/logout.tsx"),
  route("profile", "routes/profile.tsx"),
  route("auth/:provider", "routes/auth.$provider.tsx"),
  route("auth/:provider/callback", "routes/auth.$provider.callback.tsx"),
] satisfies RouteConfig;
