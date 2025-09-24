import mongoose from 'mongoose';

const transportRouteSchema = new mongoose.Schema({
  routeId: {
    type: String,
    required: true,
    unique: true
  },
  routeName: {
    type: String,
    required: true,
    trim: true
  },
  routeNumber: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  startLocation: {
    name: { type: String, required: true },
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  endLocation: {
    name: { type: String, required: true },
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  stops: [{
    stopId: String,
    name: { type: String, required: true },
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    arrivalTime: String,
    departureTime: String,
    sequence: { type: Number, required: true },
    isActive: { type: Boolean, default: true }
  }],
  distance: {
    type: Number,
    min: 0
  },
  estimatedDuration: {
    type: Number,
    min: 0
  },
  operatingDays: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }],
  shifts: [{
    name: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    type: { type: String, enum: ['pickup', 'drop'], required: true }
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'suspended'],
    default: 'active'
  }
}, {
  timestamps: true
});

const vehicleSchema = new mongoose.Schema({
  vehicleId: {
    type: String,
    required: true,
    unique: true
  },
  registrationNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  vehicleType: {
    type: String,
    enum: ['bus', 'van', 'car', 'mini-bus'],
    required: true
  },
  make: {
    type: String,
    required: true
  },
  model: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    min: 1990,
    max: new Date().getFullYear() + 1
  },
  capacity: {
    seating: { type: Number, required: true, min: 1 },
    standing: { type: Number, default: 0, min: 0 }
  },
  features: {
    airConditioned: { type: Boolean, default: false },
    gpsTracking: { type: Boolean, default: false },
    cctv: { type: Boolean, default: false },
    firstAid: { type: Boolean, default: false },
    fireExtinguisher: { type: Boolean, default: false },
    emergencyExit: { type: Boolean, default: false }
  },
  insurance: {
    provider: String,
    policyNumber: String,
    expiryDate: Date,
    coverage: String
  },
  maintenance: {
    lastService: Date,
    nextService: Date,
    mileage: { type: Number, default: 0 },
    fuelType: { type: String, enum: ['petrol', 'diesel', 'cng', 'electric'] },
    averageMileage: Number
  },
  documents: {
    registration: {
      number: String,
      expiryDate: Date,
      documentUrl: String
    },
    permit: {
      number: String,
      expiryDate: Date,
      documentUrl: String
    },
    fitness: {
      certificateNumber: String,
      expiryDate: Date,
      documentUrl: String
    },
    pollution: {
      certificateNumber: String,
      expiryDate: Date,
      documentUrl: String
    }
  },
  assignedRoute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransportRoute'
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  conductor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'repair', 'retired'],
    default: 'active'
  }
}, {
  timestamps: true
});

const driverSchema = new mongoose.Schema({
  driverId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  alternatePhone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'USA' }
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  joiningDate: {
    type: Date,
    default: Date.now
  },
  experience: {
    type: Number,
    min: 0,
    default: 0
  },
  license: {
    number: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    issueDate: Date,
    expiryDate: { type: Date, required: true },
    issuingAuthority: String,
    documentUrl: String
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  medicalCertificate: {
    certificateNumber: String,
    issueDate: Date,
    expiryDate: Date,
    issuingDoctor: String,
    documentUrl: String
  },
  backgroundCheck: {
    verified: { type: Boolean, default: false },
    verificationDate: Date,
    verifiedBy: String,
    notes: String
  },
  salary: {
    basic: Number,
    allowances: Number,
    total: Number
  },
  role: {
    type: String,
    enum: ['driver', 'conductor', 'both'],
    default: 'driver'
  },
  assignedVehicles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'on-leave', 'suspended', 'terminated'],
    default: 'active'
  },
  profileImage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

const studentTransportSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransportRoute',
    required: true
  },
  pickupStop: {
    type: String,
    required: true
  },
  dropStop: {
    type: String,
    required: true
  },
  shift: {
    type: String,
    enum: ['morning', 'afternoon', 'both'],
    default: 'both'
  },
  monthlyFee: {
    type: Number,
    required: true,
    min: 0
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'cancelled'],
    default: 'active'
  },
  parentContact: {
    primary: String,
    secondary: String
  },
  specialInstructions: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
transportRouteSchema.index({ routeId: 1 });
transportRouteSchema.index({ routeNumber: 1 });
transportRouteSchema.index({ status: 1 });

vehicleSchema.index({ vehicleId: 1 });
vehicleSchema.index({ registrationNumber: 1 });
vehicleSchema.index({ assignedRoute: 1 });
vehicleSchema.index({ driver: 1 });
vehicleSchema.index({ status: 1 });

driverSchema.index({ driverId: 1 });
driverSchema.index({ 'license.number': 1 });
driverSchema.index({ phone: 1 });
driverSchema.index({ status: 1 });

studentTransportSchema.index({ student: 1 });
studentTransportSchema.index({ route: 1 });
studentTransportSchema.index({ status: 1 });

export const TransportRoute = mongoose.model('TransportRoute', transportRouteSchema);
export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export const Driver = mongoose.model('Driver', driverSchema);
export const StudentTransport = mongoose.model('StudentTransport', studentTransportSchema);