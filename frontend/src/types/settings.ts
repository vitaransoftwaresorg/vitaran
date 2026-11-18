export type SmeContact = {
  name: string;
  subject: string;
  email: string;
};

export type AppSettings = {
  maintenanceMode: boolean;
  teacherResourcesPublic: boolean;
  answerKeysPublic: boolean;
  vitaranEmails: string[];
  smeContacts: SmeContact[];
  updatedAt: string;
};

export type PublicSettings = {
  maintenanceMode: boolean;
  teacherResourcesPublic: boolean;
  answerKeysPublic: boolean;
};

export type UpdateAppSettingsInput = {
  maintenanceMode: boolean;
  teacherResourcesPublic: boolean;
  answerKeysPublic: boolean;
  vitaranEmails: string[];
  smeContacts: SmeContact[];
};
