import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { ConceptDetail } from "@/components/ConceptDetail";

export const dynamic = "force-dynamic";

export default async function ConceptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("concepts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  return <ConceptDetail concept={data} />;
}
