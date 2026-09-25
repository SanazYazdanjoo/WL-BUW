import {
  createHmac,
  createHash,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
// Staff roles from least to most access. Nobody may grant or edit a role above their own.
export const ROLE_RANK = { tutor: 0, coordinator: 1, admin: 2, superadmin: 3 };
export const rankOf = (role) => ROLE_RANK[role] ?? -1;
export class StaffError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
// Starting passwords from the server settings. Admin and Coordinator have none by default:
// the Super Admin sets them in the app. STAFF_ADMIN_CODE is the Super Admin's starting password.
export const sharedEnvironmentCodes = (env) => ({ tutor: env.STAFF_ACCESS_CODE, coordinator: env.STAFF_COORDINATOR_CODE, admin: env.STAFF_MANAGER_CODE, superadmin: env.STAFF_ADMIN_CODE });
// Spaces around a pasted environment value are never part of the password.
export const sharedCode = (value) => (typeof value === "string" ? value.trim() : "");
export const verifyShared = (a, b) => same(a, sharedCode(b));
const same = (a, b) =>
  timingSafeEqual(
    createHash("sha256").update(String(a)).digest(),
    createHash("sha256").update(String(b)).digest(),
  );
export function staffConfigured(env) {
  return (
    env.STAFF_PILOT_ENABLED === "true" &&
    (env.STAFF_SESSION_SECRET || "").length >= 32 &&
    // The shared tutor password may be short (tutors are encouraged to set a personal login); the admin one may not.
    sharedCode(env.STAFF_ACCESS_CODE).length >= 8 &&
    sharedCode(env.STAFF_ADMIN_CODE).length >= 20 &&
    sharedCode(env.STAFF_ACCESS_CODE) !== sharedCode(env.STAFF_ADMIN_CODE)
  );
}
const sign = (value, env) =>
  createHmac("sha256", env.STAFF_SESSION_SECRET)
    .update(value)
    .digest("base64url");
export function encodeSession(actor, env, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      ...actor,
      csrf: randomUUID(),
      exp: now + 8 * 60 * 60 * 1000,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload, env)}`;
}
export function decodeSession(token, env, now = Date.now()) {
  if (!staffConfigured(env) || typeof token !== "string" || token.length > 3000)
    return null;
  try {
    const [payload, signature, ...extra] = token.split(".");
    if (extra.length || !signature || !same(signature, sign(payload, env)))
      return null;
    const a = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      !Object.hasOwn(ROLE_RANK, a.role) ||
      typeof a.id !== "string" ||
      typeof a.name !== "string" ||
      typeof a.csrf !== "string" ||
      !Number.isFinite(a.exp) ||
      a.exp <= now ||
      a.exp > now + 8 * 60 * 60 * 1000
    )
      return null;
    return a;
  } catch {
    return null;
  }
}
export function sessionFromRequest(req, env) {
  const token = (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("wl_staff="))
    ?.slice(9);
  return decodeSession(token, env);
}
export function cookie(token, env) {
  return `wl_staff=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? 28800 : 0}${env.NODE_ENV === "production" || env.VERCEL ? " ; Secure" : ""}`;
}
export function requireActor(actor, permission = "read") {
  if (!actor) throw new StaffError(401, "Sign in to the staff area.");
  // "admin" = manage the workspace (Coordinator and up); "logins" = Admin and up; "superadmin" = Super Admin only.
  if (permission === "admin" && rankOf(actor.role) < ROLE_RANK.coordinator)
    throw new StaffError(403, "This action requires coordinator access.");
  if (permission === "logins" && rankOf(actor.role) < ROLE_RANK.admin)
    throw new StaffError(403, "Only the Super Admin or an Admin can manage logins.");
  if (permission === "superadmin" && actor.role !== "superadmin")
    throw new StaffError(403, "Only the Super Admin can do this.");
  return actor;
}
export function checkOrigin(req) {
  let origin;
  try {
    origin = new URL(req.headers.origin);
  } catch {
    throw new StaffError(403, "Reload this page and try again.");
  }
  if (
    origin.host !== req.headers.host ||
    !["http:", "https:"].includes(origin.protocol)
  )
    throw new StaffError(403, "Reload this page and try again.");
}
export function checkMutation(req, actor) {
  checkOrigin(req);
  if (!same(req.headers["x-csrf-token"] || "", actor.csrf))
    throw new StaffError(403, "Your session changed. Reload and try again.");
}
const attempts = new Map();
// Personal logins are checked first (findAccount); otherwise the shared access
// codes apply, followed by choosing a name from the staff list.
// checkShared(login, password) returns true/false when the Super Admin has set that
// shared login's password in the app, or null to fall back to the environment value.
export async function login(req, body, env, findAccount = async () => null, checkShared = async () => null) {
  if (!staffConfigured(env))
    throw new StaffError(
      503,
      "Staff access has not been enabled by the coordinator.",
    );
  checkOrigin(req);
  // Best-effort per-instance throttle; high-entropy codes are mandatory on serverless.
  const key = createHash("sha256")
    .update(req.socket?.remoteAddress || "unknown")
    .digest("hex");
  const now = Date.now();
  for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  const entry = attempts.get(key) || { count: 0, until: now + 600000 };
  if (entry.count >= 10)
    throw new StaffError(429, "Too many sign-in attempts. Try again later.");
  entry.count++;
  if (attempts.size < 10000) attempts.set(key, entry);
  const name = typeof (body.username ?? body.name) === "string" ? (body.username ?? body.name).trim() : "";
  const password = typeof (body.password ?? body.code) === "string" ? body.password ?? body.code : "";
  if (!name || name.length > 100 || /[\r\n]/.test(name))
    throw new StaffError(400, "Enter your username.");
  const personal = await findAccount(name, password);
  if (personal?.rejected) throw new StaffError(401, "The username or password was not accepted.");
  if (personal) {
    attempts.delete(key);
    return encodeSession({ id: randomUUID(), name: personal.name, role: personal.role, staffId: personal.staffId, personal: true }, env);
  }
  // Shared logins: "tutor", "coordinator", "admin" and "superadmin", each with its own password.
  const sharedUser = name.toLowerCase();
  const environmentCode = sharedEnvironmentCodes(env)[sharedUser];
  let role = null;
  if (Object.hasOwn(ROLE_RANK, sharedUser)) {
    const fallback = sharedCode(environmentCode);
    const ok = (await checkShared(sharedUser, password)) ?? (Boolean(fallback) && same(password, fallback));
    if (ok) role = sharedUser;
  }
  if (!role) throw new StaffError(401, "The username or password was not accepted.");
  attempts.delete(key);
  return encodeSession({ id: randomUUID(), name, role }, env);
}
