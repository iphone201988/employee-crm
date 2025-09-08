import authController from "../controller/auth";
import express from "express";
import { validate } from "../middleware/validate";
import authValidation from "../validation/auth";
import { authenticate } from "../middleware/auth";

const authRouter = express.Router();

authRouter.post("/login", validate(authValidation.loginValidation), authController.login);
authRouter.get("/me", authenticate, authController.profile);

export default authRouter;