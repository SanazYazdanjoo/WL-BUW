import { createOperationsService } from "../operations.js";
import {
  cookie,
  login,
  sessionFromRequest,
  requireActor,
  checkMutation,
  StaffError,
} from "./auth.js";
import { createPrivateStore } from "./store.js";
import { createStaffRepository } from "./repository.js";
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
          csrf: actor.csrf,
        });
      const reads = {
        workspace: ["read", "workspace"],
        content: ["admin", "contentStatus"],
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
      };
      if (req.method === "POST") {
        checkMutation(req, actor);
        if (action === "logout")
          return send(200, { ok: true }, { "Set-Cookie": cookie("", env) });
        const route = writes[action];
        if (!route) throw new StaffError(404, "Staff action not found.");
        requireActor(actor, route[0]);
        const input = await readBody(req);
        const repository = repositoryFactory();
        const operations = createOperationsService({
          authorize: async (session) => requireActor(session),
          repository,
        });
        return send(
          200,
          await (operations[route[1]]
            ? operations[route[1]](actor, input)
            : repository[route[1]](actor, input)),
        );
      }
      if (req.method === "GET" && action === "data/export") {
        requireActor(actor, "admin");
        const data = await repositoryFactory().exportMasterExcel();
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
      if (req.method !== "GET" || !route)
        throw new StaffError(404, "Staff action not found.");
      requireActor(actor, route[0]);
      return send(200, await repositoryFactory()[route[1]]());
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
        },
      );
    }
  };
}
