export type SmeContact = {
  name: string;
  subject: string;
  email: string;
};

export type AppSettings = {
  maintenanceMode: boolean;
  vitaranEmail: string | null;
  smeContacts: SmeContact[];
  updatedAt: string;
};

export type PublicSettings = {
  maintenanceMode: boolean;
};

export type UpdateAppSettingsInput = {
  maintenanceMode: boolean;
  vitaranEmail?: string | null;
  smeContacts: SmeContact[];
};
