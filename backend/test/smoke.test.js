import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_ACCESS_SECRET ||= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret';

test('staff attendance router exports an Express router', async () => {
  const { default: router } = await import('../src/routes/staffAttendance.routes.js');
  assert.equal(typeof router, 'function');
});

test('access tokens round-trip the authenticated user identity', async () => {
  const { signAccessToken, verifyAccessToken } = await import('../src/utils/tokens.js');
  const token = signAccessToken({ _id: '507f1f77bcf86cd799439011', role: 'teacher', email: 'teacher@example.com' });
  const payload = verifyAccessToken(token);
  assert.equal(payload.sub, '507f1f77bcf86cd799439011');
  assert.equal(payload.role, 'teacher');
});

test('mail service loads without SMTP configuration', async () => {
  const mail = await import('../src/services/mail.service.js');
  assert.equal(await mail.sendPasswordResetOtp({ to: 'test@example.com', name: 'Test', otp: '123456' }), false);
});

test('staff attendance summary counts approved leave days as leave deductions', async () => {
  const { summarizeStaffAttendanceMonth } = await import('../src/routes/staffAttendance.routes.js');
  const summary = summarizeStaffAttendanceMonth('2026-10', [
    { staff: 'staff-1', status: 'Present', date: '2026-10-01' },
    { staff: 'staff-1', status: 'Absent', date: '2026-10-02' },
    { staff: 'staff-2', status: 'Leave', date: '2026-10-02' },
  ], [
    { staff: 'staff-1', from: new Date('2026-10-04T00:00:00Z'), to: new Date('2026-10-05T00:00:00Z'), type: 'Sick' },
    { staff: 'staff-2', from: new Date('2026-10-06T00:00:00Z'), to: new Date('2026-10-06T00:00:00Z'), type: 'Annual' },
  ]);

  assert.deepEqual(summary, [
    { staffId: 'staff-1', absentDays: 1, leaveDays: 2, deductionDays: 3 },
    { staffId: 'staff-2', absentDays: 0, leaveDays: 2, deductionDays: 2 },
  ]);
});

test('linked profile sync preserves address for student and staff records', async () => {
  const { getLinkedProfileSync } = await import('../src/controllers/user.controller.js');

  assert.deepEqual(
    getLinkedProfileSync('student', { address: '12 Main St', village: 'Lakeview', status: 'active' }),
    { address: '12 Main St', village: 'Lakeview', status: 'active' }
  );

  assert.deepEqual(
    getLinkedProfileSync('teacher', { address: '9 Hall Rd', village: 'North', designation: 'Teacher' }),
    { address: '9 Hall Rd', village: 'North', designation: 'Teacher' }
  );
});