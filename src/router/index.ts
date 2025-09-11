import express from "express";
import userRouter from "./user";
import authRouter from "./auth";
import categoryRouter from "./category";
import clientRouter from "./client";
import jobRouter from "./job";
const router = express.Router();

router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/category", categoryRouter);
router.use('/client',clientRouter);
router.use('/job',jobRouter);


export default router