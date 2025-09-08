import express from "express";
import categoryController from "../controller/category";
import { validate } from "../middleware/validate";
import categoryValidation from "../validation/category";
import { authenticate } from "../middleware/auth";

const categoryRouter = express.Router();

categoryRouter.post("/", authenticate, validate(categoryValidation.addCategoryValidation), categoryController.createCategory);
categoryRouter.delete("/", authenticate, validate(categoryValidation.deleteCategoryValidation), categoryController.deleteCategory);
categoryRouter.get("/", authenticate, categoryController.getCategories);

export default categoryRouter;