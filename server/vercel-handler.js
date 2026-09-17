import process from 'node:process';
import { applicationApi } from './api.js';
export const vercelHandler = (req, res) => applicationApi(process.env)(req, res, () => res.writeHead(404).end());
