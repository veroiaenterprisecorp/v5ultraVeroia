-- ============================================================================
-- VEROIA v5-Ultra — CLOUD POSTGRESQL / SUPABASE DATABASE SCHEMA
-- Standar: ISO/IEC 27037:2012 (Chain of Custody & Non-Destructive Evidence)
-- ============================================================================
-- ATURAN UTAMA:
-- 1. DILARANG KERAS menyimpan citra mentah (Binary Blob / Base64) di tabel ini.
-- 2. Citra disimpan di Object Storage terpisah (Cloudflare R2 / Supabase Storage).
-- 3. Tabel ini hanya menyimpan metadata matematis, hash SHA-256, dan hasil forensik.
-- ============================================================================

-- Ekstensi UUID untuk pengidentifikasi catatan bukti yang unik secara kriptografis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. TABEL: forensic_evidence_records
-- Menyimpan metadata lengkap proses analisis forensik per citra Full HD
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS forensic_evidence_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identitas Berkas & Integritas Kriptografis (ISO/IEC 27037)
    file_name VARCHAR(255) NOT NULL,
    file_hash_sha256 CHAR(64) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(64) NOT NULL,
    
    -- Dimensi Spasial Fisik & Kolorimetri
    image_width INTEGER NOT NULL CHECK (image_width >= 1080),
    image_height INTEGER NOT NULL CHECK (image_height >= 1080),
    total_pixels BIGINT GENERATED ALWAYS AS (image_width * image_height) STORED,
    orientation VARCHAR(16) NOT NULL DEFAULT 'Landscape',
    colorimetry VARCHAR(64) NOT NULL DEFAULT 'ITU-R BT.601 Luma (Float32)',
    
    -- Stage 1: Gerbang Mutlak Kill-Switch Twin (G = g_layer · g_rasio · g_gerak)
    g_layer SMALLINT NOT NULL CHECK (g_layer IN (0, 1)),
    g_rasio SMALLINT NOT NULL CHECK (g_rasio IN (0, 1)),
    g_gerak SMALLINT NOT NULL CHECK (g_gerak IN (0, 1)),
    gate_g SMALLINT NOT NULL CHECK (gate_g IN (0, 1)),
    stage1_diagnostics JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Stage 5: Skor Fitur Asli Multi-Agen (X_i)
    score_cnn NUMERIC(6, 3),
    score_lbp NUMERIC(6, 3),
    score_multilid NUMERIC(6, 3),
    score_fft NUMERIC(6, 3),
    fft_unique_patches SMALLINT CHECK (fft_unique_patches <= 8),
    multilid_mean NUMERIC(6, 3),
    markov_entropy_h NUMERIC(6, 4),
    
    -- Stage 6: NTSD Alternative C & Platt Scaling Posterior
    psi_asym NUMERIC(7, 4),
    phi_grid NUMERIC(7, 4),
    omega_human NUMERIC(7, 4) CHECK (omega_human >= 0.35 AND omega_human <= 1.0),
    s_raw NUMERIC(6, 3),
    s_raw_final NUMERIC(6, 3),
    damping_q NUMERIC(6, 4),
    logit_z NUMERIC(7, 4),
    probability_ai NUMERIC(5, 4) CHECK (probability_ai >= 0.0 AND probability_ai <= 1.0),
    probability_human NUMERIC(5, 4) CHECK (probability_human >= 0.0 AND probability_human <= 1.0),
    
    -- Stage 7: Vonis Resmi ISO/IEC 27037:2012
    official_category VARCHAR(64) NOT NULL CHECK (
        official_category IN (
            'GENERATOR_AI_SYNTHETIC',
            'NATURAL_HUMAN_PHOTOGRAPHIC',
            'MACHINE_PATTERN_SYNTHETIC_NON_AI',
            'CONFLICTING_EVIDENCE_ANOMALY',
            'INSUFFICIENT_EVIDENCE_ABSTENTION',
            'INVALID_CORRUPTED_EVIDENCE'
        )
    ),
    legacy_verdict VARCHAR(64) NOT NULL,
    calibration_status VARCHAR(64) NOT NULL DEFAULT 'UNVALIDATED_FIXED_PARAMETERS',
    
    -- Tautan Bukti Objek (Penyimpanan Terpisah di Cloudflare R2 / Supabase Storage)
    object_storage_key VARCHAR(512),
    object_storage_bucket VARCHAR(128),
    
    -- Telemetri Komputasi Server
    server_execution_time_ms NUMERIC(8, 2) NOT NULL,
    server_heap_delta_bytes BIGINT,
    client_memory_saved_bytes BIGINT NOT NULL,
    
    -- Retensi & Privasi Data Pengguna
    is_ephemeral BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    purged_at TIMESTAMPTZ
);

-- Indeks Kinerja untuk Pencarian & Validasi Rantai Bukti
CREATE INDEX IF NOT EXISTS idx_forensic_sha256 ON forensic_evidence_records(file_hash_sha256);
CREATE INDEX IF NOT EXISTS idx_forensic_created_at ON forensic_evidence_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forensic_expires_at ON forensic_evidence_records(expires_at) WHERE purged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_forensic_category ON forensic_evidence_records(official_category);

-- ----------------------------------------------------------------------------
-- 2. TABEL: data_retention_audit_log
-- Mencatat seluruh aktivitas penghapusan berkas & pembersihan mematuhi GDPR / ISO
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_retention_audit_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID REFERENCES forensic_evidence_records(id) ON DELETE SET NULL,
    file_hash_sha256 CHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL CHECK (action IN ('TTL_AUTO_PURGED', 'USER_REQUESTED_DELETION', 'CORRUPT_PURGED')),
    object_storage_key_deleted VARCHAR(512),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT true,
    details TEXT
);

-- ----------------------------------------------------------------------------
-- 3. PROSEDUR / VIEW: Pembersihan Berkas Kedaluwarsa (TTL Cleanup)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW expired_evidence_candidates AS
SELECT id, file_hash_sha256, object_storage_key, object_storage_bucket, expires_at
FROM forensic_evidence_records
WHERE purged_at IS NULL AND expires_at <= NOW();
