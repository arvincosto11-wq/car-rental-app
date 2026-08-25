import mongoose from 'mongoose';

const consignmentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending' },
  adminNotes: { type: String, default: '' },

  // Vehicle details
  brand: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
  plateNumber: { type: String, required: true },
  color: { type: String, default: '' },
  mileage: { type: Number },
  category: { type: String, enum: ['Sedan', 'SUV', 'Hatchback', 'Van', 'Truck', 'Coupe', 'Motorcycle'] },
  transmission: { type: String, enum: ['Automatic', 'Manual', 'Semi-Automatic'] },
  fuelType: { type: String, enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid'] },
  seats: { type: Number, required: true },
  location: { type: String, required: true },
  availableBookingTypes: { type: [String], enum: ['self-drive', 'with-driver'], default: ['self-drive', 'with-driver'] },
  suggestedPricePerDay: { type: Number, required: true },
  description: { type: String, default: '' },

  // Vehicle documents
  orImage: { type: String, default: '' },
  orImageFileId: { type: String, default: '' },
  crImage: { type: String, default: '' },
  crImageFileId: { type: String, default: '' },
  vehiclePhotos: [{ url: String, fileId: String }],

  // Set once approved and a live Car listing is created from this application
  linkedCar: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', default: null },
}, { timestamps: true });

export default mongoose.model('Consignment', consignmentSchema);
