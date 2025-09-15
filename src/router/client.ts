import clientController from "../controller/client";
import express from "express";
import { validate } from "../middleware/validate";
import clientValidation from "../validation/client";
import { authenticate } from "../middleware/auth";

const clientRouter = express.Router();

clientRouter.post("/add", authenticate, validate(clientValidation.addClientValidation), clientController.addClient);
clientRouter.put("/update/:clientId", authenticate, validate(clientValidation.updateClientValidation), clientController.updateClient);
clientRouter.get("/all", authenticate, clientController.getClients);
clientRouter.get("/services", authenticate, clientController.getClientServices);
clientRouter.put("/update-client-services", authenticate, validate(clientValidation.updateClientServiceValidation), clientController.updateClientService);

export default clientRouter;