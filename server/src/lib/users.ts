import type { User } from "../generated/prisma/client.js";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: number;
}

export const toPublicUser = ({ id, email, name, createdAt }: User): PublicUser => ({ id, email, name, createdAt });
