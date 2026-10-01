import mongoose from 'mongoose';
const schema=new mongoose.Schema({name:{type:String,required:true},section:String,gradeLevel:String,gradeLevelOrder:Number,academicYear:String,classTeacher:{type:mongoose.Schema.Types.ObjectId,ref:'User'},subjectTeacher:String,capacity:{type:Number,min:10,max:100,default:100},room:String,shiftName:String,shiftStart:String,shiftEnd:String,status:{type:String,default:'active'}},{timestamps:true});

const getGradeOrder = data => {
	const source = String(data.gradeLevel || data.name || '');
 const level = source.toLowerCase();
 if (level.includes('nursery')) return 0;
 if (level.includes('lkg')) return 1;
 if (level.includes('ukg')) return 2;
	const match = source.match(/\d+/);
 return match ? Number(match[0]) + 3 : 999;
};

const getGradeLevel = data => {
  if (data.gradeLevel && String(data.gradeLevel).trim()) return String(data.gradeLevel).trim();
  const source = String(data.name || '');
  const level = source.toLowerCase();
  if (level.includes('nursery')) return 'Nursery';
  if (level.includes('lkg')) return 'LKG';
  if (level.includes('ukg')) return 'UKG';
  const match = source.match(/\d+/);
  return match ? match[0] : source.trim();
};

schema.pre('validate', function(next) {
	if (!this.gradeLevel) this.gradeLevel = getGradeLevel(this);
	this.gradeLevelOrder = getGradeOrder(this);
	next();
});

schema.pre('findOneAndUpdate', function(next) {
	const update = this.getUpdate() || {};
	const data = update.$set || update;
	if (data.name !== undefined && !data.gradeLevel) {
		data.gradeLevel = getGradeLevel(data);
		if (update.$set) update.$set.gradeLevel = data.gradeLevel;
		else update.gradeLevel = data.gradeLevel;
	}
	if (data.gradeLevel !== undefined || data.name !== undefined) {
		data.gradeLevelOrder = getGradeOrder(data);
		if (update.$set) update.$set.gradeLevelOrder = data.gradeLevelOrder;
		else update.gradeLevelOrder = data.gradeLevelOrder;
	}
	next();
});
export default mongoose.model('Class',schema);
