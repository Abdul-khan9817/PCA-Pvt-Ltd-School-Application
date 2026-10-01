import { Router } from 'express';
import StaffAttendance from '../models/StaffAttendance.js';
import Staff from '../models/Staff.js';
import Leave from '../models/Leave.js';
import { protect, authorize } from '../middleware/auth.js';

const STATUSES = ['Present', 'Absent', 'Leave'];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isMonth = (s) => /^\d{4}-\d{2}$/.test(String(s || ''));

export function summarizeStaffAttendanceMonth(month, records = [], approvedLeaves = []) {
  const summary = new Map();
  const monthStart = new Date(`${month}-01T00:00:00Z`);
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  const addRecord = (staffId, date, status) => {
    const key = String(staffId);
    const current = summary.get(key) || { staffId: key, absentDays: 0, leaveDays: 0 };
    if (!current._days) current._days = new Set();
    current._days.add(date);

    if (status === 'Absent') current.absentDays += 1;
    if (status === 'Leave') current.leaveDays += 1;
    summary.set(key, current);
    return current;
  };

  for (const record of records || []) {
    const date = String(record?.date || '');
    if (!date.startsWith(`${month}-`)) continue;
    addRecord(record.staff, date, record.status);
  }

  for (const leave of approvedLeaves || []) {
    const staffId = leave?.staff ? String(leave.staff) : leave?.staffId ? String(leave.staffId) : null;
    if (!staffId) continue;

    const from = new Date(leave.from);
    const to = new Date(leave.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) continue;

    const startTime = Math.max(from.getTime(), monthStart.getTime());
    const endTime = Math.min(to.getTime(), monthEnd.getTime());
    for (let time = startTime; time <= endTime; time += 86400000) {
      const dateKey = new Date(time).toISOString().slice(0, 10);
      if (!dateKey.startsWith(`${month}-`)) continue;

      const current = summary.get(staffId) || { staffId, absentDays: 0, leaveDays: 0 };
      const alreadyMarked = current._days && current._days.has(dateKey);
      if (alreadyMarked) continue;

      current.leaveDays = (current.leaveDays || 0) + 1;
      if (!current._days) current._days = new Set();
      current._days.add(dateKey);
      summary.set(staffId, current);
    }
  }

  return [...summary.values()].map(({ _days, ...item }) => ({
    ...item,
    deductionDays: (item.absentDays || 0) + (item.leaveDays || 0),
  })).sort((a, b) => String(a.staffId).localeCompare(String(b.staffId)));
}

/**
 * GET /staff-attendance?date=YYYY-MM-DD      (admin, principal)
 * Every staff member with their status for that day (status = null if not marked yet).
 */
