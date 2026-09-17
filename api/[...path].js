import process from "node:process";
import { applicationApi } from "../server/api.js";
export default function handler(req, res) {
  return applicationApi(process.env)(req, res, () => res.writeHead(404).end());
}
