/*
  Warnings:

  - Made the column `userId` on table `Child` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Child" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "birthDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Child_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Child" ("birthDate", "createdAt", "gender", "id", "name", "updatedAt", "userId") SELECT "birthDate", "createdAt", "gender", "id", "name", "updatedAt", "userId" FROM "Child";
DROP TABLE "Child";
ALTER TABLE "new_Child" RENAME TO "Child";
CREATE INDEX "Child_userId_idx" ON "Child"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
