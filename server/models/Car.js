import mongoose from 'mongoose';

const carSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
  pricePerDay: { type: Number, required: true },
  category: { type: String, enum: ['Sedan', 'SUV', 'Hatchback', 'Van', 'Truck', 'Coupe', 'Motorcycle'] },
  transmission: { type: String, enum: ['Automatic', 'Manual', 'Semi-Automatic'] },
  fuelType: { type: String, enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid'] },
  seats: { type: Number, required: true },
  availableBookingTypes: { type: [String], enum: ['self-drive', 'with-driver'], default: ['self-drive', 'with-driver'] },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  imageFileId: { type: String, default: '' },
  isAvailable: { type: Boolean, default: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

export default mongoose.model('Car', carSchema);