import express from 'express';
import authRoutes from './auth';

const router = express.Router();

// Mount sub-routers here
router.use('/auth', authRoutes);

export default router;
