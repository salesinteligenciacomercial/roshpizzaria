import { Template } from "@/components/campanhas/TemplateSelector";

interface LeadLike {
  name?: string | null;
  telefone?: string | null;
  phone?: string | null;
  email?: string | null;
}

/**
 * Build template components array for Meta API sending.
 */
export function buildTemplateComponents(
  template: Template,
  lead: LeadLike,
  templateVariables: Record<string, string>,
  templateMediaUrl: string
): any[] {
  const components: any[] = [];
  if (!template.components) return components;

  // HEADER
  const headerComponent = template.components.find((c: any) => c.type === "HEADER");
  if (headerComponent) {
    if (headerComponent.format && headerComponent.format !== "TEXT") {
      const mediaFormat = headerComponent.format.toLowerCase();
      if (templateMediaUrl) {
        components.push({
          type: "header",
          parameters: [{ type: mediaFormat, [mediaFormat]: { link: templateMediaUrl } }],
        });
      } else if (headerComponent.example?.header_handle?.[0]) {
        components.push({
          type: "header",
          parameters: [{ type: mediaFormat, [mediaFormat]: { id: headerComponent.example.header_handle[0] } }],
        });
      } else {
        console.warn("⚠️ Template com header de mídia mas sem URL fornecida:", headerComponent.format);
      }
    } else if (headerComponent.text?.includes("{{")) {
      const matches = headerComponent.text.match(/\{\{(\d+)\}\}/g) || [];
      const parameters = matches.map((match: string) => {
        const varNum = match.replace(/[{}]/g, "");
        let value = templateVariables[varNum] || "";
        value = value.replace("{{nome}}", lead.name || "Cliente");
        return { type: "text", text: value || "Cliente" };
      });
      if (parameters.length > 0) {
        components.push({ type: "header", parameters });
      }
    }
  }

  // BODY
  const bodyComponent = template.components.find((c: any) => c.type === "BODY");
  if (bodyComponent?.text?.includes("{{")) {
    const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g) || [];
    const parameters = matches.map((match: string) => {
      const varNum = match.replace(/[{}]/g, "");
      let value = templateVariables[varNum] || "";
      value = value.replace("{{nome}}", lead.name || "Cliente");
      value = value.replace("{{telefone}}", lead.telefone || lead.phone || "");
      value = value.replace("{{email}}", lead.email || "");
      return { type: "text", text: value || "Cliente" };
    });
    if (parameters.length > 0) {
      components.push({ type: "body", parameters });
    }
  }

  return components;
}

/**
 * Build human-readable text content from a template for persistence.
 */
export function buildTemplateTextContent(
  template: Template,
  lead: LeadLike,
  templateVariables: Record<string, string>
): string {
  if (!template.components) return `[Template: ${template.name}]`;

  let textContent = "";

  // Header
  const headerComponent = template.components.find((c: any) => c.type === "HEADER");
  if (headerComponent?.text) {
    let headerText = headerComponent.text;
    const matches = headerText.match(/\{\{(\d+)\}\}/g) || [];
    matches.forEach((match: string) => {
      const varNum = match.replace(/[{}]/g, "");
      let value = templateVariables[varNum] || "";
      value = value.replace("{{nome}}", lead.name || "Cliente");
      headerText = headerText.replace(match, value || "Cliente");
    });
    textContent += `*${headerText}*\n\n`;
  }

  // Body
  const bodyComponent = template.components.find((c: any) => c.type === "BODY");
  if (bodyComponent?.text) {
    let bodyText = bodyComponent.text;
    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    matches.forEach((match: string) => {
      const varNum = match.replace(/[{}]/g, "");
      let value = templateVariables[varNum] || "";
      value = value.replace("{{nome}}", lead.name || "Cliente");
      value = value.replace("{{telefone}}", lead.telefone || lead.phone || "");
      value = value.replace("{{email}}", lead.email || "");
      bodyText = bodyText.replace(match, value || "Cliente");
    });
    textContent += bodyText;
  }

  // Footer
  const footerComponent = template.components.find((c: any) => c.type === "FOOTER");
  if (footerComponent?.text) {
    textContent += `\n\n_${footerComponent.text}_`;
  }

  // Buttons
  const buttonsComponent = template.components.find((c: any) => c.type === "BUTTONS");
  if (buttonsComponent?.buttons && buttonsComponent.buttons.length > 0) {
    textContent += "\n\n";
    buttonsComponent.buttons.forEach((btn: any) => {
      textContent += `↪ ${btn.text}\n`;
    });
  }

  return textContent.trim() || `[Template: ${template.name}]`;
}
