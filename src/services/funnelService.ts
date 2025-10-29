interface TransferLeadParams {
  leadId: string;
  targetFunnelId: string;
  targetStageId: string;
}

export const funnelService = {
  async transferLead({ leadId, targetFunnelId, targetStageId }: TransferLeadParams) {
    try {
      // TODO: Substituir pela URL real da sua API
      const response = await fetch('/api/leads/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadId,
          targetFunnelId,
          targetStageId,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao transferir lead');
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao transferir lead:', error);
      throw error;
    }
  },

  async getFunnels() {
    try {
      // TODO: Substituir pela URL real da sua API
      const response = await fetch('/api/funnels');
      
      if (!response.ok) {
        throw new Error('Falha ao buscar funis');
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar funis:', error);
      throw error;
    }
  }
};
