import { createOperationsService } from "../operations.js";
import {
  cookie,
  encodeSession,
  login,
  sessionFromRequest,
  requireActor,
  checkMutation,
  StaffError,
} from "./auth.js";
import { createPrivateStore } from "./store.js";
import { createStaffRepository } from "./repository.js";
import { createUnifiedRepository } from "./unifiedRepository.js";
import { createUnifiedWorkbookTemplate } from "../excel/unifiedWorkbook.js";
import { createContentWorkbookBuffer } from "../../scripts/generate-content-workbook.js";
import { createMasterExcelSampleBuffer } from "../excel/masterExcel.js";

async function readBody(req) {
  if (!(req.headers["content-type"] || "").startsWith("application/json"))
    throw new StaffError(415, "Send a JSON request.");
  // Vercel's Node runtime exposes parsed JSON on req.body. Local Node/Vite
  // requests remain streams. Bound both paths before accepting the object.
  let parsed;
  try {
    parsed = req.body;
  } catch {
    throw new StaffError(400, "The request could not be read.");
  }
  if (parsed !== undefined) {
    if (Buffer.byteLength(JSON.stringify(parsed)) > 128000)
      throw new StaffError(413, "The request is too large.");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new StaffError(400, "The request could not be read.");
    return parsed;
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > 128000) throw new StaffError(413, "The request is too large.");
    chunks.push(Buffer.from(chunk));
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new StaffError(400, "The request could not be read.");
  }
}
export function staffMiddleware(
  env,
  fetchImpl = fetch,
  repositoryFactory = () =>
    createStaffRepository(createPrivateStore(env, fetchImpl), env),
) {
  return async (req, res, next) => {
    const path = new URL(req.url, "http://localhost").pathname;
    if (!path.startsWith("/api/staff/")) return next();
    const action = path.slice("/api/staff/".length);
    const send = (status, body, headers = {}) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...headers,
      });
      res.end(JSON.stringify(body));
    };
    try {
      if (action === "login" && req.method === "POST") {
        const token = login(req, await readBody(req), env);
        return send(200, { ok: true }, { "Set-Cookie": cookie(token, env) });
      }
      const actor = requireActor(sessionFromRequest(req, env));
      if (action === "session" && req.method === "GET")
        return send(200, {
          name: actor.name,
          role: actor.role,
          staffId: actor.staffId || "",
          csrf: actor.csrf,
        });
      const reads = {
        workspace: ["read", "workspace"],
        content: ["admin", "contentStatus"],
        events: ["read", "listEvents"],
        config: ["admin", "getConfig"],
      };
      const writes = {
        "students/update": ["read", "updateStudent"],
        checkin: ["read", "checkIn"],
        handover: ["read", "addHandover"],
        "data/preview": ["admin", "previewMasterExcelImport"],
        "data/import": ["admin", "commitMasterExcelImport"],
        "content/preview": ["admin", "previewContentWorkbook"],
        "content/publish": ["admin", "publishContentWorkbook"],
        "content/rollback": ["admin", "rollbackContent"],
        "students/create": ["read", "addStudent", true],
        "staff/save": ["admin", "saveStaff", true],
        "content/save": ["admin", "saveContent", true],
        "content/delete": ["admin", "deleteContent", true],
        "content/autosave": ["admin", "autosaveContent", true],
        "content/deactivate": ["admin", "deactivateContent", true],
        "events/save": ["read", "saveEvent", true],
        "events/autosave": ["read", "autosaveEvent", true],
        "events/delete": ["read", "deleteEvent", true],
        "settings/save": ["admin", "saveSettings", true],
        "shifts/save": ["admin", "addShift", true],
        "shifts/autosave": ["admin", "autosaveShift", true],
        "workbook/initialize": ["admin", "initialize", true],
        "workbook/create-template": ["admin", "createFromTemplate", true],
        "workbook/backup": ["admin", "createBackup", true],
      };
      let legacyRepository;
      const getLegacyRepository = () => (legacyRepository ||= repositoryFactory());
      const unifiedStore = createPrivateStore(env, fetchImpl);
      const unifiedRepository = createUnifiedRepository(unifiedStore);
      const hasUnifiedWorkbook = async () => Boolean(env.NEXTCLOUD_WORKBOOK_FILE !== "" && env.NEXTCLOUD_USERNAME && env.NEXTCLOUD_APP_PASSWORD && (await unifiedStore.read(unifiedStore.paths.unified, 10 * 1024 * 1024)).value);
      if (req.method === "POST") {
        checkMutation(req, actor);
        if (action === "logout")
          return send(200, { ok: true }, { "Set-Cookie": cookie("", env) });
        if (action === "actor/select") {
          const input = await readBody(req);
          const roster = await createUnifiedRepository(createPrivateStore(env, fetchImpl)).staffRoster();
          const person = roster.staff.find((entry) => entry.id === input.staffId);
          if (!person) throw new StaffError(400, "Choose an active staff member from the list.");
          const token = encodeSession({ id: person.id, name: person.name, role: actor.role, staffId: person.id }, env);
          return send(200, { ok: true, name: person.name }, { "Set-Cookie": cookie(token, env) });
        }
        const route = writes[action];
        if (!route) throw new StaffError(404, "Staff action not found.");
        requireActor(actor, route[0]);
        const input = await readBody(req);
        const repository = getLegacyRepository();
        const operations = createOperationsService({
          authorize: async (session) => requireActor(session),
          repository,
        });
        let result;
        if (route[2]) result = await unifiedRepository[route[1]](actor, input);
        else if (["updateStudent", "checkIn", "addHandover", "previewMasterExcelImport", "commitMasterExcelImport"].includes(route[1]) && await hasUnifiedWorkbook()) result = await unifiedRepository[route[1]](actor, input);
        else if (["previewContentWorkbook", "publishContentWorkbook", "rollbackContent"].includes(route[1]) && await hasUnifiedWorkbook()) throw new StaffError(409, "Public content is now edited in the staff Content page and saved directly to the Welcome Lounge workbook.");
        else result = await (operations[route[1]] ? operations[route[1]](actor, input) : repository[route[1]](actor, input));
        return send(200, result);
      }
      if (req.method === "GET" && action === "workbook/status") {
        requireActor(actor, "admin");
        if (env.NEXTCLOUD_WORKBOOK_FILE === "") return send(200, { connected: true, workbook: "not-configured", fileName: unifiedStore.paths.unifiedName });
        return send(200, await unifiedRepository.status());
      }
      if (req.method === "GET" && action === "workbook/download") {
        requireActor(actor, "admin");
        const data = await unifiedRepository.downloadWorkbook();
        res.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="Welcome-Lounge.xlsx"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
        return res.end(Buffer.from(data));
      }
      if (req.method === "GET" && action === "workbook/template") {
        requireActor(actor, "admin");
        const data = await createUnifiedWorkbookTemplate();
        res.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="Welcome-Lounge-Template.xlsx"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
        return res.end(Buffer.from(data));
      }
      if (req.method === "GET" && action === "data/export") {
        requireActor(actor, "admin");
        const data = await (await hasUnifiedWorkbook() ? unifiedRepository.exportMasterExcel() : getLegacyRepository().exportMasterExcel());
        res.writeHead(200, {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            'attachment; filename="MasterExcel-export.xlsx"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(Buffer.from(data));
      }
      if (req.method === "GET" && action === "data/template") {
        requireActor(actor, "admin");
        const data = await createMasterExcelSampleBuffer();
        res.writeHead(200, {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            'attachment; filename="MasterExcel-SAMPLE.xlsx"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(Buffer.from(data));
      }
      if (req.method === "GET" && action === "content/template") {
        requireActor(actor, "admin");
        const data = await createContentWorkbookBuffer();
        res.writeHead(200, {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="Welcome-Lounge-Content-Template.xlsx"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(Buffer.from(data));
      }
      const route = reads[action];
      if (req.method === "GET" && action === "roster") {
        requireActor(actor);
        if (await hasUnifiedWorkbook()) return send(200, await unifiedRepository.staffRoster());
        return send(200, { staff: [], etag: null });
      }
      if (req.method !== "GET" || !route)
        throw new StaffError(404, "Staff action not found.");
      requireActor(actor, route[0]);
      if (action === "events") return send(200, await unifiedRepository.listEvents());
      if (["workspace", "content", "config"].includes(action) && await hasUnifiedWorkbook()) {
        const result = action === "workspace" ? await unifiedRepository.workspace() : action === "config" ? await unifiedRepository.getConfig() : await unifiedRepository.contentStatus();
        return send(200, result);
      }
      return send(200, await getLegacyRepository()[route[1]]());
    } catch (error) {
      return send(
        error instanceof StaffError
          ? error.status
          : error.status === 422
            ? 422
            : 500,
        {
          error:
            error instanceof StaffError || error.status === 422
              ? error.message
              : "The staff action could not be completed. Please retry.",
          ...(error.code ? { code: error.code } : {}),
          ...(error.fields ? { fields: error.fields } : {}),
          ...(error.latest ? { latest: error.latest } : {}),
        },
      );
    }
  };
}
