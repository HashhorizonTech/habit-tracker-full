import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { type Prisma, PrismaClient } from "../generated/prisma/client.js";

export type Db = PrismaClient;
export type Tx = Prisma.TransactionClient;

// To run on Postgres, swap this adapter for `PrismaPg` from `@prisma/adapter-pg`
// (see README). Nothing else in the codebase is SQLite-specific.
export function createDb(databaseUrl: string): Db {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}
