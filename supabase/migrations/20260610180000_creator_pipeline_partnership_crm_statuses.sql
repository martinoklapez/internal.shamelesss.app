-- Partnership pipeline stages after initial outreach (Missive + CRM).

ALTER TYPE creator_pipeline.contact_crm_status ADD VALUE IF NOT EXISTS 'in_talks';
ALTER TYPE creator_pipeline.contact_crm_status ADD VALUE IF NOT EXISTS 'test_phase';
ALTER TYPE creator_pipeline.contact_crm_status ADD VALUE IF NOT EXISTS 'active_partnership';
