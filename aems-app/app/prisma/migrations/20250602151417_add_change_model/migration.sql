-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_assigneeId_fkey";

-- AlterTable
ALTER TABLE "Change" ALTER COLUMN "data" DROP NOT NULL;

-- AlterTable
ALTER TABLE "_BannerToUser" ADD CONSTRAINT "_BannerToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_BannerToUser_AB_unique";

-- AlterTable
ALTER TABLE "_ConfigurationsToHolidays" ADD CONSTRAINT "_ConfigurationsToHolidays_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ConfigurationsToHolidays_AB_unique";

-- AlterTable
ALTER TABLE "_Units_users" ADD CONSTRAINT "_Units_users_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_Units_users_AB_unique";

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
