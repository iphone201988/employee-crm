import Joi from "joi";



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
        userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional().messages({
            'string.pattern': 'userId must be a valid MongoDB ObjectId'
        }),

        timeEntries: Joi.array().items(
            Joi.object({
                _id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/)
                    .messages({
                        'string.pattern': 'clientId must be a valid MongoDB ObjectId',
                    }),
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
                            .max(86400) // Maximum 24 hours in seconds
                            .required()
                            .messages({
                                'number.base': 'duration must be a number',
                                'number.integer': 'duration must be an integer',
                                'number.min': 'duration must be at least 1 minute',
                                'number.max': 'duration cannot exceed 86400 seconds (24 hours)',
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
const addTimeLogValidation = {
    body: Joi.object({
        date: Joi.date().required()
            .messages({
                'date.base': 'log date must be a valid date',
                'any.required': 'log date is required'
            }),

        duration: Joi.number()
            .integer()
            .required()
            .messages({
                'number.base': 'duration must be a number',
                'number.integer': 'duration must be an integer',
                'any.required': 'duration is required'
            }),

        rate: Joi.number()
            .messages({
                'number.base': 'rate must be a number',
                'any.required': 'rate is required when isbillable is true'
            }),
        billable: Joi.boolean()
            .messages({
                'boolean.base': 'Billable must be a boolean',
                'any.required': 'Billable is required'
            }),
        description: Joi.string()
            .allow('', null)
            .messages({
                'string.base': 'description must be a string',
            }),

        jobId: Joi.string()
            .allow('', null)
            .messages({
                'string.base': 'jobId must be a string',
                'any.required': 'jobId is required when isbillable is false'
            }),
        jobTypeId: Joi.string()
            .allow('', null)
            .messages({
                'string.base': 'jobTypeId must be a string',
                'any.required': 'jobTypeId is required when isbillable is false'
            }),

        timeCategoryId: Joi.string()
            .allow('', null)
            .messages({
                'string.base': 'timeCategoryId must be a string',
                'any.required': 'timeCategoryId is required when isbillable is false'
            }),

        clientId: Joi.string()
            .allow('', null)
            .messages({
                'string.base': 'clientId must be a string',
                'any.required': 'clientId is required when isbillable is false'
            }),
        userId: Joi.string()
            .allow('', null)
            .messages({
                'string.base': 'userId must be a string',
                'any.required': 'userId is required when isbillable is false'
            }),
        status: Joi.string()
            .valid('notInvoiced', "paid", 'invoiced')
            .default('notInvoiced')
            .messages({
                'any.only': 'status must be one of: notInvoiced, paid, invoiced'
            }),

    })
};
const updateTimeLogValidation = {
    params: Joi.object({
        timeLogId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
            .messages({
                'string.pattern': 'timeLogId must be a valid MongoDB ObjectId',
                'any.required': 'timeLogId is required'
            }),
    }),
    body: Joi.object({
        date: Joi.date().optional(),
        duration: Joi.number()
            .integer()
            .optional()
            .messages({
                'number.base': 'duration must be a number',
                'number.integer': 'duration must be an integer',
            }),
        rate: Joi.number()
            .messages({
                'number.base': 'rate must be a number',
                'any.required': 'rate is required when isbillable is true'
            }),
        billable: Joi.boolean()
            .messages({
                'boolean.base': 'Billable must be a boolean',
                'any.required': 'Billable is required'
            }),
        description: Joi.string()
            .allow('', null)
            .messages({
                'string.base': 'description must be a string',
            }),
        status: Joi.string()
            .valid('notInvoiced', "paid", 'invoiced')
            .messages({
                'any.only': 'status must be one of: notInvoiced, paid, invoiced'
            }),
        clientId: Joi.string()
            .allow('', null)
            .messages({
                'string.base': 'clientId must be a string',
                'any.required': 'clientId is required when isbillable is false'
            }),
        userId: Joi.string()
            .allow('', null)
            .messages({
                'string.base': 'userId must be a string',
                'any.required': 'userId is required when isbillable is false'
            }),
        jobId: Joi.string()
            .allow('', null)
            .messages({
                'string.base': 'jobId must be a string',
                'any.required': 'jobId is required when isbillable is false'
            }),
        jobTypeId: Joi.string()
            .allow('', null)
            .messages({
                'string.base': 'jobTypeId must be a string',
                'any.required': 'jobTypeId is required when isbillable is false'
            }),
        timeCategoryId: Joi.string()
            .allow('', null)
            .messages({
                'string.base': 'timeCategoryId must be a string',
                'any.required': 'timeCategoryId is required when isbillable is false'
            }),
    })
};
const deleteTimeLogValidation = {
    body: Joi.object({
        timeLogIds: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
            .messages({
                'string.pattern': 'timeLogIds must be a valid MongoDB ObjectId',
            }),
    })
};
const changeTimeSheetStatusValidation = {
    body: Joi.object({
        timeSheetId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/)
            .messages({
                'string.pattern': 'timeSheetId must be a valid MongoDB ObjectId',
            }),
        status: Joi.string()
            .valid("rejected", "approved", "reviewed", 'autoApproved')
            .messages({
                'any.only': 'status must be one of: rejected, approved, reviewed, autoApproved'
            }),
    })
};
const addNoteValidation = {
    body: Joi.object({
        note: Joi.string().required()
            .messages({
                'string.base': 'note must be a string',
                'any.required': 'note is required'
            }),
        timesheetId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional()
            .messages({
                'string.pattern': 'timesheetId must be a valid MongoDB ObjectId'
            }),
        clientId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional()
            .messages({
                'string.pattern': 'clientId must be a valid MongoDB ObjectId'
            }),
    }).or('timesheetId', 'clientId')
        .messages({
            'object.missing': 'Either timesheetId or clientId must be provided'
        })
};
const updateNoteValidation = {
    params: Joi.object({
        noteId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
            .messages({
                'string.pattern': 'noteId must be a valid MongoDB ObjectId',
                'any.required': 'noteId is required'
            }),
    }),
    body: Joi.object({
        note: Joi.string().required()
            .messages({
                'string.base': 'note must be a string',
                'any.required': 'note is required'
            }),
    })
};

export default { addTimesheetValidation, addTimeLogValidation, updateTimeLogValidation, deleteTimeLogValidation, changeTimeSheetStatusValidation, addNoteValidation, updateNoteValidation };