import express from "express";
import timesheetController from "../controller/timesheet";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import timesheetValidation from "../validation/timesheet";

const noteRouter = express.Router();

noteRouter.post("/add", authenticate, validate(timesheetValidation.addNoteValidation), timesheetController.addNote);
noteRouter.put("/update/:noteId", authenticate, validate(timesheetValidation.updateNoteValidation), timesheetController.updateNote);
noteRouter.delete("/delete/:noteId", authenticate, timesheetController.deleteNote);
export default noteRouter;
