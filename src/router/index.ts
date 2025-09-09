import express from "express";
import userRouter from "./user";
import authRouter from "./auth";
import categoryRouter from "./category";
const router = express.Router();

router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/category", categoryRouter);
// router.use


export default router