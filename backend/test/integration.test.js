import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
import Class from '../src/models/Class.js';
import Subject from '../src/models/Subject.js';
import Leave from '../src/models/Leave.js';
import { getTeacherAccess } from '../src/services/teacherAccess.service.js';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'integration-access-secret';
process.env.JWT_REFRESH_SECRET = 'integration-refresh-secret';

const { app } = await import('../src/server.js');

let mongo;
let httpServer;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  httpServer = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Class.deleteMany({}),
    Subject.deleteMany({}),
    Leave.deleteMany({}),
  ]);
});

after(async () => {
  await new Promise((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});

test('HTTP health and protected class routes enforce authentication', async () => {
  const baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');

  const denied = await fetch(`${baseUrl}/api/classes`);
  assert.equal(denied.status, 401);

  await User.create({
    name: 'HTTP Admin',
    email: 'http-admin@example.com',
    passwordHash: await bcrypt.hash('Password@123', 4),
    role: 'admin',
  });
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'http-admin@example.com', password: 'Password@123' }),
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  assert.ok(loginBody.data.accessToken);

  const classes = await fetch(`${baseUrl}/api/classes`, {
    headers: { authorization: `Bearer ${loginBody.data.accessToken}` },
  });
  assert.equal(classes.status, 200);
  assert.deepEqual((await classes.json()).data, []);
});

test('HTTP admin fee CRUD enforces role and persists records', async () => {
  const baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
  const student = await User.create({
    name: 'HTTP Student',
    email: 'http-student@example.com',
    passwordHash: await bcrypt.hash('Password@123', 4),
    role: 'student',
  });
  const admin = await User.create({
    name: 'Fee Admin',
    email: 'fee-admin@example.com',
    passwordHash: await bcrypt.hash('Password@123', 4),
    role: 'admin',
  });

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: admin.email, password: 'Password@123' }),
  });
  const { data: loginData } = await login.json();
  const auth = { authorization: `Bearer ${loginData.accessToken}` };
  const payload = {
    student: student._id,
    type: 'Tuition',
    month: 'October 2026',
    amount: 1200,
    paid: 200,
    status: 'Partial',
  };

  const created = await fetch(`${baseUrl}/api/fees`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  const feeId = createdBody.data._id;

  const listed = await fetch(`${baseUrl}/api/fees?student=${student._id}`, { headers: auth });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).meta.total, 1);

  const updated = await fetch(`${baseUrl}/api/fees/${feeId}`, {
    method: 'PATCH',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ paid: 1200, status: 'Paid' }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).data.status, 'Paid');

  const studentLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: student.email, password: 'Password@123' }),
  });
  const { data: studentLoginData } = await studentLogin.json();
  const studentFees = await fetch(`${baseUrl}/api/fees`, {
    headers: { authorization: `Bearer ${studentLoginData.accessToken}` },
  });
  assert.equal(studentFees.status, 200);
  assert.deepEqual((await studentFees.json()).data, []);

  const removed = await fetch(`${baseUrl}/api/fees/${feeId}`, { method: 'DELETE', headers: auth });
  assert.equal(removed.status, 200);
  const missing = await fetch(`${baseUrl}/api/fees/${feeId}`, { headers: auth });
  assert.equal(missing.status, 404);
});

test('teacher access resolves live class and subject assignments', async () => {
  const teacher = await User.create({
    name: 'Integration Teacher',
    email: 'integration-teacher@example.com',
    passwordHash: 'hashed-password',
    role: 'teacher',
  });
  const classTeacherClass = await Class.create({ name: 'Class 5', classTeacher: teacher._id });
  const subjectClass = await Class.create({ name: 'Class 6' });
  const subject = await Subject.create({ name: 'Science', teacherIds: [teacher._id], classIds: [subjectClass._id] });

  const access = await getTeacherAccess(teacher._id);

  assert.deepEqual(new Set(access.classIds), new Set([String(classTeacherClass._id), String(subjectClass._id)]));
  assert.deepEqual(access.subjectIds, [String(subject._id)]);
});

test('leave records remain queryable by their owning user', async () => {
  const [owner, other] = await User.create([
    { name: 'Owner', email: 'owner@example.com', passwordHash: 'hash', role: 'teacher' },
    { name: 'Other', email: 'other@example.com', passwordHash: 'hash', role: 'teacher' },
  ]);
  await Leave.create([
    { user: owner._id, type: 'Sick', from: new Date(), to: new Date() },
    { user: other._id, type: 'Annual', from: new Date(), to: new Date() },
  ]);

  const ownerLeaves = await Leave.find({ user: owner._id }).lean();
  assert.equal(ownerLeaves.length, 1);
  assert.equal(String(ownerLeaves[0].user), String(owner._id));
});