import mongoose from 'mongoose';
import 'dotenv/config';

export const connectMongoDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(` Conectado a MongoDB exitosamente: ${conn.connection.host}`);
  } catch (error) {
    console.error(' Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

export default mongoose;