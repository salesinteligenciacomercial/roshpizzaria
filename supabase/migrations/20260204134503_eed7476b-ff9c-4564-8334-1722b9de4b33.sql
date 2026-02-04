-- Atualizar política de SELECT em training_modules para incluir conta mestre
DROP POLICY IF EXISTS "Users can view training modules of their company" ON training_modules;

CREATE POLICY "Users can view training modules"
ON training_modules FOR SELECT
USING (
  company_id IN (
    -- Própria empresa
    SELECT ur.company_id FROM user_roles ur WHERE ur.user_id = auth.uid()
    UNION
    -- Empresa pai (conta mestre) para subcontas
    SELECT c.parent_company_id 
    FROM companies c 
    INNER JOIN user_roles ur ON ur.company_id = c.id
    WHERE ur.user_id = auth.uid() AND c.parent_company_id IS NOT NULL
  )
);

-- Atualizar política de SELECT em training_lessons para incluir conta mestre
DROP POLICY IF EXISTS "Users can view training lessons" ON training_lessons;

CREATE POLICY "Users can view training lessons"
ON training_lessons FOR SELECT
USING (
  module_id IN (
    SELECT tm.id FROM training_modules tm
    WHERE tm.company_id IN (
      -- Própria empresa
      SELECT ur.company_id FROM user_roles ur WHERE ur.user_id = auth.uid()
      UNION
      -- Empresa pai (conta mestre) para subcontas
      SELECT c.parent_company_id 
      FROM companies c 
      INNER JOIN user_roles ur ON ur.company_id = c.id
      WHERE ur.user_id = auth.uid() AND c.parent_company_id IS NOT NULL
    )
  )
);

-- Atualizar política de INSERT em training_progress para permitir progresso em aulas da conta mestre
DROP POLICY IF EXISTS "Users can insert their own progress" ON training_progress;

CREATE POLICY "Users can insert their own progress"
ON training_progress FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  lesson_id IN (
    SELECT tl.id FROM training_lessons tl
    INNER JOIN training_modules tm ON tl.module_id = tm.id
    WHERE tm.company_id IN (
      SELECT ur.company_id FROM user_roles ur WHERE ur.user_id = auth.uid()
      UNION
      SELECT c.parent_company_id 
      FROM companies c 
      INNER JOIN user_roles ur ON ur.company_id = c.id
      WHERE ur.user_id = auth.uid() AND c.parent_company_id IS NOT NULL
    )
  )
);