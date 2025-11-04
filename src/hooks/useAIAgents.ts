export function useAIAgents() {
  return {
    config: null,
    metrics: [],
    patterns: [],
    updateConfig: () => {},
    trackInteraction: () => {},
    getAgentConfigs: async () => null,
    updateAgentConfig: async () => {}
  };
}
