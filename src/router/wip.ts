import express from "express";
import { authenticate } from "../middleware/auth";
import wipController from "../controller/wip";

const wipRouter = express.Router();


wipRouter.get("/all", authenticate, wipController.workInProgress);
export default wipRouter;