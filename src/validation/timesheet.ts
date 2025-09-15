import Joi from "joi";

const weeklyHoursSchema = Joi.object({
    monday: Joi.number().min(0).default(0),
    tuesday: Joi.number().min(0).default(0),
    wednesday: Joi.number().min(0).default(0),
    thursday: Joi.number().min(0).default(0),
    friday: Joi.number().min(0).default(0),
    saturday: Joi.number().min(0).default(0),
    sunday: Joi.number().min(0).default(0),
    total: Joi.number().min(0).default(0),
});

const addTimesheetValidation = {
    body: Joi.object({
        weekstart: Joi.date().required(),
        weekend: Joi.date().required(),
        status: Joi.string().valid("draft", "review", "approved", "rejected").default("draft"),

        entries: Joi.array().items(
            Joi.object({
                clientId: Joi.string().required(),
                jobId: Joi.string().required(),
                timeCategoryId: Joi.string().required(),

                description: Joi.string().allow('', null),
                isbillable: Joi.boolean().required().default(false),
                rate: Joi.number().min(0).optional(),

                dailyHours: weeklyHoursSchema.optional(),
                totalHours: Joi.number().min(0).optional(),
                totalAmount: Joi.number().min(0).optional(),
            })
        ).required(),

        billableHours: weeklyHoursSchema.optional(),
        nonBillableHours: weeklyHoursSchema.optional(),
        totalLoggedHours: weeklyHoursSchema.optional(),
        variance: weeklyHoursSchema.optional(),

        submittedAt: Joi.date().optional(),
        submittedBy: Joi.string().optional(),

        reviewedAt: Joi.date().optional(),
        reviewedBy: Joi.string().optional(),

        approvedAt: Joi.date().optional(),
        approvedBy: Joi.string().optional(),

        rejectedAt: Joi.date().optional(),
        rejectedBy: Joi.string().optional(),
        rejectionReason: Joi.string().allow('', null).optional(),
    })
};

const updateTimesheetValidation = {
    params: Joi.object({
        timesheetId: Joi.string().required().messages({
            "string.base": "Timesheet ID must be a string",
            "any.required": "Timesheet ID is required",
        }),
    }),
    body: Joi.object({
        status: Joi.string().valid('draft', 'review', 'approved', 'rejected').optional(),
        entries: Joi.array().items(
            Joi.object({
                clientId: Joi.string().required(),
                jobId: Joi.string().required(),
                timeCategoryId: Joi.string().required(),

                description: Joi.string().allow('', null),
                isbillable: Joi.boolean().required().default(false),
                rate: Joi.number().min(0).optional(),

                dailyHours: weeklyHoursSchema.optional(),
                totalHours: Joi.number().min(0).optional(),
                totalAmount: Joi.number().min(0).optional(),
            })
        ).optional(),

        billableHours: weeklyHoursSchema.optional(),
        nonBillableHours: weeklyHoursSchema.optional(),
        totalLoggedHours: weeklyHoursSchema.optional(),
        variance: weeklyHoursSchema.optional(),

        submittedAt: Joi.date().optional(),
        submittedBy: Joi.string().optional(),

        reviewedAt: Joi.date().optional(),
        reviewedBy: Joi.string().optional(),

        approvedAt: Joi.date().optional(),
        approvedBy: Joi.string().optional(),

        rejectedAt: Joi.date().optional(),
        rejectedBy: Joi.string().optional(),
        rejectionReason: Joi.string().allow('', null).optional(),
    })
}
export default { addTimesheetValidation, updateTimesheetValidation };