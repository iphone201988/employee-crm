import express from "express";
import { authenticate } from "../middleware/auth";
import wipController from "../controller/wip";
import invoiceController from "../controller/invoice";
import writeOffController from "../controller/writeOff";
import wipValidation from "../validation/wip";
import { validate } from "../middleware/validate";

const wipRouter = express.Router();


wipRouter.post("/open-balance", authenticate, wipController.createOpenWipBalance);
wipRouter.delete("/open-balance/:openBalanceId", authenticate, wipController.deleteWipOpenBalance);
wipRouter.delete("/imported-wip/:clientId", authenticate, wipController.deleteImportedWipBalance);
wipRouter.get("/", authenticate, wipController.workInProgress);
wipRouter.get("/age-wip", authenticate, wipController.wipBalance);
wipRouter.post("/attach-wip-target", authenticate, wipController.attachWipTarget);

//invoice routes
wipRouter.post("/invoice", authenticate, validate(wipValidation.createInvoiceValidation), invoiceController.createInvoice);
wipRouter.post("/invoice/generate", authenticate, validate(wipValidation.createInvoiceValidation), invoiceController.generateInvoiceFromWip);
wipRouter.get("/invoices", authenticate, invoiceController.getInvoices);
wipRouter.post("/invoice/log", authenticate, validate(wipValidation.createInvoiceLogValidation), invoiceController.createInvoiceLog);
wipRouter.patch("/invoice/status-change", authenticate, validate(wipValidation.updateInvoiceStatusValidation), invoiceController.invoiceStatusChange);
wipRouter.get("/invoice/invoice-no/:invoiceNo", authenticate, invoiceController.getInvoiceByInvoiceNo);
wipRouter.get("/invoice/:invoiceId", authenticate, invoiceController.getInvoiceById);
wipRouter.delete("/invoice/:invoiceId", authenticate, invoiceController.deleteInvoice);
wipRouter.post("/invoice/time-logs", authenticate, validate(wipValidation.getInvoiceTimeLogsValidation), invoiceController.getInvoiceTimeLogs);


// Write off
wipRouter.post("/write-off", authenticate, validate(wipValidation.createWriteOffValidation), writeOffController.createWriteOff);
wipRouter.get("/write-off", authenticate, writeOffController.getWriteOff);
wipRouter.get("/write-off-dashboard", authenticate, writeOffController.getWriteOffsDashboard);

wipRouter.get("/aged-debtors", authenticate, invoiceController.getAgedDebtors);
export default wipRouter;
