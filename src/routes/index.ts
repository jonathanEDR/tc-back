import express from 'express';
import authRoutes from './auth';
import cajaRoutes from './caja';
import userRoutes from './users';

const router = express.Router();

// Mount sub-routers here
router.use('/auth', authRoutes);
router.use('/caja', cajaRoutes);
router.use('/users', userRoutes);

export default router;
