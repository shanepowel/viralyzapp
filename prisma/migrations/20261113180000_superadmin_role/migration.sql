-- Promote the operator account when it already exists. New sign-ins are
-- promoted in application code as well.
UPDATE "User" SET "role" = 'superadmin' WHERE lower("email") = 'shane.powell@bmkrs.com';
