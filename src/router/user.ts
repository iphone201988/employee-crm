import teamController from "../controller/team";
import express from "express";
import { validate } from "../middleware/validate";
import userValidation from "../validation/user";
import { upload } from "../middleware/upload";
import { authenticate } from "../middleware/auth";

const userRouter = express.Router();
 userRouter.post("/upload-image",upload.single('file'), teamController.uploadImage);
userRouter.post("/add-team-member", authenticate, validate(userValidation.addTeamMemberValidation), teamController.addTeamMember);
userRouter.get("/get-all-team-members",authenticate, teamController.getAllTeamMembers);
userRouter.post("/update-rates", authenticate, validate(userValidation.updateRatesValidation), teamController.updateRates);
userRouter.post("/update-permission", authenticate, validate(userValidation.updatePermissionValidation), teamController.updatePermission);
userRouter.post("/update-feature-access", authenticate, validate(userValidation.updateFeatureAccessValidation), teamController.updateFeatureAccess);
userRouter.post("/send-invite-to-team-member", authenticate, validate(userValidation.sendInviteToTeamMemberValidation), teamController.sendInviteToTeamMember);

export default userRouter;