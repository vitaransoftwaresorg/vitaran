import type { RequestHandler } from "express";
import type {
  ForgotPasswordRequestInput,
  ForgotPasswordVerifyInput,
} from "../schemas/auth.schema.js";
import * as forgotPasswordService from "../services/forgot-password.service.js";
import { sendSuccess } from "../utils/api-response.js";

export const requestForgotPasswordOtp: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await forgotPasswordService.requestPasswordResetOtp(req.body as ForgotPasswordRequestInput),
  );
};

export const verifyForgotPasswordOtp: RequestHandler = async (req, res) => {
  const { email, otp } = req.body as ForgotPasswordVerifyInput;
  sendSuccess(res, await forgotPasswordService.verifyPasswordResetOtp(email, otp));
};