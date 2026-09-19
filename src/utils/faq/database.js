const supabase = require("../db/supabase");

function getConnection(guildId) {
  return {
    async getConfig(key, def = null) {
      const { data, error } = await supabase
        .from("faq_config")
        .select("value")
        .eq("guild_id", guildId)
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data ? data.value : def;
    },
    async setConfig(key, val) {
      const { error } = await supabase
        .from("faq_config")
        .upsert({ guild_id: guildId, key, value: String(val) }, { onConflict: "guild_id, key" });
      if (error) throw error;
    },

    // ── Categories ───────────────────────────────────────────────────────────
    async getCategories() {
      const { data, error } = await supabase
        .from("faq_categories")
        .select("*")
        .eq("guild_id", guildId)
        .order("position", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    async addCategory(value, label) {
      const { count, error: countError } = await supabase
        .from("faq_categories")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId);
      if (countError) throw countError;
      const { error } = await supabase
        .from("faq_categories")
        .upsert(
          { guild_id: guildId, value, label, position: count || 0 },
          { onConflict: "guild_id, value", ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    async updateCategory(value, label) {
      const { error } = await supabase
        .from("faq_categories")
        .update({ label })
        .eq("guild_id", guildId)
        .eq("value", value);
      if (error) throw error;
    },
    async removeCategory(value) {
      const { error } = await supabase
        .from("faq_categories")
        .delete()
        .eq("guild_id", guildId)
        .eq("value", value);
      if (error) throw error;
      const { error: qError } = await supabase
        .from("faq_questions")
        .delete()
        .eq("guild_id", guildId)
        .eq("category_value", value);
      if (qError) throw qError;
    },

    // ── Questions ────────────────────────────────────────────────────────────
    async getQuestions(categoryValue) {
      const { data, error } = await supabase
        .from("faq_questions")
        .select("*")
        .eq("guild_id", guildId)
        .eq("category_value", categoryValue)
        .order("position", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    async getQuestion(id) {
      const { data, error } = await supabase
        .from("faq_questions")
        .select("*")
        .eq("guild_id", guildId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async getTotalQuestions() {
      const { count, error } = await supabase
        .from("faq_questions")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId);
      if (error) throw error;
      return count || 0;
    },
    async addQuestion(categoryValue, question, answer) {
      const { count, error: countError } = await supabase
        .from("faq_questions")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId)
        .eq("category_value", categoryValue);
      if (countError) throw countError;
      const { error } = await supabase
        .from("faq_questions")
        .insert({ guild_id: guildId, category_value: categoryValue, question, answer, position: count || 0 });
      if (error) throw error;
    },
    async updateQuestion(id, question, answer) {
      const { error } = await supabase
        .from("faq_questions")
        .update({ question, answer })
        .eq("guild_id", guildId)
        .eq("id", id);
      if (error) throw error;
    },
    async removeQuestion(id) {
      const { error } = await supabase
        .from("faq_questions")
        .delete()
        .eq("guild_id", guildId)
        .eq("id", id);
      if (error) throw error;
    },

    // ── Analytics ────────────────────────────────────────────────────────────
    async logAccess(categoryValue, questionId) {
      const { error } = await supabase
        .from("faq_analytics")
        .insert({ guild_id: guildId, category_value: categoryValue, question_id: questionId, accessed_at: Date.now() });
      if (error) console.error(`[FAQ] logAccess error (${guildId}):`, error.message);
    },
    async getAnalytics() {
      const { count: total, error: totalError } = await supabase
        .from("faq_analytics")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", guildId);
      if (totalError) throw totalError;

      const { data: rows, error: rowsError } = await supabase
        .from("faq_analytics")
        .select("category_value, question_id")
        .eq("guild_id", guildId);
      if (rowsError) throw rowsError;

      const byCategoryMap = new Map();
      const byQuestionMap = new Map();
      for (const row of rows || []) {
        byCategoryMap.set(row.category_value, (byCategoryMap.get(row.category_value) || 0) + 1);
        if (row.question_id != null) {
          byQuestionMap.set(row.question_id, (byQuestionMap.get(row.question_id) || 0) + 1);
        }
      }

      const byCategory = [...byCategoryMap.entries()]
        .map(([category_value, count]) => ({ category_value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const topQuestionIds = [...byQuestionMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id);

      let byQuestion = [];
      if (topQuestionIds.length) {
        const { data: questions, error: qError } = await supabase
          .from("faq_questions")
          .select("id, question, category_value")
          .eq("guild_id", guildId)
          .in("id", topQuestionIds);
        if (qError) throw qError;
        const questionMap = new Map((questions || []).map((q) => [q.id, q]));
        byQuestion = topQuestionIds.map((id) => ({
          question: questionMap.get(id)?.question ?? null,
          category_value: questionMap.get(id)?.category_value ?? null,
          count: byQuestionMap.get(id),
        }));
      }

      return { total: total || 0, byCategory, byQuestion };
    },
    async clearAnalytics() {
      const { error } = await supabase.from("faq_analytics").delete().eq("guild_id", guildId);
      if (error) throw error;
    },
  }
}

module.exports = { getConnection }
