-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" REAL NOT NULL,
    "rev" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" REAL NOT NULL,
    "expiresAt" REAL NOT NULL,
    "revokedAt" REAL,
    "replacedBy" TEXT,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "xp" REAL NOT NULL,
    "themeId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "prefs" TEXT NOT NULL,
    "notificationPrefs" TEXT NOT NULL,
    "streakProtection" TEXT NOT NULL,
    "onboardedAt" REAL,
    "updatedAt" REAL NOT NULL,
    "rev" INTEGER NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Habit" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "hue" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "goal" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "step" REAL NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "reminder" TEXT,
    "notes" TEXT,
    "createdAt" REAL NOT NULL,
    "order" REAL NOT NULL,
    "updatedAt" REAL NOT NULL,
    "deleted" BOOLEAN NOT NULL,
    "rev" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "id"),
    CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HabitLog" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "count" REAL NOT NULL,
    "completedAt" REAL,
    "updatedAt" REAL NOT NULL,
    "deleted" BOOLEAN NOT NULL,
    "rev" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "id"),
    CONSTRAINT "HabitLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "due" TEXT,
    "time" TEXT,
    "priority" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL,
    "doneAt" REAL,
    "habitId" TEXT,
    "focusSessions" REAL NOT NULL,
    "list" TEXT NOT NULL,
    "createdAt" REAL NOT NULL,
    "updatedAt" REAL NOT NULL,
    "deleted" BOOLEAN NOT NULL,
    "rev" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "id"),
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FocusSession" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "start" REAL NOT NULL,
    "end" REAL NOT NULL,
    "mode" TEXT NOT NULL,
    "minutes" REAL NOT NULL,
    "taskId" TEXT,
    "completed" BOOLEAN NOT NULL,
    "updatedAt" REAL NOT NULL,
    "deleted" BOOLEAN NOT NULL,
    "rev" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "id"),
    CONSTRAINT "FocusSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MoodLog" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "mood" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "note" TEXT,
    "loggedAt" REAL NOT NULL,
    "updatedAt" REAL NOT NULL,
    "deleted" BOOLEAN NOT NULL,
    "rev" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "id"),
    CONSTRAINT "MoodLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BadgeState" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "unlockedAt" REAL,
    "progress" REAL NOT NULL,
    "updatedAt" REAL NOT NULL,
    "deleted" BOOLEAN NOT NULL,
    "rev" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "id"),
    CONSTRAINT "BadgeState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "Profile_userId_rev_idx" ON "Profile"("userId", "rev");

-- CreateIndex
CREATE INDEX "Habit_userId_rev_idx" ON "Habit"("userId", "rev");

-- CreateIndex
CREATE INDEX "HabitLog_userId_rev_idx" ON "HabitLog"("userId", "rev");

-- CreateIndex
CREATE INDEX "Task_userId_rev_idx" ON "Task"("userId", "rev");

-- CreateIndex
CREATE INDEX "FocusSession_userId_rev_idx" ON "FocusSession"("userId", "rev");

-- CreateIndex
CREATE INDEX "MoodLog_userId_rev_idx" ON "MoodLog"("userId", "rev");

-- CreateIndex
CREATE INDEX "BadgeState_userId_rev_idx" ON "BadgeState"("userId", "rev");
