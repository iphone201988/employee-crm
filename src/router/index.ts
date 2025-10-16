import express from "express";
import userRouter from "./user";
import authRouter from "./auth";
import categoryRouter from "./category";
import clientRouter from "./client";
import jobRouter from "./job";
import timesheetRouter from "./timesheet";
import noteRouter from "./note";
import expenseRouter from "./expense";
import wipRouter from "./wip";
const router = express.Router();

router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/category", categoryRouter);
router.use('/client',clientRouter);
router.use('/job',jobRouter);
router.use('/timesheet', timesheetRouter);
router.use('/note', noteRouter);
router.use('/expense', expenseRouter);
router.use('/wip', wipRouter);


export default router