import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { StatCard } from "../stat-card";

export default async function FaqPage({ params }: { params: { guildId: string } }) {
  const { guildId } = params;

  const [categoriesRes, questionsRes, analyticsCountRes] = await Promise.all([
    supabaseAdmin
      .from("faq_categories")
      .select("*")
      .eq("guild_id", guildId)
      .order("position", { ascending: true }),
    supabaseAdmin
      .from("faq_questions")
      .select("id, category_value, question")
      .eq("guild_id", guildId),
    supabaseAdmin
      .from("faq_analytics")
      .select("*", { count: "exact", head: true })
      .eq("guild_id", guildId),
  ]);

  const categories = categoriesRes.data ?? [];
  const questions = questionsRes.data ?? [];
  const totalAccess = analyticsCountRes.count ?? 0;

  const questionsByCategory = new Map<string, typeof questions>();
  for (const q of questions) {
    const list = questionsByCategory.get(q.category_value) ?? [];
    list.push(q);
    questionsByCategory.set(q.category_value, list);
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-text">FAQ</h1>
        <p className="mt-1 text-sm text-text-muted">
          Perguntas frequentes configuradas e acessos registrados.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-3 gap-3">
        <StatCard label="Categorias" value={categories.length} tone="accent" />
        <StatCard label="Perguntas" value={questions.length} tone="success" />
        <StatCard label="Acessos registrados" value={totalAccess} tone="warning" />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-text">Categorias e perguntas</h2>
        </header>

        {categories.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            Nenhuma categoria configurada. Use <code>/painel-faq</code> no Discord para configurar.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {categories.map((cat) => (
              <li key={cat.value} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">{cat.label}</span>
                  <span className="text-xs text-text-muted">
                    {(questionsByCategory.get(cat.value) ?? []).length} pergunta(s)
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
