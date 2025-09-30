import mongoose, { Document, Schema } from 'mongoose';

export interface IFeatureAccess extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;

  // Time
  myTimesheet: boolean;
  allTimesheets: boolean;
  timeLogs: boolean;

  // WIP & Debtors
  WIP: boolean;
  agedWIP: boolean;
  invoices: boolean;
  agedDebtors: boolean;
  writeOff: boolean;

  // Clients
  clientList: boolean;
  clientBreakdown: boolean;

  // Jobs
  services: boolean;
  jobTemplates: boolean;
  jobBuilder: boolean;
  jobList: boolean;

  // Expenses
  clientExpenses: boolean;
  teamExpenses: boolean;

  // Reports
  reports: boolean;

  // Team
  teamList: boolean;
  rates: boolean;
  permissions: boolean;
  access: boolean;

  // Settings
  general: boolean;
  invoicing: boolean;
  tags: boolean;
  clientImport: boolean;
  jobImport: boolean;
  timeLogsImport: boolean;
  integrations: boolean;
}

const featureAccessSchema = new Schema<IFeatureAccess>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Time
  myTimesheet: { type: Boolean, default: true },
  allTimesheets: { type: Boolean, default: false },
  timeLogs: { type: Boolean, default: false },

  // WIP & Debtors
  WIP: { type: Boolean, default: false },
  agedWIP: { type: Boolean, default: false },
  invoices: { type: Boolean, default: false },
  agedDebtors: { type: Boolean, default: false },
  writeOff: { type: Boolean, default: false },

  // Clients
  clientList: { type: Boolean, default: false },
  clientBreakdown: { type: Boolean, default: false },

  // Jobs
  services: { type: Boolean, default: false },
  jobTemplates: { type: Boolean, default: false },
  jobBuilder: { type: Boolean, default: false },
  jobList: { type: Boolean, default: false },

  // Expenses
  clientExpenses: { type: Boolean, default: false },
  teamExpenses: { type: Boolean, default: false },

  // Reports
  reports: { type: Boolean, default: false },

  // Team
  teamList: { type: Boolean, default: false },
  rates: { type: Boolean, default: false },
  permissions: { type: Boolean, default: false },
  access: { type: Boolean, default: false },

  // Settings
  general: { type: Boolean, default: false },
  invoicing: { type: Boolean, default: false },
  tags: { type: Boolean, default: false },
  clientImport: { type: Boolean, default: false },
  timeLogsImport: { type: Boolean, default: false },
  integrations: { type: Boolean, default: false },
});

export const FeatureAccessModel = mongoose.model<IFeatureAccess>('FeatureAccess', featureAccessSchema);
