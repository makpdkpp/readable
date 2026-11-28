import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarKey: text("avatar_key"),
  role: text("role", { enum: ["reader", "writer", "admin"] })
    .notNull()
    .default("reader"),
  birthDate: text("birth_date"), // YYYY-MM-DD ใช้ยืนยันอายุสำหรับเรื่อง 18+
  // null = สมัครผ่าน Google/LINE อย่างเดียว ยังไม่ได้ตั้งรหัสผ่าน
  passwordHash: text("password_hash"),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  // ธีมของเว็บที่ผู้ใช้เลือก (paper | market | cinema) null = ยังไม่เลือก
  theme: text("theme"),
  ...timestamps,
});

// เก็บเฉพาะ SHA-256 ของ token ใน cookie ถ้าฐานข้อมูลรั่วก็เอาไปใช้ล็อกอินไม่ได้
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const oauthAccounts = sqliteTable(
  "oauth_accounts",
  {
    provider: text("provider", { enum: ["google", "line"] }).notNull(),
    providerUserId: text("provider_user_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerUserId] }),
    index("oauth_accounts_user_id_idx").on(t.userId),
  ],
);

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const novels = sqliteTable(
  "novels",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    synopsis: text("synopsis").notNull().default(""),
    coverKey: text("cover_key"),
    categoryId: integer("category_id").references(() => categories.id),
    rating: text("rating", { enum: ["all", "13+", "18+"] })
      .notNull()
      .default("all"),
    status: text("status", {
      enum: ["draft", "pending_review", "ongoing", "completed", "rejected", "hidden"],
    })
      .notNull()
      .default("draft"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
    reviewNote: text("review_note"),
    ...timestamps,
  },
  (t) => [index("novels_author_id_idx").on(t.authorId), index("novels_status_idx").on(t.status)],
);

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const novelTags = sqliteTable(
  "novel_tags",
  {
    novelId: integer("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.novelId, t.tagId] }),
    index("novel_tags_tag_id_idx").on(t.tagId),
  ],
);

export const chapters = sqliteTable(
  "chapters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    novelId: integer("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    contentJson: text("content_json").notNull().default("{}"),
    contentHtml: text("content_html").notNull().default(""),
    wordCount: integer("word_count").notNull().default(0),
    status: text("status", { enum: ["draft", "scheduled", "published"] })
      .notNull()
      .default("draft"),
    publishAt: integer("publish_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (t) => [index("chapters_novel_id_number_idx").on(t.novelId, t.number)],
);

// แถวเดียวต่อผู้ใช้ต่อเรื่อง ใช้ทั้งชั้นหนังสือ (saved) และประวัติการอ่าน (lastReadAt)
export const library = sqliteTable(
  "library",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    novelId: integer("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    // ตอนที่อ่านล่าสุด ถ้านักเขียนลบตอนนั้นจะกลายเป็น null
    lastChapterId: integer("last_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    saved: integer("saved", { mode: "boolean" }).notNull().default(false),
    savedAt: integer("saved_at", { mode: "timestamp" }),
    // null = ยังไม่เคยเปิดอ่าน (กดเก็บเข้าชั้นอย่างเดียว) หรือลบออกจากประวัติแล้ว
    lastReadAt: integer("last_read_at", { mode: "timestamp" }),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.novelId] }),
    index("library_user_read_idx").on(t.userId, t.lastReadAt),
    index("library_user_saved_idx").on(t.userId, t.saved, t.savedAt),
  ],
);

export type Novel = typeof novels.$inferSelect;
export type Rating = Novel["rating"];
export type NovelStatus = Novel["status"];
export type Chapter = typeof chapters.$inferSelect;
export type ChapterStatus = Chapter["status"];
export type User = typeof users.$inferSelect;
export type OAuthProvider = (typeof oauthAccounts.$inferSelect)["provider"];
