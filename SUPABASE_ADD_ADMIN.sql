-- Migration: Add admin role support
-- This migration updates the users table to support admin role checking

-- Update the first user to be an admin (or create one if none exists)
-- Replace 'admin@example.com' with your actual admin email
DO $$
BEGIN
  -- Check if any users exist
  IF EXISTS (SELECT 1 FROM users LIMIT 1) THEN
    -- Update the first user to be admin
    UPDATE users 
    SET role = 'admin' 
    WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1);
    
    RAISE NOTICE 'Updated first user to admin role';
  ELSE
    RAISE NOTICE 'No users found. Create a user first, then run this migration.';
  END IF;
END $$;

-- Alternatively, update a specific user by email:
-- UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';

-- To manually set an admin user, run:
-- UPDATE users SET role = 'admin' WHERE email = 'YOUR_EMAIL_HERE';
