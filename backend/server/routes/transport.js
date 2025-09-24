import express from 'express';
import { body, validationResult } from 'express-validator';
import { TransportRoute, Vehicle, Driver, StudentTransport } from '../models/Transport.js';
import Student from '../models/Student.js';
import { generateId } from '../utils/helpers.js';

const router = express.Router();

// ROUTE MANAGEMENT

// Get all transport routes
router.get('/routes', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      filter.$or = [
        { routeName: { $regex: req.query.search, $options: 'i' } },
        { routeNumber: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const routes = await TransportRoute.find(filter)
      .sort({ routeNumber: 1 })
      .skip(skip)
      .limit(limit);

    const total = await TransportRoute.countDocuments(filter);

    res.json({
      success: true,
      data: routes,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching transport routes',
      error: error.message
    });
  }
});

// Create transport route
router.post('/routes', [
  body('routeName').trim().isLength({ min: 2 }).withMessage('Route name is required'),
  body('routeNumber').trim().isLength({ min: 1 }).withMessage('Route number is required'),
  body('startLocation.name').trim().isLength({ min: 2 }).withMessage('Start location is required'),
  body('endLocation.name').trim().isLength({ min: 2 }).withMessage('End location is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if route number already exists
    const existingRoute = await TransportRoute.findOne({ routeNumber: req.body.routeNumber });
    if (existingRoute) {
      return res.status(400).json({
        success: false,
        message: 'Route number already exists'
      });
    }

    const routeData = {
      ...req.body,
      routeId: generateId('RT')
    };

    const route = new TransportRoute(routeData);
    await route.save();

    res.status(201).json({
      success: true,
      message: 'Transport route created successfully',
      data: route
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating transport route',
      error: error.message
    });
  }
});

// Update transport route
router.put('/routes/:id', async (req, res) => {
  try {
    const route = await TransportRoute.findById(req.params.id);
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Transport route not found'
      });
    }

    Object.assign(route, req.body);
    await route.save();

    res.json({
      success: true,
      message: 'Transport route updated successfully',
      data: route
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating transport route',
      error: error.message
    });
  }
});

// VEHICLE MANAGEMENT

// Get all vehicles
router.get('/vehicles', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.vehicleType) filter.vehicleType = req.query.vehicleType;
    if (req.query.search) {
      filter.$or = [
        { registrationNumber: { $regex: req.query.search, $options: 'i' } },
        { make: { $regex: req.query.search, $options: 'i' } },
        { model: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const vehicles = await Vehicle.find(filter)
      .populate('assignedRoute', 'routeName routeNumber')
      .populate('driver', 'name phone')
      .populate('conductor', 'name phone')
      .sort({ registrationNumber: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Vehicle.countDocuments(filter);

    res.json({
      success: true,
      data: vehicles,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching vehicles',
      error: error.message
    });
  }
});

// Create vehicle
router.post('/vehicles', [
  body('registrationNumber').trim().isLength({ min: 3 }).withMessage('Registration number is required'),
  body('vehicleType').isIn(['bus', 'van', 'car', 'mini-bus']).withMessage('Valid vehicle type is required'),
  body('make').trim().isLength({ min: 2 }).withMessage('Vehicle make is required'),
  body('model').trim().isLength({ min: 2 }).withMessage('Vehicle model is required'),
  body('capacity.seating').isInt({ min: 1 }).withMessage('Seating capacity must be at least 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if registration number already exists
    const existingVehicle = await Vehicle.findOne({ 
      registrationNumber: req.body.registrationNumber.toUpperCase() 
    });
    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle with this registration number already exists'
      });
    }

    const vehicleData = {
      ...req.body,
      vehicleId: generateId('VH'),
      registrationNumber: req.body.registrationNumber.toUpperCase()
    };

    const vehicle = new Vehicle(vehicleData);
    await vehicle.save();

    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully',
      data: vehicle
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating vehicle',
      error: error.message
    });
  }
});

