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
        weekStart: Joi.date().iso().required()
            .messages({
                'date.base': 'weekStart must be a valid date',
                'date.format': 'weekStart must be in ISO 8601 format',
                'any.required': 'weekStart is required'
            }),

        weekEnd: Joi.date().iso().required()
            .min(Joi.ref('weekStart'))
            .messages({
                'date.base': 'weekEnd must be a valid date',
                'date.format': 'weekEnd must be in ISO 8601 format',
                'date.min': 'weekEnd must be after weekStart',
                'any.required': 'weekEnd is required'
            }),

        status: Joi.string()
            .valid('draft', 'submitted', 'reviewed', 'approved', 'rejected')
            .default('draft')
            .messages({
                'any.only': 'status must be one of: draft, submitted, reviewed, approved, rejected'
            }),

        timeEntries: Joi.array().items(
            Joi.object({
                clientId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
                    .messages({
                        'string.pattern': 'clientId must be a valid MongoDB ObjectId',
                        'any.required': 'clientId is required'
                    }),

                jobId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
                    .messages({
                        'string.pattern': 'jobId must be a valid MongoDB ObjectId',
                        'any.required': 'jobId is required'
                    }),

                timeCategoryId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
                    .messages({
                        'string.pattern': 'timeCategoryId must be a valid MongoDB ObjectId',
                        'any.required': 'timeCategoryId is required'
                    }),

                description: Joi.string()
                    .max(500)
                    .allow('', null)
                    .messages({
                        'string.max': 'description cannot exceed 500 characters'
                    }),

                isbillable: Joi.boolean()
                    .default(false)
                    .messages({
                        'boolean.base': 'isbillable must be a boolean value'
                    }),

                rate: Joi.number()
                    .min(0)
                    .precision(2)
                    .when('isbillable', {
                        is: true,
                        then: Joi.required(),
                        otherwise: Joi.optional()
                    })
                    .messages({
                        'number.base': 'rate must be a number',
                        'number.min': 'rate cannot be negative',
                        'number.precision': 'rate can have maximum 2 decimal places',
                        'any.required': 'rate is required when isbillable is true'
                    }),

                logs: Joi.array().items(
                    Joi.object({
                        date: Joi.date().iso().required()
                            .messages({
                                'date.base': 'log date must be a valid date',
                                'date.format': 'log date must be in ISO 8601 format',
                                'any.required': 'log date is required'
                            }),

                        duration: Joi.number()
                            .integer()
                            .min(1)
                            .max(1440) // Maximum 24 hours in minutes
                            .required()
                            .messages({
                                'number.base': 'duration must be a number',
                                'number.integer': 'duration must be an integer',
                                'number.min': 'duration must be at least 1 minute',
                                'number.max': 'duration cannot exceed 1440 minutes (24 hours)',
                                'any.required': 'duration is required'
                            })
                    })
                ).min(1).required()
                    .messages({
                        'array.min': 'at least one log entry is required',
                        'any.required': 'logs array is required'
                    }),

                totalHours: Joi.number()
                    .min(0)
                    .precision(2)
                    .messages({
                        'number.base': 'totalHours must be a number',
                        'number.min': 'totalHours cannot be negative',
                        'number.precision': 'totalHours can have maximum 2 decimal places'
                    }),

                totalAmount: Joi.number()
                    .min(0)
                    .precision(2)
                    .messages({
                        'number.base': 'totalAmount must be a number',
                        'number.min': 'totalAmount cannot be negative',
                        'number.precision': 'totalAmount can have maximum 2 decimal places'
                    })
            })
        ).messages({
            'array.base': 'timeEntries must be an array'
        }),

        dailySummary: Joi.array().items(
            Joi.object({
                date: Joi.date().iso().required()
                    .messages({
                        'date.base': 'daily summary date must be a valid date',
                        'date.format': 'daily summary date must be in ISO 8601 format',
                        'any.required': 'daily summary date is required'
                    }),

                billable: Joi.number()
                    .integer()
                    .min(0)
                    .default(0)
                    .messages({
                        'number.base': 'billable must be a number',
                        'number.integer': 'billable must be an integer',
                        'number.min': 'billable cannot be negative'
                    }),

                nonBillable: Joi.number()
                    .integer()
                    .min(0)
                    .default(0)
                    .messages({
                        'number.base': 'nonBillable must be a number',
                        'number.integer': 'nonBillable must be an integer',
                        'number.min': 'nonBillable cannot be negative'
                    }),

                totalLogged: Joi.number()
                    .integer()
                    .min(0)
                    .messages({
                        'number.base': 'totalLogged must be a number',
                        'number.integer': 'totalLogged must be an integer',
                        'number.min': 'totalLogged cannot be negative',
                    }),

                capacity: Joi.number()
                    .integer()
                    .min(0)
                    .default(480)
                    .messages({
                        'number.base': 'capacity must be a number',
                        'number.integer': 'capacity must be an integer',
                        'number.min': 'capacity cannot be negative'
                    }),

                variance: Joi.number()
                    .integer()
                    .messages({
                        'number.base': 'variance must be a number',
                        'number.integer': 'variance must be an integer',
                    })
            })
        ).messages({
            'array.base': 'dailySummary must be an array'
        }),

        // Total fields with cross-validation
        totalBillable: Joi.number()
            .integer()
            .min(0)
            .messages({
                'number.base': 'totalBillable must be a number',
                'number.integer': 'totalBillable must be an integer',
                'number.min': 'totalBillable cannot be negative',
                
            }),

        totalNonBillable: Joi.number()
            .integer()
            .min(0)
            .messages({
                'number.base': 'totalNonBillable must be a number',
                'number.integer': 'totalNonBillable must be an integer',
                'number.min': 'totalNonBillable cannot be negative',
            }),

        totalLogged: Joi.number()
            .integer()
            .min(0)
            .messages({
                'number.base': 'totalLogged must be a number',
                'number.integer': 'totalLogged must be an integer',
                'number.min': 'totalLogged cannot be negative',
            }),

        totalCapacity: Joi.number()
            .integer()
            .min(0)
            .messages({
                'number.base': 'totalCapacity must be a number',
                'number.integer': 'totalCapacity must be an integer',
                'number.min': 'totalCapacity cannot be negative',
            }),

        totalVariance: Joi.number()
            .integer()
            
            .messages({
                'number.base': 'totalVariance must be a number',
                'number.integer': 'totalVariance must be an integer',
                
            }),

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