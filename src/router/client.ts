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
clientRouter.get("/breakdown", authenticate, clientController.getClientBreakdown);
clientRouter.post("/import", authenticate, clientController.importClients);
clientRouter.get("/:clientId", authenticate, validate(clientValidation.getClientByIdValidation), clientController.getClientById);
clientRouter.delete("/:clientId", authenticate, validate(clientValidation.getClientByIdValidation), clientController.deleteClient);

export default clientRouter;