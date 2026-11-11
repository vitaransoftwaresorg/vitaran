import type { RequestHandler } from "express";
import type { GoogleLoginInput } from "../schemas/auth.schema.js";
import { loginWithGoogle } from "../services/google-auth.service.js";
import { sendSuccess } from "../utils/api-response.js";

export const googleLogin: RequestHandler<unknown, unknown, GoogleLoginInput> = async (
  req,
  res,
) => {
  sendSuccess(res, await loginWithGoogle(req.body.idToken, req.body.portal));
};
