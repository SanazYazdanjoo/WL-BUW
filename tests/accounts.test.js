import test from "node:test";
import assert from "node:assert/strict";
import { createAccountStore, hashPassword, verifyPassword } from "../server/staff/accounts.js";
import { decodeSession, login } from "../server/staff/auth.js";

const env = { STAFF_PILOT_ENABLED: "true", STAFF_ACCESS_CODE: "shared-tutor-password-123", STAFF_ADMIN_CODE: "shared-admin-password-456", STAFF_SESSION_SECRET: "synthetic-session-secret-32-characters-long" };
const request = () => ({ headers: { origin: "https://wl.example", host: "wl.example" }, socket: { remoteAddress: `10.0.0.${Math.floor(Math.random() * 250)}` } });
function memoryStore() {
  const files = new Map();
  let n = 0;
  return {
    files,
    paths: { accounts: "staff-data/accounts.json" },
    async readJson(path) { return files.get(path) || { value: null, etag: null }; },
    async writeJson(path, value, etag) {
      if ((files.get(path)?.etag || null) !== etag) throw Object.assign(new Error("conflict"), { status: 409 });
      files.set(path, { value: structuredClone(value), etag: `"${++n}"` });
    },
  };
}

test("passwords are stored salted and hashed and verified exactly", () => {
  const stored = hashPassword("correct horse");
  assert.ok(!JSON.stringify(stored).includes("correct horse"));
  assert.notEqual(hashPassword("correct horse").hash, stored.hash);
  assert.equal(verifyPassword("correct horse", stored), true);
  assert.equal(verifyPassword("correct hors", stored), false);
});

test("personal logins need unique, valid usernames and can be reset", async () => {
  const store = memoryStore();
  const accounts = createAccountStore(store);
  await accounts.save("staff_a", "sanaz", "password-one");
  await assert.rejects(accounts.save("staff_b", "sanaz", "password-two"), /already taken/);
  await assert.rejects(accounts.save("staff_b", "tutor", "password-two"), /reserved/);
  await assert.rejects(accounts.save("staff_b", "ali", "short"), /at least 8/);
  await accounts.save("staff_a", "sanaz.y", "password-three");
  assert.deepEqual((await accounts.load()).accounts.map(({ staffId, username }) => [staffId, username]), [["staff_a", "sanaz.y"]]);
  await accounts.remove("staff_a");
  assert.equal(await accounts.byUsername("sanaz.y"), null);
});

test("sign-in accepts a personal login or the shared password, never a mix", async () => {
  const account = { staffId: "staff_a", username: "sanaz", ...hashPassword("my-own-password") };
  const findAccount = async (username, password) => {
    if (username.toLowerCase() !== account.username) return null;
    return verifyPassword(password, account) ? { name: "Sanaz", role: "admin", staffId: "staff_a" } : { rejected: true };
  };
  const personal = decodeSession(await login(request(), { username: "Sanaz", password: "my-own-password" }, env, findAccount), env);
  assert.deepEqual([personal.name, personal.role, personal.staffId, personal.personal], ["Sanaz", "admin", "staff_a", true]);
  await assert.rejects(login(request(), { username: "sanaz", password: env.STAFF_ACCESS_CODE }, env, findAccount), /not accepted/);
  const shared = decodeSession(await login(request(), { username: "tutor", password: env.STAFF_ACCESS_CODE }, env, findAccount), env);
  assert.deepEqual([shared.role, shared.staffId], ["tutor", undefined]);
  await assert.rejects(login(request(), { username: "tutor", password: "wrong-password" }, env, findAccount), /not accepted/);
});
