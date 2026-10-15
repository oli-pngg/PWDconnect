import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allowedAdminVerificationActions,
  canEmployerSubmitVerification,
  requiredFreshEvidence,
  validateEmployerVerificationSubmission,
  type EmployerVerificationSubmission
} from '../lib/employer-verification.ts';
import { detectEmployerVerificationContentType, employerVerificationFileExtension } from '../lib/employer-verification-file.ts';

const baseSubmission: EmployerVerificationSubmission = {
  registeredBusinessName: 'Example Trading Corporation',
  tradingName: 'Example Trading',
  businessType: 'corporation',
  registrationAuthority: 'Securities and Exchange Commission',
  registrationNumber: 'CS202612345',
  businessAddress: 'Legazpi City, Albay',
  contactEmail: 'contact@example.org',
  contactPhone: '+63 52 123 4567',
  website: '',
  representativeName: 'Alex Example',
  representativeRole: 'Owner',
  representativeIsOwnerOrOfficer: true,
  localPermitApplicable: false
};

test('registered business types need a relevant registration record', () => {
  const errors = validateEmployerVerificationSubmission(baseSubmission, []);
  assert.ok(errors.includes('Upload a business-registration record for this business type.'));
  assert.ok(!errors.includes('Enter the registration number for this business type.'));
});

test('government and other organizations can provide equivalent official-source evidence without a registration number', () => {
  const governmentSubmission = { ...baseSubmission, businessType: 'government' as const, registrationNumber: '' };
  const errors = validateEmployerVerificationSubmission(governmentSubmission, [{ document_type: 'other_evidence' }]);
  assert.deepEqual(errors, []);
});

test('conditional permit and representative documents are required when applicable', () => {
  const submission = { ...baseSubmission, localPermitApplicable: true, representativeIsOwnerOrOfficer: false };
  const errors = validateEmployerVerificationSubmission(submission, [{ document_type: 'business_registration' }]);
  assert.ok(errors.includes('Upload the applicable local permit evidence.'));
  assert.ok(errors.includes('Upload evidence authorizing this representative.'));
});

test('conditional declarations are not preselected when an employer starts the form', () => {
  const submission = { ...baseSubmission, representativeIsOwnerOrOfficer: null, localPermitApplicable: null };
  const errors = validateEmployerVerificationSubmission(submission, [{ document_type: 'business_registration' }]);
  assert.ok(errors.includes('Indicate whether the representative is an owner or recorded officer.'));
  assert.ok(errors.includes('Indicate whether a local permit applies.'));
});

test('verification upload signatures identify allowed formats and reject spoofed content', () => {
  assert.equal(detectEmployerVerificationContentType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), 'application/pdf');
  assert.equal(detectEmployerVerificationContentType(new Uint8Array([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg');
  assert.equal(detectEmployerVerificationContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(detectEmployerVerificationContentType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), 'image/webp');
  assert.equal(detectEmployerVerificationContentType(new Uint8Array([0x00, 0x01, 0x02])), null);
  assert.equal(employerVerificationFileExtension('image/webp'), 'webp');
});

test('employer resubmission and admin actions follow the documented state workflow', () => {
  assert.equal(canEmployerSubmitVerification('not_submitted'), true);
  assert.equal(canEmployerSubmitVerification('needs_information'), true);
  assert.equal(canEmployerSubmitVerification('rejected'), true);
  assert.equal(canEmployerSubmitVerification('pending'), false);
  assert.equal(canEmployerSubmitVerification('suspended'), false);
  assert.deepEqual(allowedAdminVerificationActions('pending'), ['approve', 'request_information', 'reject', 'suspend']);
  assert.deepEqual(allowedAdminVerificationActions('approved'), ['request_information', 'reject', 'suspend']);
  assert.deepEqual(allowedAdminVerificationActions('suspended'), ['approve', 'request_information', 'reject']);
  assert.deepEqual(allowedAdminVerificationActions('not_submitted'), []);
});

test('material identity and representative changes require fresh evidence', () => {
  const current = { ...baseSubmission, status: 'approved' as const, materialChangeRequiresEvidence: false };
  const next = { ...baseSubmission, registeredBusinessName: 'Example Trading Group Ltd.', representativeIsOwnerOrOfficer: false };
  assert.deepEqual(requiredFreshEvidence(current, next), {
    businessRecord: true,
    localPermit: false,
    representativeAuthorization: true
  });
});
