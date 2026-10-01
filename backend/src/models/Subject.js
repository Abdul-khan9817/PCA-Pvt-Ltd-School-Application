import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    classIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
      },
    ],

    teacherIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    subjectTeacher: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      default: "",
    },

    // Term-wise marks
    firstTerm: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    secondTerm: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    thirdTerm: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    final: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    status: {
      type: String,
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Subject", schema);






























