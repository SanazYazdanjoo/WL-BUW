import test from "node:test";
import assert from "node:assert/strict";
import { createAccountStore, hashPassword, verifyPassword } from "../server/staff/accounts.js";
import { decodeSession, login, requireActor } from "../server/staff/auth.js";

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
  await assert.rejects(login(request(), { username: "someone", password: env.STAFF_ACCESS_CODE }, env, findAccount), /not accepted/);
  await assert.rejects(login(request(), { username: "tutor", password: env.STAFF_ADMIN_CODE }, env, findAccount), /not accepted/);
  assert.equal(decodeSession(await login(request(), { username: "SuperAdmin", password: env.STAFF_ADMIN_CODE }, env, findAccount), env).role, "superadmin");
  await assert.rejects(login(request(), { username: "admin", password: env.STAFF_ADMIN_CODE }, env, findAccount), /not accepted/);
  // A value pasted into Vercel with stray whitespace still works.
  const shortEnv = { ...env, STAFF_ACCESS_CODE: " tutor1234\n" };
  assert.equal(decodeSession(await login(request(), { username: "tutor", password: "tutor1234" }, shortEnv, findAccount), shortEnv).role, "tutor");
});

test("the Super Admin sets shared tutor, coordinator and admin passwords; coordinators cannot manage logins", async () => {
  const store = memoryStore();
  const accounts = createAccountStore(store);
  await accounts.save("staff_a", "sanaz", "password-one");
  await accounts.setShared("tutor", "tutor1234");
  await accounts.setShared("superadmin", "admin@WL@BUW");
  await accounts.setShared("admin", "Admin-password-1");
  await accounts.setShared("coordinator", "Coordinator123!@#");
  assert.equal((await accounts.load()).accounts.length, 1);
  const raw = JSON.stringify(store.files.get("staff-data/accounts.json").value);
  assert.ok(!["tutor1234", "admin@WL@BUW", "Coordinator123!@#"].some((password) => raw.includes(password)));
  const checkShared = async (login, password) => { const stored = await accounts.shared(login); return stored ? verifyPassword(password, stored) : null; };
  const signIn = async (username, password) => decodeSession(await login(request(), { username, password }, env, undefined, checkShared), env);
  assert.equal((await signIn("tutor", "tutor1234")).role, "tutor");
  assert.equal((await signIn("superadmin", "admin@WL@BUW")).role, "superadmin");
  assert.equal((await signIn("admin", "Admin-password-1")).role, "admin");
  await assert.rejects(signIn("admin", "admin@WL@BUW"), /not accepted/);
  assert.equal((await signIn("coordinator", "Coordinator123!@#")).role, "coordinator");
  await assert.rejects(signIn("tutor", env.STAFF_ACCESS_CODE), /not accepted/);
  await assert.rejects(signIn("admin", env.STAFF_ADMIN_CODE), /not accepted/);
  await assert.rejects(signIn("coordinator", "tutor1234"), /not accepted/);
  await accounts.save("staff_b", "ali", "password-two");
  assert.ok(await accounts.shared("tutor"), "adding a personal login keeps shared passwords");
  await accounts.clearShared("tutor");
  assert.equal((await signIn("tutor", env.STAFF_ACCESS_CODE)).role, "tutor");
  await assert.rejects(accounts.setShared("tutor", "short"), /at least 8/);
  await assert.rejects(accounts.setShared("guest", "long-enough"), /shared login/);

  const coordinator = { role: "coordinator" }, admin = { role: "admin" }, superadmin = { role: "superadmin" };
  assert.equal(requireActor(coordinator, "admin"), coordinator);
  assert.throws(() => requireActor(coordinator, "logins"), /manage logins/);
  assert.equal(requireActor(admin, "logins"), admin);
  assert.throws(() => requireActor(admin, "superadmin"), /Only the Super Admin/);
  assert.equal(requireActor(superadmin, "superadmin"), superadmin);
  assert.throws(() => requireActor({ role: "tutor" }, "admin"), /coordinator access/);
});
