import express from 'express';
import authRoutes from './auth';
import cajaRoutes from './caja';

const router = express.Router();

// Mount sub-routers here
router.use('/auth', authRoutes);
router.use('/caja', cajaRoutes);

export default router;
