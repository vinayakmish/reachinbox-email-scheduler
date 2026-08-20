import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Override for test environment
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
