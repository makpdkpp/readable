import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  ...timestamps,
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const novels = sqliteTable("novels", {
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
});

export const chapters = sqliteTable("chapters", {
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
});

export const library = sqliteTable(
  "library",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    novelId: integer("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    lastChapterId: integer("last_chapter_id").references(() => chapters.id),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [primaryKey({ columns: [t.userId, t.novelId] })],
);

export type Novel = typeof novels.$inferSelect;
export type Rating = Novel["rating"];
export type NovelStatus = Novel["status"];
