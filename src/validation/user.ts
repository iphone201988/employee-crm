import Joi, { allow } from "joi";
const addTeamMemberValidation = {
  body: Joi.object({
    name: Joi.string().required().messages({
      "string.base": "Name must be a string",
      "any.required": "Name is required",
    }),
    email: Joi.string().email().required().messages({
      "string.base": "Email must be a string",
      "string.email": "Invalid email format",
      "any.required": "Email is required",
    }),
    departmentId: Joi.string().required().messages({
      "string.base": "Department ID must be a string",
      "any.required": "Department ID is required",
    }),
    workSchedule: Joi.object().optional().messages({
      "object.base": "Work schedule must be a string",
    }),
    avatarUrl: Joi.string().allow(null).optional(),
    hourlyRate: Joi.number().optional().messages({
      "number.base": "Hourly rate must be a number",
    }),
    billableRate: Joi.number().optional().messages({
      "number.base": "Billable rate must be a number",
    }),
  }),
};

const sendInviteToTeamMemberValidation = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "string.base": "Email must be a string",
      "string.email": "Invalid email format",
      "any.required": "Email is required",
    }),
  })
};
const updateTeamMembersValidation = {
  body: Joi.object({
    featureAccess: Joi.array().items(
      Joi.object({
        userId: Joi.string().required().messages({
          "string.base": "User ID must be a string",
          "any.required": "User ID is required",
        }),
        myTimesheet: Joi.boolean().optional().messages({
          "boolean.base": "My timesheet must be a boolean",
        }),
        allTimesheets: Joi.boolean().optional().messages({
          "boolean.base": "All timesheets must be a boolean",
        }),
        timeLogs: Joi.boolean().optional().messages({
          "boolean.base": "Time logs must be a boolean",
        }),
        WIP: Joi.boolean().optional().messages({
          "boolean.base": "WIP must be a boolean",
        }),
        agedWIP: Joi.boolean().optional().messages({
          "boolean.base": "Aged WIP must be a boolean",
        }),
        invoices: Joi.boolean().optional().messages({
          "boolean.base": "Invoices must be a boolean",
        }),
        agedDebtors: Joi.boolean().optional().messages({
          "boolean.base": "Aged debtors must be a boolean",
        }),
        writeOff: Joi.boolean().optional().messages({
          "boolean.base": "Write off must be a boolean",
        }),
        clientList: Joi.boolean().optional().messages({
          "boolean.base": "Client list must be a boolean",
        }),
        clientBreakdown: Joi.boolean().optional().messages({
          "boolean.base": "Client breakdown must be a boolean",
        }),
        services: Joi.boolean().optional().messages({
          "boolean.base": "Services must be a boolean",
        }),
        jobTemplates: Joi.boolean().optional().messages({
          "boolean.base": "Job templates must be a boolean",
        }),
        jobBuilder: Joi.boolean().optional().messages({
          "boolean.base": "Job builder must be a boolean",
        }),
        jobList: Joi.boolean().optional().messages({
          "boolean.base": "Job list must be a boolean",
        }),
        clientExpenses: Joi.boolean().optional().messages({
          "boolean.base": "Client expenses must be a boolean",
        }),
        teamExpenses: Joi.boolean().optional().messages({
          "boolean.base": "Team expenses must be a boolean",
        }),
        reports: Joi.boolean().optional().messages({
          "boolean.base": "Reports must be a boolean",
        }),
        teamList: Joi.boolean().optional().messages({
          "boolean.base": "Team list must be a boolean",
        }),
        rates: Joi.boolean().optional().messages({
          "boolean.base": "Rates must be a boolean",
        }),
        permissions: Joi.boolean().optional().messages({
          "boolean.base": "Permissions must be a boolean",
        }),
        access: Joi.boolean().optional().messages({
          "boolean.base": "Access must be a boolean",
        }),
        general: Joi.boolean().optional().messages({
          "boolean.base": "General must be a boolean",
        }),
        invoicing: Joi.boolean().optional().messages({
          "boolean.base": "Invoicing must be a boolean",
        }),
        tags: Joi.boolean().optional().messages({
          "boolean.base": "Tags must be a boolean",
        }),
        clientImport: Joi.boolean().optional().messages({
          "boolean.base": "Client import must be a boolean",
        }),
        timeLogsImport: Joi.boolean().optional().messages({
          "boolean.base": "Time logs import must be a boolean",
        }),
        integrations: Joi.boolean().optional().messages({
          "boolean.base": "Integrations must be a boolean",
        })
      })),
    rates: Joi.array().items(
      Joi.object({
        userId: Joi.string().required().messages({
          "string.base": "User ID must be a string",
          "any.required": "User ID is required",
        }),
        hourlyRate: Joi.number().optional().messages({
          "number.base": "Hourly rate must be a number",
        }),
        billableRate: Joi.number().optional().messages({
          "number.base": "Billable rate must be a number",
        }),
        isLocked: Joi.boolean().optional().messages({
          "boolean.base": "Is locked must be a boolean",
        }),
        jobFees:Joi.array().items(Joi.object({
          jobId: Joi.string().required().messages({
            "string.base": "Job ID must be a string",
            "any.required": "Job ID is required",
          }),
          fee: Joi.number().required().messages({
            "number.base": "Fee must be a number",
            "any.required": "Fee is required",
          }),
        })).optional().messages({
          "array.base": "Job fees must be an array",
        })
      })),
    permissions: Joi.array().items(Joi.object({
      userId: Joi.string().required().messages({
        "string.base": "User ID must be a string",
        "any.required": "User ID is required",
      }),
      approveTimesheets: Joi.boolean().optional().messages({
        "boolean.base": "Approve timesheets must be a boolean",
      }),
      editServices: Joi.boolean().optional().messages({
        "boolean.base": "Edit services must be a boolean",
      }),
      editJobBuilder: Joi.boolean().optional().messages({
        "boolean.base": "Edit job builder must be a boolean",
      }),
      editJobTemplates: Joi.boolean().optional().messages({
        "boolean.base": "Edit job templates must be a boolean",
      }),
    })),
    blukWeeklyHours: Joi.array().items(Joi.object({
      userId: Joi.string().required().messages({
        "string.base": "User ID must be a string",
        "any.required": "User ID is required",
      }),
      workSchedule: Joi.object({
        monday: Joi.number().min(0).optional(),
        tuesday: Joi.number().min(0).optional(),
        wednesday: Joi.number().min(0).optional(),
        thursday: Joi.number().min(0).optional(),
        friday: Joi.number().min(0).optional(),
        saturday: Joi.number().min(0).optional(),
        sunday: Joi.number().min(0).optional(),
      })
        .optional()
        .messages({
          "object.base": "Work schedule must be an object",
        }),
    })),
    singleTeamMenber: Joi.object({
      userId: Joi.string().required().messages({
        "string.base": "User ID must be a string",
        "any.required": "User ID is required",
      }),
      workSchedule: Joi.object({
        monday: Joi.number().min(0).optional(),
        tuesday: Joi.number().min(0).optional(),
        wednesday: Joi.number().min(0).optional(),
        thursday: Joi.number().min(0).optional(),
        friday: Joi.number().min(0).optional(),
        saturday: Joi.number().min(0).optional(),
        sunday: Joi.number().min(0).optional(),
      })
        .optional()
        .messages({
          "object.base": "Work schedule must be an object",
        }),
      name: Joi.string().optional().messages({
        "string.base": "Name must be a string",
      }),
      departmentId: Joi.string().optional().messages({
        "string.base": "Department ID must be a string",
      }),
      avatarUrl: Joi.string().allow(null).optional(),
      hourlyRate: Joi.number().optional().messages({
        "number.base": "Hourly rate must be a number",
      }),
      billableRate: Joi.number().optional().messages({
        "number.base": "Billable rate must be a number",
      }),
      status: Joi.string().valid("active", "inActive").optional().messages({
        "string.base": "Status must be a string",
      }),
      isLocked: Joi.boolean().optional().messages({
        "boolean.base": "Is locked must be a boolean",
      }),
      jobFees:Joi.array().items(Joi.object({
        jobId: Joi.string().required().messages({
          "string.base": "job ID must be a string",
          "any.required": "Job ID is required",
        }),
        fee: Joi.number().required().messages({
          "number.base": "Fee must be a number",
          "any.required": "Fee is required",
        }),
      })).optional().messages({
        "array.base": "Job fees must be an array",
      })


    })

  })
}
const setPasswordValidation = {
  body: Joi.object({
    password: Joi.string().required().messages({
      "string.base": "Password must be a string",
      "any.required": "Password is required",
    }),
    token: Joi.string().required().messages({
      "string.base": "Token must be a string",
      "any.required": "Token is required",
    })
  }),
}
const getAccessOftabsValidation = {
  query: Joi.object({
    tabName: Joi.string().required().messages({
      "string.base": "Tab name must be a string",
      "any.required": "Tab name is required",
    }),
    _cacheBuster: Joi.any().optional()
  })
}
export default {
  addTeamMemberValidation,
  sendInviteToTeamMemberValidation,
  updateTeamMembersValidation,
  setPasswordValidation,
  getAccessOftabsValidation

};
