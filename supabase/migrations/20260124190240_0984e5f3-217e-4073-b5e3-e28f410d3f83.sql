-- Add status field to customer_sales for tracking negotiation state
ALTER TABLE public.customer_sales 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'em_negociacao';

-- Add motivo_perda field for lost deals
ALTER TABLE public.customer_sales 
ADD COLUMN IF NOT EXISTS motivo_perda TEXT;

-- Add finalized_at timestamp
ALTER TABLE public.customer_sales 
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE;

-- Create index for better performance on status queries
CREATE INDEX IF NOT EXISTS idx_customer_sales_status ON public.customer_sales(status);

-- Create index for lead_id + status combination
CREATE INDEX IF NOT EXISTS idx_customer_sales_lead_status ON public.customer_sales(lead_id, status);

-- Add comment for documentation
COMMENT ON COLUMN public.customer_sales.status IS 'Status da venda: em_negociacao, ganho, perdido';
COMMENT ON COLUMN public.customer_sales.motivo_perda IS 'Motivo da perda quando status = perdido';
COMMENT ON COLUMN public.customer_sales.finalized_at IS 'Data/hora em que a negociação foi finalizada (ganho ou perdido)';