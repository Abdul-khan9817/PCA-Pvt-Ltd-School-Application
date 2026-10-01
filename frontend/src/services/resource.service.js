import { api } from './apiClient.js';
export const endpoints={students:'/students',studentSummary:'/students/summary',staff:'/staff',classes:'/classes',subjects:'/subjects',attendance:'/attendance',grades:'/grades',fees:'/fees',payroll:'/payroll',leaves:'/leaves',assignments:'/assignments',timetable:'/timetable',announcements:'/announcements',exams:'/exams',messages:'/messages',notifications:'/notifications',users:'/users',reports:'/reports'};
export const list=(resource,query='')=>api.get(`${endpoints[resource]}${query?`?${query}`:''}`);
export const getOne=(resource,id)=>api.get(`${endpoints[resource]}/${id}`);
export const create=(resource,body)=>api.post(endpoints[resource],body);
export const update=(resource,id,body)=>api.patch(`${endpoints[resource]}/${id}`,body);
export const remove=(resource,id)=>api.delete(`${endpoints[resource]}/${id}`);
