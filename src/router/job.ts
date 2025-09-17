import express from "express";
import { validate } from "../middleware/validate";
import jobValidation from "../validation/job";
import { authenticate } from "../middleware/auth";
import jobController from "../controller/job";

const jobRouter = express.Router();

jobRouter.post("/create", authenticate, validate(jobValidation.createJobValidation), jobController.createJob);
jobRouter.get("/all", authenticate, jobController.getJobs);
jobRouter.put("/update-job/:jobId", authenticate, validate(jobValidation.updateJobValidation), jobController.updateJob);
jobRouter.delete("/delete-job/:jobId", authenticate, jobController.deleteJob);
jobRouter.get("/:jobId", authenticate, validate(jobValidation.getJobByIdValidation), jobController.getJobById);
export default jobRouter;