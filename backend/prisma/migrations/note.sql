-- Manually generated initial migration for connect-pg-simple
-- This is only needed if you want connect-pg-simple sessions tracked in your Prisma schema.
-- The connect-pg-simple library creates its own 'user_sessions' table automatically.
-- This file is kept as reference only.

-- The actual tables are created by:
-- 1. `prisma migrate deploy` → User, Sender, EmailCampaign, EmailJob tables
-- 2. connect-pg-simple `createTableIfMissing: true` → user_sessions table

SELECT 'Prisma migrations handle all schema creation' as info;
