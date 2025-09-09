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
userRouter.post("/update-team-members", authenticate, validate(userValidation.updateTeamMembersValidation), teamController.updateTeamMembers);
userRouter.post("/send-invite-to-team-member", authenticate, validate(userValidation.sendInviteToTeamMemberValidation), teamController.sendInviteToTeamMember);

export default userRouter;