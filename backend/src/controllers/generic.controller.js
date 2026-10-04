import Class from '../models/Class.js';
import Student from '../models/Student.js';
import { broadcast } from '../utils/realtime.js';

function cleanPayload(body, schema) {
  if (!body || typeof body !== 'object') return body;

  const data = { ...body };

  // Omit blank optional unique fields so MongoDB does not index duplicate empty strings.
  if (
    schema?.path('employeeId') &&
    typeof data.employeeId === 'string' &&
    !data.employeeId.trim()
  ) {
    delete data.employeeId;
  }

  if (!schema) return data;

  for (const [key, val] of Object.entries(data)) {
    if (val === '' || val === null || val === undefined) {
      const pathType = schema.path(key);

      if (pathType && pathType.instance !== 'String') {
        delete data[key];
      }
    }
  }

  return data;
}

async function enforceClassCapacity(payload, currentId) {
  if (!payload.classId) return;

  const classDoc = await Class.findById(payload.classId).select('capacity');

  if (!classDoc) {
    throw new Error('Selected class does not exist');
  }

  const query = {
    classId: payload.classId,
    status: 'active',
  };

  if (currentId) {
    query._id = { $ne: currentId };
  }

  const enrolled = await Student.countDocuments(query);

  if (enrolled >= (classDoc.capacity || 100)) {
    throw new Error(
      `This class section is full. Capacity is ${classDoc.capacity || 100} students.`
    );
  }
}

export const makeCrud = (
  Model,
  {
    populate = [],
    searchFields = [],
    filterFields = [],
    sort = '-createdAt',
    resource = '',
    enforceCapacity = false,
    scope,
    afterSave,
    validate,
  } = {}
) => {
  const resourceName =
    resource ||
    (Model.modelName ? `${Model.modelName.toLowerCase()}s` : 'resource');

  return {
    list: async (req, res) => {
      const q = {};

      if (req.query.q && searchFields.length) {
        q.$or = searchFields.map((f) => ({
          [f]: new RegExp(
            String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'i'
          ),
        }));
      }

      for (const f of filterFields) {
        if (req.query[f] !== undefined) {
          q[f] = req.query[f];
        }
      }

      if (req.query.status) {
        q.status = req.query.status;
      }

      if (scope) {
        await scope(req, q);
      }

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(
        5000,
        Math.max(1, Number(req.query.limit) || 20)
      );

      let query = Model.find(q)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit);

      for (const p of populate) {
        query = query.populate(p);
      }

      const [data, total] = await Promise.all([
        query,
        Model.countDocuments(q),
      ]);

      res.json({
        success: true,
        data,
        meta: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    },

    get: async (req, res) => {
      const q = { _id: req.params.id };

      if (scope) {
        await scope(req, q);
      }

      let query = Model.findOne(q);

      for (const p of populate) {
        query = query.populate(p);
      }

      const data = await query;

      if (!data) {
        return res.status(404).json({
          success: false,
          message: 'Record not found',
        });
      }

      res.json({
        success: true,
        data,
      });
    },

    create: async (req, res) => {
      try {
        const payload = cleanPayload(req.body, Model.schema);

        if (enforceCapacity) {
          await enforceClassCapacity(payload);
        }

        if (validate) {
          await validate(payload);
        }

        // Student and Staff profiles are one-to-one with a User.  Their
        // account-creation flows may create the linked profile before the
        // explicit resource POST arrives, so make that POST idempotent.
        const hasUserLink = Boolean(
          ['Student', 'Staff'].includes(Model.modelName) && payload.user
        );
        const created = hasUserLink
          ? await Model.findOneAndUpdate(
              { user: payload.user },
              { $set: payload },
              { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
            )
          : await Model.create(payload);

        // Run optional post-save hook after creating the document.
        if (afterSave) {
          await afterSave(created, req, null);
        }

        // Re-fetch with full population so socket event carries embedded user/class data (name, email etc.)
        let findQ = Model.findById(created._id);

        for (const p of populate) {
          findQ = findQ.populate(p);
        }

        const data = await findQ;

        broadcast(req, 'resource:change', {
          resource: resourceName,
          action: 'create',
          data,
        });

        broadcast(req, `${resourceName}:created`, data);

        res.status(201).json({
          success: true,
          data,
        });
      } catch (e) {
        res.status(400).json({
          success: false,
          message: e.message || 'Create failed',
        });
      }
    },

    update: async (req, res) => {
      try {
        const payload = cleanPayload(req.body, Model.schema);

        if (enforceCapacity) {
          await enforceClassCapacity(payload, req.params.id);
        }

        if (validate) {
          const current = await Model.findById(req.params.id).lean();
          if (!current) {
            return res.status(404).json({ success: false, message: 'Record not found' });
          }
          await validate({ ...current, ...payload }, req.params.id);
        }

        // Keep prior assignment fields so afterSave can sync Staff links.
        const previous = await Model.findById(req.params.id).select(
          'classTeacher teacherIds classIds'
        );

        let updated = await Model.findByIdAndUpdate(
          req.params.id,
          payload,
          {
            new: true,
            runValidators: true,
          }
        );

        if (!updated) {
          return res.status(404).json({
            success: false,
            message: 'Record not found',
          });
        }

        // Run optional post-save hook after updating the document.
        if (afterSave) {
          await afterSave(updated, req, previous);
        }

        // Re-fetch with full population so socket event carries embedded data
        let findQ = Model.findById(updated._id);

        for (const p of populate) {
          findQ = findQ.populate(p);
        }

        const data = await findQ;

        broadcast(req, 'resource:change', {
          resource: resourceName,
          action: 'update',
          id: req.params.id,
          data,
        });

        broadcast(req, `${resourceName}:updated`, data);

        res.json({
          success: true,
          data,
        });
      } catch (e) {
        res.status(400).json({
          success: false,
          message: e.message || 'Update failed',
        });
      }
    },

    remove: async (req, res) => {
      try {
        // Fetch populated doc before deleting so socket event has full data
        let findQ = Model.findById(req.params.id);

        for (const p of populate) {
          findQ = findQ.populate(p);
        }

        const data = await findQ;

        if (!data) {
          return res.status(404).json({
            success: false,
            message: 'Record not found',
          });
        }

        await Model.findByIdAndDelete(req.params.id);

        broadcast(req, 'resource:change', {
          resource: resourceName,
          action: 'delete',
          id: req.params.id,
          data,
        });

        broadcast(req, `${resourceName}:deleted`, {
          id: req.params.id,
          data,
        });

        res.json({
          success: true,
          message: 'Deleted successfully',
        });
      } catch (e) {
        res.status(400).json({
          success: false,
          message: e.message || 'Delete failed',
        });
      }
    },
  };
};
