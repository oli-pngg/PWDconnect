export const EMPLOYER_VERIFICATION_STATUSES = [
  'not_submitted',
  'pending',
  'needs_information',
  'approved',
  'rejected',
  'suspended'
] as const;

export type EmployerVerificationStatus = (typeof EMPLOYER_VERIFICATION_STATUSES)[number];

export const EMPLOYER_BUSINESS_TYPES = [
  'sole_proprietorship',
  'partnership',
  'corporation',
  'cooperative',
  'nonprofit',
  'government',
  'other'
] as const;

export type EmployerBusinessType = (typeof EMPLOYER_BUSINESS_TYPES)[number];

export const EMPLOYER_VERIFICATION_DOCUMENT_TYPES = [
  'business_registration',
  'local_permit',
  'representative_authorization',
  'other_evidence'
] as const;

export type EmployerVerificationDocumentType = (typeof EMPLOYER_VERIFICATION_DOCUMENT_TYPES)[number];

export type EmployerVerificationSubmission = {
  registeredBusinessName: string;
  tradingName: string;
  businessType: EmployerBusinessType | '';
  registrationAuthority: string;
  registrationNumber: string;
  businessAddress: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  representativeName: string;
  representativeRole: string;
  representativeIsOwnerOrOfficer: boolean | null;
  localPermitApplicable: boolean | null;
};

export type EmployerVerificationDocument = {
  document_type: EmployerVerificationDocumentType;
  submission_id?: string | null;
};

export type ExistingEmployerVerification = EmployerVerificationSubmission & {
  status: EmployerVerificationStatus;
  materialChangeRequiresEvidence: boolean;
};

export type FreshEvidenceRequirements = {
  businessRecord: boolean;
  localPermit: boolean;
  representativeAuthorization: boolean;
};

const registeredBusinessTypes = new Set<EmployerBusinessType>([
  'sole_proprietorship',
  'partnership',
  'corporation',
  'cooperative',
  'nonprofit'
]);

export function requiredEvidenceTypes(
  businessType: EmployerBusinessType | '',
  representativeIsOwnerOrOfficer: boolean | null,
  localPermitApplicable: boolean | null
) {
  const required: EmployerVerificationDocumentType[] = [
    registeredBusinessTypes.has(businessType as EmployerBusinessType) ? 'business_registration' : 'other_evidence'
  ];
  if (localPermitApplicable === true) required.push('local_permit');
  if (representativeIsOwnerOrOfficer === false) required.push('representative_authorization');
  return required;
}

export function requiredFreshEvidence(current: ExistingEmployerVerification, next: EmployerVerificationSubmission): FreshEvidenceRequirements {
  const isApproved = current.status === 'approved';
  const businessRecord = current.materialChangeRequiresEvidence || (isApproved && (
    current.registeredBusinessName !== next.registeredBusinessName
    || current.tradingName !== next.tradingName
    || current.businessType !== next.businessType
    || current.registrationAuthority !== next.registrationAuthority
    || current.registrationNumber !== next.registrationNumber
    || current.businessAddress !== next.businessAddress
  ));
  return {
    businessRecord,
    localPermit: isApproved && current.localPermitApplicable === false && next.localPermitApplicable === true,
    representativeAuthorization: isApproved && (
      current.representativeName !== next.representativeName
      || current.representativeRole !== next.representativeRole
      || current.representativeIsOwnerOrOfficer !== next.representativeIsOwnerOrOfficer
    ) && next.representativeIsOwnerOrOfficer === false
  };
}

export function validateEmployerVerificationSubmission(
  value: EmployerVerificationSubmission,
  documents: EmployerVerificationDocument[],
  freshEvidence: FreshEvidenceRequirements = { businessRecord: false, localPermit: false, representativeAuthorization: false }
) {
  const errors: string[] = [];
  const required = (text: string) => text.trim().length > 0;

  if (!required(value.registeredBusinessName)) errors.push('Enter the registered business name.');
  if (!EMPLOYER_BUSINESS_TYPES.includes(value.businessType as EmployerBusinessType)) errors.push('Choose a business type.');
  if (!required(value.registrationAuthority)) errors.push('Enter the registration authority or official source.');
  if (registeredBusinessTypes.has(value.businessType as EmployerBusinessType) && !required(value.registrationNumber)) {
    errors.push('Enter the registration number for this business type.');
  }
  if (!required(value.businessAddress)) errors.push('Enter the business address.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contactEmail.trim())) errors.push('Enter a valid company contact email.');
  if (value.contactPhone.trim().length < 7) errors.push('Enter a company contact phone number.');
  if (value.website.trim() && !/^https?:\/\//i.test(value.website.trim())) errors.push('Website must begin with http:// or https://.');
  if (!required(value.representativeName)) errors.push('Enter the representative’s name.');
  if (!required(value.representativeRole)) errors.push('Enter the representative’s role.');
  if (typeof value.representativeIsOwnerOrOfficer !== 'boolean') errors.push('Indicate whether the representative is an owner or recorded officer.');
  if (typeof value.localPermitApplicable !== 'boolean') errors.push('Indicate whether a local permit applies.');

  const uploadedTypes = new Set(documents.map((document) => document.document_type));
  if (registeredBusinessTypes.has(value.businessType as EmployerBusinessType)) {
    if (!uploadedTypes.has('business_registration')) errors.push('Upload a business-registration record for this business type.');
  } else if (!uploadedTypes.has('business_registration') && !uploadedTypes.has('other_evidence')) {
    errors.push('Upload a relevant registration record or equivalent official-source evidence.');
  }
  if (value.localPermitApplicable === true && !uploadedTypes.has('local_permit')) errors.push('Upload the applicable local permit evidence.');
  if (value.representativeIsOwnerOrOfficer === false && !uploadedTypes.has('representative_authorization')) {
    errors.push('Upload evidence authorizing this representative.');
  }
  const newDocumentTypes = new Set(documents.filter((document) => !document.submission_id).map((document) => document.document_type));
  if (freshEvidence.businessRecord && !newDocumentTypes.has('business_registration') && !newDocumentTypes.has('other_evidence')) {
    errors.push('Upload fresh registration or official-source evidence for this material identity change.');
  }
  if (freshEvidence.localPermit && !newDocumentTypes.has('local_permit')) errors.push('Upload a current permit for this change.');
  if (freshEvidence.representativeAuthorization && !newDocumentTypes.has('representative_authorization')) {
    errors.push('Upload current representative-authorization evidence for this change.');
  }
  return errors;
}

export function canEmployerSubmitVerification(status: EmployerVerificationStatus) {
  return status === 'not_submitted' || status === 'needs_information' || status === 'rejected' || status === 'approved';
}

export function allowedAdminVerificationActions(status: EmployerVerificationStatus) {
  if (status === 'pending' || status === 'needs_information') {
    return ['approve', 'request_information', 'reject', 'suspend'] as const;
  }
  if (status === 'approved') return ['request_information', 'reject', 'suspend'] as const;
  if (status === 'suspended') return ['approve', 'request_information', 'reject'] as const;
  return [] as const;
}
