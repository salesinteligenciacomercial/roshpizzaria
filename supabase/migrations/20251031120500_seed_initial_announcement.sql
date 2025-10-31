-- Seed initial announcement so users see the banner after deploy
insert into public.announcements (title, body, critical, published, company_id)
values (
  'Aviso de alterações no CEUSIA CRM',
  'Atualizamos o CRM com melhorias e correções. Principais pontos:\n- Ajustes em Equipe & Permissões, Canais & Integrações, IA & Automação e Webhooks & APIs.\n- WhatsApp (Evolution API): fluxo estabilizado; verifique o webhook em /functions/v1/webhook-conversas.\n- Segurança e estabilidade gerais.\n\nAções recomendadas:\n- Publicar a última versão no Lovable (Share → Publish).\n- Conferir secrets no Lovable Cloud: EVOLUTION_API_URL, EVOLUTION_INSTANCE, EVOLUTION_API_KEY.\n- Recarregar o app (Ctrl+F5) após o deploy.',
  true,
  true,
  null
);


