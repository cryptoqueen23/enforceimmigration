-- Run once in the existing Cloudflare D1 database Console before deploying the updated Worker.
ALTER TABLE signatures ADD COLUMN phone TEXT;
ALTER TABLE signatures ADD COLUMN address TEXT;
ALTER TABLE signatures ADD COLUMN sms_opt_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE signatures ADD COLUMN sms_consent_text TEXT;
