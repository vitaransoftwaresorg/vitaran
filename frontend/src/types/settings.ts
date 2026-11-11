export type SmeContact = {
  name: string;
  subject: string;
  email: string;
};

export type AppSettings = {
  maintenanceMode: boolean;
  vitaranEmails: string[];
  smeContacts: SmeContact[];
  updatedAt: string;
};

export type PublicSettings = {
  maintenanceMode: boolean;
};

export type UpdateAppSettingsInput = {
  maintenanceMode: boolean;
  vitaranEmails: string[];
  smeContacts: SmeContact[];
};
