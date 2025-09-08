import { NextFunction, Request, Response } from "express";
import { DepartmentModel } from "../models/Department";
import { BadRequestError } from "../utils/errors";
import { SUCCESS } from "../utils/response";

const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { name, type } = req.body;
        if (!name) {
            throw new BadRequestError("Category name is required");
        };
        if (type === "department") {
            const existingCategory = await DepartmentModel.findOne({ name });
            if (existingCategory) {
                throw new BadRequestError("Category already exists");
            }
            await DepartmentModel.create({ name });
            SUCCESS(res, 200, "Category created successfully", { data: {} });
            return;
        } else {
            throw new BadRequestError("Invalid type");
        }

    } catch (error) {
        next(error);
    }
}
const deleteCategory = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { id, type } = req.body;
        if (type === "department") {
            const category = await DepartmentModel.findByIdAndDelete(id);
            if (!category) {
                throw new BadRequestError("Category not found");
            }
            SUCCESS(res, 200, "Category deleted successfully", { data: {} });
            return;

        } else {
            throw new BadRequestError("Invalid type");
        }
    } catch (error) {
        next(error);
    }
};
const getCategories = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { type = "all" } = req.params;
        if (type === "department") {
            const departments = await DepartmentModel.find();
            SUCCESS(res, 200, "Categories fetched successfully", { data: { departments } });
            return;
        } else {
            const [departments] = await Promise.all([DepartmentModel.find()]);
            SUCCESS(res, 200, "Categories fetched successfully", { data: { departments } });
            return;
        }
    } catch (error) {
        next(error);
    }
};

export default { createCategory, deleteCategory, getCategories };
