import { NextFunction, Request, Response } from "express";
import { DepartmentCategoryModel } from "../models/DepartmentCategory";
import { BadRequestError } from "../utils/errors";
import { SUCCESS } from "../utils/response";
import { ServicesCategoryModel } from "../models/ServicesCategory";
import { JobCategoryModel } from "../models/JobCategory";
import { TimeCategoryModel } from "../models/TimeCategory";
import { BusinessCategoryModel } from "../models/BusinessCategory";

const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { name, type } = req.body;
        if (!name) {
            throw new BadRequestError("Category name is required");
        };
        if (type === "department") {
            const existingCategory = await DepartmentCategoryModel.findOne({ name });
            if (existingCategory) {
                throw new BadRequestError("Category already exists");
            }
            await DepartmentCategoryModel.create({ name });
            SUCCESS(res, 200, "Category created successfully", { data: {} });
            return;
        } else if (type === "service") {
            const existingCategory = await ServicesCategoryModel.findOne({ name });
            if (existingCategory) {
                throw new BadRequestError("Category already exists");
            }
            await ServicesCategoryModel.create({ name });
            SUCCESS(res, 200, "Category created successfully", { data: {} });
            return;
        } else if (type === "job") {
            const existingCategory = await JobCategoryModel.findOne({ name });
            if (existingCategory) {
                throw new BadRequestError("Category already exists");
            }
            await JobCategoryModel.create({ name });
            SUCCESS(res, 200, "Category created successfully", { data: {} });
            return;
        } else if (type === "time") {
            const existingCategory = await TimeCategoryModel.findOne({ name });
            if (existingCategory) {
                throw new BadRequestError("Category already exists");
            }
            await TimeCategoryModel.create({ name });
            SUCCESS(res, 200, "Category created successfully", { data: {} });
            return;
        } else if (type === "bussiness") {
            const existingCategory = await BusinessCategoryModel.findOne({ name });
            if (existingCategory) {
                throw new BadRequestError("Category already exists");
            }
            await BusinessCategoryModel.create({ name });
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
            const category = await DepartmentCategoryModel.findByIdAndDelete(id);
            if (!category) {
                throw new BadRequestError("Category not found");
            }
            SUCCESS(res, 200, "Category deleted successfully", { data: {} });
            return;

        } else if (type === "service") {
            const category = await ServicesCategoryModel.findByIdAndDelete(id);
            if (!category) {
                throw new BadRequestError("Category not found");
            }
            SUCCESS(res, 200, "Category deleted successfully", { data: {} });
            return;
        } else if (type === "job") {
            const category = await JobCategoryModel.findByIdAndDelete(id);
            if (!category) {
                throw new BadRequestError("Category not found");
            }
            SUCCESS(res, 200, "Category deleted successfully", { data: {} });
            return;
        } else if (type === "time") {
            const category = await TimeCategoryModel.findByIdAndDelete(id);
            if (!category) {
                throw new BadRequestError("Category not found");
            }
            SUCCESS(res, 200, "Category deleted successfully", { data: {} });
            return;
        } else if (type === "bussiness") {
            const category = await BusinessCategoryModel.findByIdAndDelete(id);
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
        const { type = "all" } = req.query;
        if (type === "department") {
            const departments = await DepartmentCategoryModel.find();
            SUCCESS(res, 200, "Categories fetched successfully", { data: { departments } });
            return;
        } else if (type === "service") {
            const services = await ServicesCategoryModel.find();
            SUCCESS(res, 200, "Categories fetched successfully", { data: { services } });
            return;
        } else if (type === "job") {
            const jobs = await JobCategoryModel.find();
            SUCCESS(res, 200, "Categories fetched successfully", { data: { jobs } });
            return;
        } else if (type === "time") {
            const times = await TimeCategoryModel.find();
            SUCCESS(res, 200, "Categories fetched successfully", { data: { times } });
            return;
        } else if (type === "bussiness") {
            const bussiness = await BusinessCategoryModel.find();
            SUCCESS(res, 200, "Categories fetched successfully", { data: { bussiness } });
            return;
        }  else {
            const [departments, services, jobs, times, bussiness ] = await Promise.all(
                [
                    DepartmentCategoryModel.find(),
                    ServicesCategoryModel.find(),
                    JobCategoryModel.find(),
                    TimeCategoryModel.find(),
                    BusinessCategoryModel.find(),
                ]);
            SUCCESS(res, 200, "Categories fetched successfully", { data: { departments, services, jobs, times, bussiness } });
            return;
        }
    } catch (error) {
        next(error);
    }
};

export default { createCategory, deleteCategory, getCategories };
