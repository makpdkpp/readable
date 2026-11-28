-- สร้างตาราง library ใหม่: เพิ่มคอลัมน์ชั้นหนังสือ/ประวัติ และให้ last_chapter_id เป็น null เมื่อตอนถูกลบ
-- ไม่มีตารางไหนอ้างถึง library จึงสร้างใหม่ได้ตรง ๆ (D1 ไม่รองรับ PRAGMA foreign_keys=OFF)
CREATE TABLE `__new_library` (
	`user_id` text NOT NULL,
	`novel_id` integer NOT NULL,
	`last_chapter_id` integer,
	`saved` integer DEFAULT false NOT NULL,
	`saved_at` integer,
	`last_read_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `novel_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`last_chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_library`("user_id", "novel_id", "last_chapter_id", "saved", "saved_at", "last_read_at", "updated_at")
SELECT "user_id", "novel_id", "last_chapter_id", 1, "updated_at", "updated_at", "updated_at" FROM `library`;--> statement-breakpoint
DROP TABLE `library`;--> statement-breakpoint
ALTER TABLE `__new_library` RENAME TO `library`;--> statement-breakpoint
CREATE INDEX `library_user_read_idx` ON `library` (`user_id`,`last_read_at`);--> statement-breakpoint
CREATE INDEX `library_user_saved_idx` ON `library` (`user_id`,`saved`,`saved_at`);
