import { NextFunction, Request, Response } from "express";
import { DepartmentCategoryModel } from "../models/DepartmentCategory";
import { BadRequestError } from "../utils/errors";
import { SUCCESS } from "../utils/response";
import { ServicesCategoryModel } from "../models/ServicesCategory";
import { JobCategoryModel } from "../models/JobCategory";
import { TimeCategoryModel } from "../models/TimeCategory";
import { BusinessCategoryModel } from "../models/BusinessCategory";
import { UserModel } from "../models/User";
import { ClientModel } from "../models/Client";
import { JobModel } from "../models/Job";
import { TimesheetModel } from "../models/Timesheet";

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
            const departments = await DepartmentCategoryModel.find().lean();
            const teams = await UserModel.find({ role: "team" }, { _id: 1, departmentId: 1, }).lean();
            departments.forEach((department: any) => {
                department.count = teams.filter((team: any) => team.departmentId.toString() === department._id.toString()).length
            })

            SUCCESS(res, 200, "Categories fetched successfully", { data: { departments } });
            return;
        } else if (type === "service") {
            const services = await ServicesCategoryModel.find();
            const clients = await ClientModel.find({"services.0": {$exists: true}}).lean(); 
            services.forEach((service: any) => {
                service.count = clients.filter((client: any) => client.services.includes(service._id.toString())).length
            })
            SUCCESS(res, 200, "Categories fetched successfully", { data: { services } });
            return;
        } else if (type === "job") {
            const jobs = await JobCategoryModel.find().lean();
            const jobList = await JobModel.find().lean();
            jobs.forEach((job: any) => {
                job.count = jobList.filter((jobList: any) => jobList.categoryId.toString() === job._id.toString()).length
            })
            SUCCESS(res, 200, "Categories fetched successfully", { data: { jobs } });
            return;
        } else if (type === "time") {
            const times = await TimeCategoryModel.find().lean();
            const timesheets = await TimesheetModel.find().lean();
            times.forEach((time: any) => {
                time.count = timesheets.filter((timesheet: any) => timesheet.timeId.toString() === time._id.toString()).length
            })

            SUCCESS(res, 200, "Categories fetched successfully", { data: { times } });
            return;
        } else if (type === "bussiness") {
            const bussiness = await BusinessCategoryModel.find().lean();
            const clients = await ClientModel.find({}, { _id: 1, businessTypeId: 1}).lean();
            bussiness.forEach((bussiness: any) => {
                bussiness.count = clients.filter((client: any) => client.businessTypeId.toString() === bussiness._id.toString()).length
            })
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
