import express from "express";
import timesheetController from "../controller/timesheet";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import timesheetValidation from "../validation/timesheet";

const timesheetRouter = express.Router();

timesheetRouter.post("/add", authenticate, validate(timesheetValidation.addTimesheetValidation), timesheetController.addTimesheet);
timesheetRouter.get("/all", authenticate, timesheetController.getAllTimesheets);
timesheetRouter.get("/logs", authenticate, timesheetController.getAllTimeLogs);
timesheetRouter.post("/add-time-log", authenticate, validate(timesheetValidation.addTimeLogValidation), timesheetController.addTimeLog);
timesheetRouter.put("/update-time-log/:timeLogId", authenticate, validate(timesheetValidation.updateTimeLogValidation), timesheetController.updateTimeLog);
timesheetRouter.delete("/delete-time-log", authenticate, validate(timesheetValidation.deleteTimeLogValidation), timesheetController.deleteTimeLog);
timesheetRouter.put("/change-time-sheet-status", authenticate, validate(timesheetValidation.changeTimeSheetStatusValidation), timesheetController.chanegTimeSheetStatus);



timesheetRouter.get("/", authenticate, timesheetController.getTimesheet);

export default timesheetRouter;