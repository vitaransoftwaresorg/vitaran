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
  resultsAutoPublish: boolean;
  schoolDesktopOmrEnabled: boolean;
  teacherDesktopOmrEnabled: boolean;
  schoolMobileOmrEnabled: boolean;
  teacherMobileOmrEnabled: boolean;
  homeNetworkEnabled: boolean;
  vitaranEmails: string[];
  smeContacts: SmeContact[];
  updatedAt: string;
};

export type PublicSettings = {
  maintenanceMode: boolean;
  teacherResourcesPublic: boolean;
  answerKeysPublic: boolean;
  resultsPublic: boolean;
  schoolDesktopOmrEnabled: boolean;
  teacherDesktopOmrEnabled: boolean;
  schoolMobileOmrEnabled: boolean;
  teacherMobileOmrEnabled: boolean;
  homeNetworkEnabled: boolean;
};

export type UpdateAppSettingsInput = {
  maintenanceMode: boolean;
  teacherResourcesPublic: boolean;
  answerKeysPublic: boolean;
  resultsPublic: boolean;
  resultsAutoPublish: boolean;
  schoolDesktopOmrEnabled: boolean;
  teacherDesktopOmrEnabled: boolean;
  schoolMobileOmrEnabled: boolean;
  teacherMobileOmrEnabled: boolean;
  homeNetworkEnabled: boolean;
  vitaranEmails: string[];
  smeContacts: SmeContact[];
};
