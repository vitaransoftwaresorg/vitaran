import type { RequestHandler } from "express";
import { verifyAdminToken } from "../services/auth.service.js";
import { verifySchoolToken } from "../services/school-auth.service.js";
import { verifyTeacherToken } from "../services/teacher-auth.service.js";

const BEARER_PREFIX = "Bearer ";

/** Sets `res.locals.authenticated` when any portal/admin bearer token is valid. */
export const optionalAnyAuth: RequestHandler = async (req, res, next) => {
  res.locals.authenticated = false;
  const header = req.get("authorization");
  if (!header?.startsWith(BEARER_PREFIX)) {
    next();
    return;
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    next();
    return;
  }
  try {
    await verifyAdminToken(token);
    res.locals.authenticated = true;
    next();
    return;
  } catch {
    // try school
  }
  try {
    await verifySchoolToken(token);
    res.locals.authenticated = true;
    next();
    return;
  } catch {
    // try teacher
  }
  try {
    await verifyTeacherToken(token);
    res.locals.authenticated = true;
  } catch {
    res.locals.authenticated = false;
  }
  next();
};
