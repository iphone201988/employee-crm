import authController from "../controller/auth";
import express from "express";
import { validate } from "../middleware/validate";
import authValidation from "../validation/auth";
import { authenticate } from "../middleware/auth";
import { upload } from "../middleware/upload";

const authRouter = express.Router();

authRouter.post("/login", validate(authValidation.loginValidation), authController.login);
authRouter.get("/me", authenticate, authController.profile);
authRouter.put("/update-profile-image", authenticate,upload.single('file'), authController.updateProfileImage);
authRouter.post("/login-as-guest", validate(authValidation.loginAsGuestValidation), authController.loginAsguest);

export default authRouter;