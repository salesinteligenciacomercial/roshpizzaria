-- Add allow_ai_features column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS allow_ai_features boolean DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.companies.allow_ai_features IS 'Controls whether this subaccount can use AI agents. Must be enabled by super admin.';