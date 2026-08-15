const mongoose = require('mongoose');
const { Schema } = mongoose;

const defaultPermissions = {
  students: true,
  rooms: true,
  beds: true,
  payments: true,
  invoices: true,
  reports: true,
  notifications: true,
  activity: true,
  settings: true,
  export: true,
};

const UserSchema = new Schema(
  {
    name: String,
    username: { type: String, unique: true },
    phone: String,
    password: String,
    role: { type: String, default: 'admin' },
    permissions: { type: Object, default: () => ({ ...defaultPermissions }) },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const HousingSchema = new Schema(
  {
    name: String,
    address: String,
    phone: String,
    description: String,
    images: [String],
    services: [String],
    rules: [String],
    dueDay: { type: Number, default: 1 },
    currency: { type: String, default: 'EGP' },
  },
  { timestamps: true }
);

const RoomSchema = new Schema(
  {
    number: String,
    type: { type: String, default: 'shared' },
    capacity: { type: Number, default: 4 },
    monthlyRent: { type: Number, default: 0 },
    floor: String,
    status: { type: String, default: 'active' },
    beds: [{ bedNumber: Number, studentId: String, status: { type: String, default: 'available' } }],
    notes: String,
    propertyId: String,
    apartmentId: String,
    floorId: String,
  },
  { timestamps: true }
);

const PropertySchema = new Schema(
  {
    name: String,
    code: String,
    type: { type: String, enum: ['house', 'apartment'], default: 'house' },
    gender: { type: String, enum: ['', 'male', 'female'], default: '' },
    address: String,
    notes: String,
    status: { type: String, default: 'active' },
    floors: [{ _id: String, name: String, code: String, status: { type: String, default: 'active' }, sort: Number }],
    apartments: [{ _id: String, name: String, code: String, status: { type: String, default: 'active' }, monthlyRent: Number, floorId: String }],
    roomLinks: [{ _id: String, roomId: String, apartmentId: String, floorId: String }],
    maintenance: [{ _id: String, apartmentId: String, name: String, amount: Number, date: String, notes: String, by: String, createdAt: Date }],
  expenses: [{ _id: String, apartmentId: String, name: String, amount: Number, date: String, notes: String, by: String, createdAt: Date }],
  },
  { timestamps: true }
);

const StudentSchema = new Schema(
  {
    studentId: String,
    name: String,
    phone: { type: String, unique: true },
    university: String,
    email: String,
    roomId: String,
    bedNumber: Number,
    propertyId: String,
    monthlyRent: { type: Number, default: 0 },
    transfers: [Object],
    rentHistory: [Object],
    checkInDate: String,
    checkOutDate: String,
    status: { type: String, default: 'active' },
    privateNotes: [{ text: String, by: String, createdAt: Date }],
    notes: String,
    archivedAt: Date,
  },
  { timestamps: true }
);

const PaymentSchema = new Schema(
  {
    studentId: String,
    month: String,
    amount: { type: Number, default: 0 },
    dueDate: String,
    status: { type: String, default: 'unpaid' },
    paidAmount: { type: Number, default: 0 },
    proof: String,
    recordedBy: String,
    recordedByName: String,
    history: [{ at: Date, by: String, action: String }],
    overdueNotified: { type: Boolean, default: false },
    transactions: [
      {
        amount: { type: Number, default: 0 },
        date: { type: Date, default: Date.now },
        note: { type: String, default: '' },
        method: { type: String, default: 'cash' },
        by: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);
PaymentSchema.index({ studentId: 1, month: 1 }, { unique: true });

const InvoiceSchema = new Schema(
  {
    invoiceNumber: String,
    studentId: String,
    months: [String],
    items: [{ month: String, amount: Number, status: String }],
    total: Number,
    status: { type: String, default: 'unpaid' },
    pdfPath: String,
    createdBy: String,
    createdByName: String,
  },
  { timestamps: true }
);

const ActivityLogSchema = new Schema(
  {
    adminId: String,
    adminName: String,
    action: String,
    category: String,
    targetType: String,
    targetId: String,
    details: String,
  },
  { timestamps: true }
);

const NotificationSchema = new Schema(
  {
    type: String,
    title: String,
    message: String,
    data: Object,
    readBy: [String],
  },
  { timestamps: true }
);

const SummerCourseSchema = new Schema(
  {
    studentId: String,
    studentName: String,
    studentCode: String,
    roomId: String,
    bedNumber: Number,
    propertyId: String,
    propertyName: String,
    apartmentId: String,
    apartmentName: String,
    floorId: String,
    floorName: String,
    fromDate: String,
    toDate: String,
    rent: { type: Number, default: 0 },
    deposit: { type: Number, default: 0 },
    payments: [{ _id: String, amount: Number, date: String, method: String, note: String, by: String, createdAt: Date }],
    status: { type: String, default: 'active' },
    endedAt: Date,
  },
  { timestamps: true }
);

module.exports = {
  User: mongoose.model('User', UserSchema),
  Housing: mongoose.model('Housing', HousingSchema),
  Property: mongoose.model('Property', PropertySchema),
  Room: mongoose.model('Room', RoomSchema),
  Student: mongoose.model('Student', StudentSchema),
  Payment: mongoose.model('Payment', PaymentSchema),
  Invoice: mongoose.model('Invoice', InvoiceSchema),
  ActivityLog: mongoose.model('ActivityLog', ActivityLogSchema),
  Notification: mongoose.model('Notification', NotificationSchema),
  SummerCourse: mongoose.model('SummerCourse', SummerCourseSchema),
};
