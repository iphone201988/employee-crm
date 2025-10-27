import express from "express";
import { authenticate } from "../middleware/auth";
import wipController from "../controller/wip";

const wipRouter = express.Router();


wipRouter.post("/open-balance", authenticate, wipController.createOpenWipBalance);
wipRouter.get("/", authenticate, wipController.workInProgress);
wipRouter.get("/age-wip", authenticate, wipController.wipBalance);
wipRouter.post("/attach-wip-target", authenticate, wipController.attachWipTarget);
export default wipRouter;
