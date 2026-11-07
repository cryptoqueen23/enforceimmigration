CREATE TABLE IF NOT EXISTS signatures (
 id TEXT PRIMARY KEY,
 first_name TEXT NOT NULL,
 last_name TEXT NOT NULL,
 email TEXT NOT NULL,
 email_hash TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL,
 zip TEXT NOT NULL,
 phone TEXT,
 address TEXT,
 sms_opt_in INTEGER NOT NULL DEFAULT 0,
 sms_consent_text TEXT,
 petition_version TEXT NOT NULL,
 updates_opt_in INTEGER NOT NULL DEFAULT 0,
 marketing_opt_in INTEGER NOT NULL DEFAULT 0,
 marketing_consent_text TEXT,
 consent_timestamp TEXT NOT NULL,
 verified_at TEXT,
 verification_token_hash TEXT NOT NULL,
 verification_expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_verified ON signatures(verified_at);
CREATE TABLE IF NOT EXISTS email_suppressions(email_hash TEXT PRIMARY KEY, suppressed_at TEXT NOT NULL);
