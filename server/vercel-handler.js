import process from "node:process";
import { applicationApi } from "./api.js";
export const vercelHandler = (req, res) => {
  const route =
    (typeof req.query?.__api_path === "string" && req.query.__api_path) ||
    new URL(req.url, "http://localhost").searchParams.get("__api_path");
  if (
    route &&
    route.length <= 200 &&
    /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i.test(route)
  ) {
    const url = new URL(req.url, "http://localhost");
    url.pathname = `/api/${route}`;
    url.searchParams.delete("__api_path");
    req.url = `${url.pathname}${url.search}`;
  }
  return applicationApi(process.env)(req, res, () => res.writeHead(404).end());
};
