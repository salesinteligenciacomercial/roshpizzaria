import { LeadCard } from "@/components/LeadCard";
import { Toaster } from "@/components/ui/sonner";

export default function Home() {
  // Lead de exemplo
  const testLead = {
    id: "1",
    name: "Jeohvah I.A",
    phone: "558781737005",
    tag: "lead morno"
  };

  return (
    <main className="p-4">
      <LeadCard lead={testLead} />
      <Toaster />
    </main>
  );
}