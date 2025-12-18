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
import { TimeEntryModel } from "../models/TimeEntry";
import { WipTragetAmountsModel } from "../models/WIPTargetAmounts";

const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
        const { name, amount, type } = req.body;
        const companyId = req.user.companyId;
        if (type === "department") {
            if (!name) {
                throw new BadRequestError("Category name is required");
            };
            const existingCategory = await DepartmentCategoryModel.findOne({ name, companyId });
            if (existingCategory) {
                throw new BadRequestError("Category already exists");
            }
            await DepartmentCategoryModel.create({ name, companyId });
            SUCCESS(res, 200, "Category created successfully", { data: {} });
            return;
        } else if (type === "service") {
                  if (!name) {
                throw new BadRequestError("Category name is required");
            };
            const existingCategory = await ServicesCategoryModel.findOne({ name, companyId });
            if (existingCategory) {
                throw new BadRequestError("Category already exists");
            }
            await ServicesCategoryModel.create({ name, companyId });
            SUCCESS(res, 200, "Category created successfully", { data: {} });
            return;
        } else if (type === "job") {
                  if (!name) {
                throw new BadRequestError("Category name is required");
            };
            const existingCategory = await JobCategoryModel.findOne({ name, companyId });
            if (existingCategory) {
                throw new BadRequestError("Category already exists");
            }
            await JobCategoryModel.create({ name, companyId });
            SUCCESS(res, 200, "Category created successfully", { data: {} });
            return;
        } else if (type === "time") {
                  if (!name) {
                throw new BadRequestError("Category name is required");
            };
            const existingCategory = await TimeCategoryModel.findOne({ name, companyId });
            if (existingCategory) {
                throw new BadRequestError("Category already exists");
            }
            await TimeCategoryModel.create({ name, companyId });
            SUCCESS(res, 200, "Category created successfully", { data: {} });
            return;
        } else if (type === "bussiness") {
                  if (!name) {
                throw new BadRequestError("Category name is required");
            };
            const existingCategory = await BusinessCategoryModel.findOne({ name, companyId });
            if (existingCategory) {
                throw new BadRequestError("Category already exists");
            }
            await BusinessCategoryModel.create({ name, companyId });
            SUCCESS(res, 200, "Category created successfully", { data: {} });
            return;
        } else if (type === "wipTargetAmount") {
            if (!amount) {
                throw new BadRequestError("Amount is required");
            };
            const existingCategory = await WipTragetAmountsModel.findOne({ amount, companyId });
            if (existingCategory) {
                throw new BadRequestError("Category already exists");
            }
            await WipTragetAmountsModel.create({ amount, companyId });
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
        } else if (type === "wipTargetAmount") {
            const category = await WipTragetAmountsModel.findByIdAndDelete(id);
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
        const { companyId } = req.user;
        const { type = "all" } = req.query;
        if (type === "department") {
            const departments = await DepartmentCategoryModel.find({ companyId }).lean();
            const teams = await UserModel.find({ role: "team" }, { _id: 1, departmentId: 1, }).lean();
            departments.forEach((department: any) => {
                department.count = teams.filter((team: any) => team.departmentId.toString() === department._id.toString()).length
            })

            SUCCESS(res, 200, "Categories fetched successfully", { data: { departments } });
            return;
        } else if (type === "service") {
            const services = await ServicesCategoryModel.find({ companyId }).lean();
            const clients = await ClientModel.find({ "services.0": { $exists: true } }).lean();
            services.forEach((service: any) => {
                service.count = clients.filter((client: any) => client.services.includes(service._id.toString())).length
            })
            SUCCESS(res, 200, "Categories fetched successfully", { data: { services } });
            return;
        } else if (type === "job") {
            const jobs = await JobCategoryModel.find({ companyId }).lean();
            const jobList = await JobModel.find({}, { jobTypeId: 1 }).lean();
            jobs.forEach((job: any) => {
                job.count = jobList.filter((jobList: any) => jobList.jobTypeId.toString() === job._id.toString()).length
            })
            SUCCESS(res, 200, "Categories fetched successfully", { data: { jobs } });
            return;
        } else if (type === "time") {
            const times = await TimeCategoryModel.find({ companyId }).lean();
            const timeEntries = await TimeEntryModel.find({ companyId }, { _id: 1, timeCategoryId: 1 }).lean();
            times.forEach((time: any) => {
                time.count = timeEntries.filter((timeEntry: any) => timeEntry.timeCategoryId.toString() === time._id.toString()).length
            })

            SUCCESS(res, 200, "Categories fetched successfully", { data: { times } });
            return;
        } else if (type === "bussiness") {
            const bussiness = await BusinessCategoryModel.find({ companyId }).lean();
            const clients = await ClientModel.find({}, { _id: 1, businessTypeId: 1 }).lean();
            bussiness.forEach((bussiness: any) => {
                const bussinessId = bussiness?._id?.toString();
                bussiness.count = clients.filter((client: any) => {
                    // console.log("client====", client?.businessTypeId);
                    const clientBusinessTypeId = client?.businessTypeId ? client.businessTypeId.toString() : null;
                    if (!clientBusinessTypeId || !bussinessId) {
                        return false;
                    }
                    return clientBusinessTypeId === bussinessId;
                }).length;
            })
            SUCCESS(res, 200, "Categories fetched successfully", { data: { bussiness } });
            return;
        } else if (type === "wipTargetAmount") {
            const wipTargetAmount = await WipTragetAmountsModel.find({ companyId }).lean();
            const clients = await ClientModel.find({companyId, wipTargetId: { $exists: true }}).lean();
            const jobs = await JobModel.find({companyId, wipTargetId: { $exists: true }}).lean();
            wipTargetAmount.forEach((traget: any) => {
                traget.count = clients.filter((client: any) => client.wipTargetId.toString() === traget._id.toString()).length
            })
            wipTargetAmount.forEach((traget: any) => {
                traget.count += jobs.filter((job: any) => job.wipTargetId.toString() === traget._id.toString()).length
            })
            SUCCESS(res, 200, "Categories fetched successfully", { data: { wipTargetAmount } });
            return;
        } else {
            const [departments, services, jobs, times, bussiness, userDepartments, clientServices, clientBussiness, jobList, timeEntries, wipTargetAmount, jobWipTarget, clientWipTarget ] = await Promise.all(
                [
                    DepartmentCategoryModel.find({ companyId }).lean(),
                    ServicesCategoryModel.find({ companyId }).lean(),
                    JobCategoryModel.find({ companyId }).lean(),
                    TimeCategoryModel.find({ companyId }).lean(),
                    BusinessCategoryModel.find({ companyId }).lean(),
                    UserModel.find({ role: "team" }, { _id: 1, departmentId: 1, }).lean(),
                    ClientModel.find({ "services.0": { $exists: true } }, { _id: 1, services: 1 }).lean(),
                    ClientModel.find({}, { _id: 1, businessTypeId: 1 }).lean(),
                    JobModel.find({}, { jobTypeId: 1 }).lean(),
                    TimeEntryModel.find({ companyId }, { _id: 1, timeCategoryId: 1 }).lean(),
                    WipTragetAmountsModel.find({ companyId }).lean(),
                    JobModel.find({companyId, wipTargetId: { $exists: true }}, { _id: 1, wipTargetId: 1 }).lean(),
                    ClientModel.find({companyId, wipTargetId: { $exists: true }}, { _id: 1, wipTargetId: 1 }).lean(),
                ]);
            departments.forEach((department: any) => {
                department.count = userDepartments.filter((team: any) => team.departmentId.toString() === department._id.toString()).length
            })
            services.forEach((service: any) => {
                const serviceId = service?._id?.toString();
                service.count = clientServices.filter((client: any) => {
                    if (!Array.isArray(client?.services) || !serviceId) {
                        return false;
                    }
                    return client.services.map((svc: any) => svc?.toString?.()).includes(serviceId);
                }).length;
            })
            jobs.forEach((job: any) => {
                const jobId = job?._id?.toString();
                job.count = jobList.filter((jobList: any) => {
                    const jobTypeId = jobList?.jobTypeId ? jobList.jobTypeId.toString() : null;
                    if (!jobTypeId || !jobId) {
                        return false;
                    }
                    return jobTypeId === jobId;
                }).length;
            })
            times.forEach((time: any) => {
                const timeId = time?._id?.toString();
                time.count = timeEntries.filter((timeEntry: any) => {
                    const timeCategoryId = timeEntry?.timeCategoryId ? timeEntry.timeCategoryId.toString() : null;
                    if (!timeCategoryId || !timeId) {
                        return false;
                    }
                    return timeCategoryId === timeId;
                }).length;
            })
            bussiness.forEach((bussiness: any) => {
                const bussinessId = bussiness?._id?.toString();
                bussiness.count = clientBussiness.filter((client: any) => {
                    const clientBusinessTypeId = client?.businessTypeId ? client.businessTypeId.toString() : null;
                    if (!clientBusinessTypeId || !bussinessId) {
                        return false;
                    }
                    return clientBusinessTypeId === bussinessId;
                }).length;
            })

            wipTargetAmount.forEach((traget: any) => {
                const targetId = traget?._id?.toString();
                let count =0;
                count += jobWipTarget.filter((job: any) => {
                    const jobTargetId = job?.wipTargetId ? job.wipTargetId.toString() : null;
                    if (!jobTargetId || !targetId) {
                        return false;
                    }
                    return jobTargetId === targetId;
                }).length
                count += clientWipTarget.filter((client: any) => {
                    const clientTargetId = client?.wipTargetId ? client.wipTargetId.toString() : null;
                    if (!clientTargetId || !targetId) {
                        return false;
                    }
                    return clientTargetId === targetId;
                }).length
                traget.count = count
            })
           
            console.log("jobWipTarget", jobWipTarget, clientWipTarget);

            SUCCESS(res, 200, "Categories fetched successfully", { data: { departments, services, jobs, times, bussiness, wipTargetAmount } });
            return;
        }
    } catch (error) {
        next(error);
    }
};

export default { createCategory, deleteCategory, getCategories };
