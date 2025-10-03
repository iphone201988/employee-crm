import express from "express";
import timesheetController from "../controller/timesheet";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import timesheetValidation from "../validation/timesheet";

const timesheetRouter = express.Router();

timesheetRouter.post("/add", authenticate, validate(timesheetValidation.addTimesheetValidation), timesheetController.addTimesheet);
timesheetRouter.get("/all", authenticate, timesheetController.getAllTimesheets);
timesheetRouter.put("/update/:timesheetId", authenticate, validate(timesheetValidation.updateTimesheetValidation), timesheetController.updateTimesheet);
timesheetRouter.get("/", authenticate, timesheetController.getTimesheet);

export default timesheetRouter;