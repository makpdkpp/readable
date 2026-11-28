CREATE TABLE `novel_tags` (
	`novel_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`novel_id`, `tag_id`),
	FOREIGN KEY (`novel_id`) REFERENCES `novels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `novel_tags_tag_id_idx` ON `novel_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE INDEX `chapters_novel_id_number_idx` ON `chapters` (`novel_id`,`number`);--> statement-breakpoint
CREATE INDEX `novels_author_id_idx` ON `novels` (`author_id`);--> statement-breakpoint
CREATE INDEX `novels_status_idx` ON `novels` (`status`);--> statement-breakpoint
-- หมวดเริ่มต้น (seed.sql ใช้ id 1, 2 ตรงกัน)
INSERT OR IGNORE INTO `categories` (`id`, `slug`, `name`) VALUES
	(1, 'romance', 'โรแมนติก'),
	(2, 'fantasy', 'แฟนตาซี'),
	(3, 'drama', 'ดราม่า'),
	(4, 'mystery', 'สืบสวน / ลึกลับ'),
	(5, 'horror', 'สยองขวัญ'),
	(6, 'action', 'แอ็กชัน / ผจญภัย'),
	(7, 'scifi', 'ไซไฟ'),
	(8, 'yaoi', 'วาย'),
	(9, 'yuri', 'ยูริ'),
	(10, 'comedy', 'ตลก'),
	(11, 'fanfic', 'แฟนฟิค'),
	(12, 'other', 'อื่น ๆ');
