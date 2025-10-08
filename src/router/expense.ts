import express from "express";
import expenseController from "../controller/expense";
import { authenticate } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { validate } from "../middleware/validate";
import expenseValidation from "../validation/expense";

const expenseRouter = express.Router();

expenseRouter.post("/add", authenticate,upload.array('file', 10), validate(expenseValidation.addExpenseValidation), expenseController.createExpense);
expenseRouter.get("/all", authenticate, expenseController.getExpenses);
expenseRouter.put("/update-expense/:expenseId", authenticate, upload.array('file', 10), validate(expenseValidation.updateExpenseValidation), expenseController.updateExpense);
expenseRouter.delete("/delete-expense/:expenseId", authenticate, expenseController.deleteExpense);

export default expenseRouter;