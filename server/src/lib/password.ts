import { hash, verify } from "@node-rs/argon2";

// @node-rs/argon2 defaults to argon2id with OWASP-recommended parameters.
export const hashPassword = (password: string): Promise<string> => hash(password);

export const verifyPassword = (passwordHash: string, password: string): Promise<boolean> =>
  verify(passwordHash, password).catch(() => false);

let dummyHash: Promise<string> | undefined;

/** Burns comparable CPU time for unknown emails so login timing doesn't reveal which emails exist. */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword("tend-dummy-password");
  await verifyPassword(await dummyHash, password);
}
