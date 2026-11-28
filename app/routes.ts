import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("logout", "routes/logout.tsx"),
  route("profile", "routes/profile.tsx"),
  route("auth/:provider", "routes/auth.$provider.tsx"),
  route("auth/:provider/callback", "routes/auth.$provider.callback.tsx"),
  route("write", "routes/write._index.tsx"),
  route("write/new", "routes/write.new.tsx"),
  route("write/:novelId", "routes/write.$novelId.tsx"),
  route("write/:novelId/chapters/:chapterId", "routes/write.$novelId.chapters.$chapterId.tsx"),
  route("novel/:novelId", "routes/novel.$novelId.tsx"),
  route("novel/:novelId/chapter/:chapterId", "routes/novel.$novelId.chapter.$chapterId.tsx"),
  route("covers/:key", "routes/covers.$key.ts"),
  route("admin/review", "routes/admin.review.tsx"),
] satisfies RouteConfig;
