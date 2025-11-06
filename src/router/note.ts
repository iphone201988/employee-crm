import express from "express";
import notesController from "../controller/notes";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import timesheetValidation from "../validation/timesheet";

const noteRouter = express.Router();

noteRouter.post("/add", authenticate, validate(timesheetValidation.addNoteValidation), notesController.addNote);
noteRouter.put("/update/:noteId", authenticate, validate(timesheetValidation.updateNoteValidation), notesController.updateNote);
noteRouter.delete("/delete/:noteId", authenticate, notesController.deleteNote);
noteRouter.get("/", authenticate, notesController.getNotes);
export default noteRouter;
