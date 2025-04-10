import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import messageRoutes from './routes/messageRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/messages', messageRoutes);

// Health check endpoint
// app.get('/health', (req, res) => {
//   res.status(200).send('Server is healthy');
// });

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
