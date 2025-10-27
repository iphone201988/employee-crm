import teamController from "../controller/team";
import express from "express";
import { validate } from "../middleware/validate";
import userValidation from "../validation/user";
import { upload } from "../middleware/upload";
import { authenticate } from "../middleware/auth";

const userRouter = express.Router();
userRouter.post("/upload-image", upload.single('file'), teamController.uploadImage);
userRouter.post("/add-team-member", authenticate, validate(userValidation.addTeamMemberValidation), teamController.addTeamMember);
userRouter.get("/get-all-team-members", authenticate, teamController.getAllTeamMembers);
userRouter.post("/update-team-members", authenticate, validate(userValidation.updateTeamMembersValidation), teamController.updateTeamMembers);
userRouter.post("/send-invite-to-team-member", authenticate, validate(userValidation.sendInviteToTeamMemberValidation), teamController.sendInviteToTeamMember);
userRouter.post("/set-password", validate(userValidation.setPasswordValidation), teamController.setPassword);
userRouter.get("/dropdown-options", authenticate, teamController.dropdownOptions);

userRouter.get("/get-access-of-tabs", authenticate,validate(userValidation.getAccessOftabsValidation), teamController.getAccessOftabs);


//company 
userRouter.post("/add-company", authenticate, validate(userValidation.addCompanyValidation), teamController.addCompany);
userRouter.get("/get-all-company-members", authenticate, teamController.getAllCompanyMembers);
userRouter.get("/get-all-company-members/:companyId", authenticate, teamController.getCompanyById);
userRouter.get("/get-all-company-members/:companyId/team-members", authenticate, teamController.companyTeamMembers);


// setting 
userRouter.post("/update-settings", authenticate, validate(userValidation.updateSettingsValidation), teamController.updateSettings);

//reports
userRouter.get("/reports", authenticate, teamController.reports);
export default userRouter;