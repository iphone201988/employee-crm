import express from "express";
import { validate } from "../middleware/validate";
import jobValidation from "../validation/job";
import { authenticate } from "../middleware/auth";
import jobController from "../controller/job";

const jobRouter = express.Router();

jobRouter.post("/create", authenticate, validate(jobValidation.createJobValidation), jobController.createJob);
jobRouter.get("/all", authenticate, jobController.getJobs);

export default jobRouter;