async function getByDate(req, res) {
  try {
    const { date } = req.query;
    if (!isDate(date)) return res.status(400).json({ message: 'date must be YYYY-MM-DD' });

    const [staff, records] = await Promise.all([
      Staff.find().populate('user', 'name email'),
      StaffAttendance.find({ date }),
    ]);
    const byStaff = new Map(records.map((r) => [String(r.staff), r]));

    const data = staff.map((s) => {
      const rec = byStaff.get(String(s._id));
      return {
        staffId: s._id,
        name: s.user?.name || 'Unknown',
        designation: s.designation || 'Staff',
        status: rec?.status || null,
        note: rec?.note || '',
      };
    });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /staff-attendance/bulk                (admin, principal)
 * body: { date: "YYYY-MM-DD", records: [{ staff, status, note? }] }
 * Creates or updates (upsert) one record per staff member.
 */
async function markBulk(req, res) {
  try {
    const { date, records } = req.body;
    if (!isDate(date)) return res.status(400).json({ message: 'date must be YYYY-MM-DD' });
    if (!Array.isArray(records) || !records.length)
      return res.status(400).json({ message: 'No records to save' });

    const ops = records
      .filter((r) => r.staff && STATUSES.includes(r.status))
      .map((r) => ({
        updateOne: {
          filter: { staff: r.staff, date },
          update: { $set: { status: r.status, note: r.note || '', markedBy: req.user._id } },
          upsert: true,
        },
      }));
    if (!ops.length) return res.status(400).json({ message: 'No valid records to save' });

    await StaffAttendance.bulkWrite(ops);
    res.json({ message: 'Attendance saved', count: ops.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /staff-attendance/my?month=YYYY-MM     (any logged-in staff, own data only)
 * Marked days + approved leaves that fall in the month (leave days not marked manually show as "Leave").
 */
async function getMine(req, res) {
  try {
    const { month } = req.query;
    if (!isMonth(month)) return res.status(400).json({ message: 'month must be YYYY-MM' });

    const staff = await Staff.findOne({ user: req.user._id });
    if (!staff) return res.status(404).json({ message: 'No staff record found for this account' });

    // "YYYY-MM-01" .. "YYYY-MM-31" compares correctly as a string for every month
    const records = await StaffAttendance.find({
      staff: staff._id,
      date: { $gte: `${month}-01`, $lte: `${month}-31` },
    });
    const days = new Map(records.map((r) => [r.date, { date: r.date, status: r.status, note: r.note }]));

    // Approved leaves show as yellow automatically
    const [y, m] = month.split('-').map(Number);
    const monthStart = Date.UTC(y, m - 1, 1);
    const monthEnd = Date.UTC(y, m, 0);
    const leaves = await Leave.find({
      user: req.user._id,
      status: 'Approved',
      from: { $lte: new Date(monthEnd + 86399999) },
      to: { $gte: new Date(monthStart) },
    });
    for (const l of leaves) {
      const from = Math.max(new Date(l.from).getTime(), monthStart);
      const to = Math.min(new Date(l.to).getTime(), monthEnd);
      for (let t = from; t <= to; t += 86400000) {
        const key = new Date(t).toISOString().slice(0, 10);
        if (!days.has(key)) days.set(key, { date: key, status: 'Leave', note: l.type || 'Approved leave' });
      }
    }

    res.json({ data: { month, days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getSummary(req, res) {
  try {
    const { month, staff } = req.query;
    if (!isMonth(month)) return res.status(400).json({ message: 'month must be YYYY-MM' });

    const query = { date: { $gte: `${month}-01`, $lte: `${month}-31` } };
    if (staff) query.staff = staff;

    const [records, leaveRecords] = await Promise.all([
      StaffAttendance.find(query).select('staff status date'),
      (async () => {
        const leaveFilter = {
          status: 'Approved',
          from: { $lte: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0, 23, 59, 59, 999)) },
          to: { $gte: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1, 0, 0, 0, 0)) },
        };

        if (staff) {
          const member = await Staff.findById(staff).select('user');
          if (!member) return [];
          return Leave.find({ ...leaveFilter, user: member.user }).select('user from to type').lean();
        }

        return Leave.find(leaveFilter).select('user from to type').lean();
      })(),
    ]);

    const staffByUser = new Map();
    if (records.length || leaveRecords.length) {
      const userIds = [...new Set(leaveRecords.map((leave) => String(leave.user)).filter(Boolean))];
      if (userIds.length) {
        const staffRecords = await Staff.find({ user: { $in: userIds } }).select('_id user');
        for (const member of staffRecords) {
          staffByUser.set(String(member.user), String(member._id));
        }
      }
    }

    const approvedLeaves = leaveRecords
      .map((leave) => {
        const mappedStaff = staffByUser.get(String(leave.user));
        return mappedStaff ? { staff: mappedStaff, from: leave.from, to: leave.to, type: leave.type } : null;
      })
      .filter(Boolean);

    const summary = summarizeStaffAttendanceMonth(month, records, approvedLeaves);
    res.json({ data: summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

const router = Router();
router.use(protect);
router.get('/my', authorize('admin', 'principal', 'vice_principal', 'teacher'), getMine);
router.get('/summary', authorize('admin', 'principal', 'vice_principal'), getSummary);
router.get('/', authorize('admin', 'principal', 'vice_principal'), getByDate);
router.post('/bulk', authorize('admin', 'principal', 'vice_principal'), markBulk);

export default router;