// DRIVER MANAGEMENT

// Get all drivers
router.get('/drivers', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.role) filter.role = req.query.role;
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } },
        { 'license.number': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const drivers = await Driver.find(filter)
      .populate('assignedVehicles', 'registrationNumber vehicleType')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Driver.countDocuments(filter);

    res.json({
      success: true,
      data: drivers,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching drivers',
      error: error.message
    });
  }
});

// Create driver
router.post('/drivers', [
  body('name').trim().isLength({ min: 2 }).withMessage('Driver name is required'),
  body('phone').isMobilePhone().withMessage('Valid phone number is required'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('license.number').trim().isLength({ min: 5 }).withMessage('License number is required'),
  body('license.type').trim().isLength({ min: 2 }).withMessage('License type is required'),
  body('license.expiryDate').isISO8601().withMessage('Valid license expiry date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if license number already exists
    const existingDriver = await Driver.findOne({ 
      'license.number': req.body.license.number 
    });
    if (existingDriver) {
      return res.status(400).json({
        success: false,
        message: 'Driver with this license number already exists'
      });
    }

    const driverData = {
      ...req.body,
      driverId: generateId('DR')
    };

    const driver = new Driver(driverData);
    await driver.save();

    res.status(201).json({
      success: true,
      message: 'Driver created successfully',
      data: driver
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating driver',
      error: error.message
    });
  }
});

// STUDENT TRANSPORT MANAGEMENT

// Get student transport assignments
router.get('/student-assignments', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.route) filter.route = req.query.route;

    const assignments = await StudentTransport.find(filter)
      .populate('student', 'name studentId class section')
      .populate('route', 'routeName routeNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await StudentTransport.countDocuments(filter);

    res.json({
      success: true,
      data: assignments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching student transport assignments',
      error: error.message
    });
  }
});

// Assign student to transport
router.post('/assign-student', [
  body('student').isMongoId().withMessage('Valid student ID is required'),
  body('route').isMongoId().withMessage('Valid route ID is required'),
  body('pickupStop').trim().isLength({ min: 2 }).withMessage('Pickup stop is required'),
  body('dropStop').trim().isLength({ min: 2 }).withMessage('Drop stop is required'),
  body('monthlyFee').isNumeric().withMessage('Valid monthly fee is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if student exists
    const student = await Student.findById(req.body.student);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if route exists
    const route = await TransportRoute.findById(req.body.route);
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Transport route not found'
      });
    }

    // Check if student is already assigned to transport
    const existingAssignment = await StudentTransport.findOne({
      student: req.body.student,
      status: 'active'
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Student is already assigned to transport'
      });
    }

    const assignment = new StudentTransport(req.body);
    await assignment.save();

    await assignment.populate('student', 'name studentId class section');
    await assignment.populate('route', 'routeName routeNumber');

    res.status(201).json({
      success: true,
      message: 'Student assigned to transport successfully',
      data: assignment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning student to transport',
      error: error.message
    });
  }
});

// Get transport statistics
router.get('/statistics', async (req, res) => {
  try {
    const totalRoutes = await TransportRoute.countDocuments({ status: 'active' });
    const totalVehicles = await Vehicle.countDocuments({ status: 'active' });
    const totalDrivers = await Driver.countDocuments({ status: 'active' });
    const totalStudents = await StudentTransport.countDocuments({ status: 'active' });

    const vehiclesByType = await Vehicle.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$vehicleType', count: { $sum: 1 } } }
    ]);

    const studentsByRoute = await StudentTransport.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$route', count: { $sum: 1 } } },
      { $lookup: { from: 'transportroutes', localField: '_id', foreignField: '_id', as: 'route' } },
      { $unwind: '$route' },
      { $project: { routeName: '$route.routeName', count: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalRoutes,
        totalVehicles,
        totalDrivers,
        totalStudents,
        vehiclesByType,
        studentsByRoute
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching transport statistics',
      error: error.message
    });
  }
});

export default router;