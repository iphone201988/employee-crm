import clientController from "../controller/client";
import express from "express";
import { validate } from "../middleware/validate";
import clientValidation from "../validation/client";
import { authenticate } from "../middleware/auth";

const clientRouter = express.Router();

clientRouter.post("/add", authenticate, validate(clientValidation.addClientValidation), clientController.addClient);
clientRouter.get("/all", authenticate, clientController.getClients);

export default clientRouter;