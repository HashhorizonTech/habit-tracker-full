import type { User } from "../generated/prisma/client.js";

export type Role = "user" | "admin";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  role: Role;
}

export const toRole = (role: string): Role => (role === "admin" ? "admin" : "user");

export const toPublicUser = ({ id, email, name, createdAt, role }: User): PublicUser => ({
  id,
  email,
  name,
  createdAt,
  role: toRole(role),
});
