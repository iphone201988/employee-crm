import express from "express";
import { authenticate } from "../middleware/auth";
import wipController from "../controller/wip";
import invoiceController from "../controller/invoice";
import wipValidation from "../validation/wip";
import { validate } from "../middleware/validate";

const wipRouter = express.Router();


wipRouter.post("/open-balance", authenticate, wipController.createOpenWipBalance);
wipRouter.get("/", authenticate, wipController.workInProgress);
wipRouter.get("/age-wip", authenticate, wipController.wipBalance);
wipRouter.post("/attach-wip-target", authenticate, wipController.attachWipTarget);

//invoice routes
wipRouter.get("/invoice/:invoiceId", authenticate, invoiceController.getInvoiceById);
wipRouter.post("/invoice", authenticate, validate(wipValidation.createInvoiceValidation), invoiceController.createInvoice);
wipRouter.get("/invoices", authenticate, invoiceController.getInvoices);
wipRouter.post("/invoice/log", authenticate, validate(wipValidation.createInvoiceLogValidation), invoiceController.createInvoiceLog);
wipRouter.patch("/invoice/status-change", authenticate, validate(wipValidation.updateInvoiceStatusValidation), invoiceController.invoiceStatusChange);
export default wipRouter;
