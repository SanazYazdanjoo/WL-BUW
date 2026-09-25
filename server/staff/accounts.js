import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { StaffError } from "./auth.js";

// Personal staff logins. Everyone starts with the shared access code; anyone may
// switch to their own username and password. Passwords are stored salted and
// hashed (scrypt) in a private JSON file, never in the Excel workbook.
const KEY_LENGTH = 64;
const RESERVED = new Set(["admin", "tutor", "staff", "superadmin"]);

export const normalizeUsername = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

export function checkUsername(username) {
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new StaffError(400, "Use 3–40 letters, numbers, dots, dashes or underscores for the username.");
  if (RESERVED.has(username)) throw new StaffError(400, "This username is reserved. Choose another one.");
}

export function checkPassword(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 200) throw new StaffError(400, "Use a password with at least 8 characters.");
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  return { salt: salt.toString("base64"), hash: scryptSync(password, salt, KEY_LENGTH).toString("base64") };
}

export function verifyPassword(password, account) {
  if (typeof password !== "string" || !account?.salt || !account?.hash) return false;
  const expected = Buffer.from(account.hash, "base64");
  const actual = scryptSync(password, Buffer.from(account.salt, "base64"), KEY_LENGTH);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createAccountStore(store) {
  const path = store.paths.accounts;
  async function load() {
    const file = await store.readJson(path);
    const accounts = Array.isArray(file.value?.accounts) ? file.value.accounts : [];
    const sharedTutor = file.value?.sharedTutor?.hash ? file.value.sharedTutor : null;
    return { accounts, sharedTutor, etag: file.etag };
  }
  // Conditional write with a couple of retries so two people saving at once can't lose an account.
  async function write(update) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { accounts, sharedTutor, etag } = await load();
      const next = update(structuredClone({ accounts, sharedTutor }));
      try {
        await store.writeJson(path, { version: 1, accounts: next.accounts, ...(next.sharedTutor ? { sharedTutor: next.sharedTutor } : {}) }, etag);
        return next;
      } catch (error) {
        if (error.status !== 409 || attempt === 2) throw error;
      }
    }
    return null;
  }
  return {
    load,
    async byUsername(username) {
      const key = normalizeUsername(username);
      return (await load()).accounts.find((account) => account.username === key) || null;
    },
    async byStaffId(staffId) {
      return (await load()).accounts.find((account) => account.staffId === staffId) || null;
    },
    async save(staffId, username, password) {
      checkUsername(username);
      checkPassword(password);
      const { salt, hash } = hashPassword(password);
      await write((data) => {
        if (data.accounts.some((account) => account.username === username && account.staffId !== staffId)) throw new StaffError(409, "This username is already taken.");
        return { ...data, accounts: [...data.accounts.filter((account) => account.staffId !== staffId), { staffId, username, salt, hash, updatedAt: new Date().toISOString() }] };
      });
    },
    async remove(staffId) {
      await write((data) => ({ ...data, accounts: data.accounts.filter((account) => account.staffId !== staffId) }));
    },
    // The shared "tutor" password set by the Super Admin; without it the environment value applies.
    async sharedTutor() {
      return (await load()).sharedTutor;
    },
    async setSharedTutor(password) {
      checkPassword(password);
      await write((data) => ({ ...data, sharedTutor: { ...hashPassword(password), updatedAt: new Date().toISOString() } }));
    },
    async clearSharedTutor() {
      await write((data) => ({ ...data, sharedTutor: null }));
    },
  };
}
