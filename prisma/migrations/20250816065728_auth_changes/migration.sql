-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "passwordHash" STRING;
ALTER TABLE "accounts" ADD COLUMN     "passwordSalt" STRING;
