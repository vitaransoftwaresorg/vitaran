export type SmeContact = {
  name: string;
  subject: string;
  email: string;
};

export type AppSettings = {
  maintenanceMode: boolean;
  teacherResourcesPublic: boolean;
  answerKeysPublic: boolean;
  resultsPublic: boolean;
  vitaranEmails: string[];
  smeContacts: SmeContact[];
  updatedAt: string;
};

export type PublicSettings = {
  maintenanceMode: boolean;
  teacherResourcesPublic: boolean;
  answerKeysPublic: boolean;
  resultsPublic: boolean;
};

export type UpdateAppSettingsInput = {
  maintenanceMode: boolean;
  teacherResourcesPublic: boolean;
  answerKeysPublic: boolean;
  resultsPublic: boolean;
  vitaranEmails: string[];
  smeContacts: SmeContact[];
};
