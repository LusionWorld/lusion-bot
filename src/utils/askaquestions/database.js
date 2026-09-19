const supabase = require("../db/supabase");

function extractKeywords(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3)
}

function getConnection(guildId) {
  return {
    // Config
    async getConfig(key, def = null) {
      const { data, error } = await supabase
        .from("aaq_config")
        .select("value")
        .eq("guild_id", guildId)
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data ? data.value : def;
    },
    async setConfig(key, val) {
      const { error } = await supabase
        .from("aaq_config")
        .upsert({ guild_id: guildId, key, value: String(val) }, { onConflict: "guild_id, key" });
      if (error) throw error;
    },

    // Questions
    async createQuestion({ authorId, content, category, anonymous }) {
      const { data, error } = await supabase
        .from("aaq_questions")
        .insert({
          guild_id: guildId,
          author_id: authorId,
          content,
          category,
          anonymous: !!anonymous,
          status: "pending",
          created_at: Date.now(),
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    async getQuestion(id) {
      const { data, error } = await supabase
        .from("aaq_questions")
        .select("*")
        .eq("guild_id", guildId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async getActiveQuestions() {
      const { data, error } = await supabase
        .from("aaq_questions")
        .select("*")
        .eq("guild_id", guildId)
        .not("status", "in", "(rejected,archived)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async updateQuestion(id, fields) {
      const { error } = await supabase
        .from("aaq_questions")
        .update(fields)
        .eq("guild_id", guildId)
        .eq("id", id);
      if (error) throw error;
    },
    async deleteQuestion(id) {
      const { error } = await supabase
        .from("aaq_questions")
        .delete()
        .eq("guild_id", guildId)
        .eq("id", id);
      if (error) throw error;
      const { error: followsError } = await supabase.from("aaq_follows").delete().eq("question_id", id);
      if (followsError) throw followsError;
      const { error: votesError } = await supabase.from("aaq_votes").delete().eq("question_id", id);
      if (votesError) throw votesError;
    },
    async searchQuestions(term) {
      const { data, error } = await supabase
        .from("aaq_questions")
        .select("*")
        .eq("guild_id", guildId)
        .ilike("content", `%${term}%`)
        .not("status", "in", "(rejected,archived)")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    async findSimilar(content, limit = 3) {
      const { data: rows, error } = await supabase
        .from("aaq_questions")
        .select("*")
        .eq("guild_id", guildId)
        .not("status", "in", "(rejected,archived)");
      if (error) throw error;

      const normalised = content.toLowerCase().trim()
      const words = extractKeywords(content)

      return (rows || [])
        .map(q => {
          if (q.content.toLowerCase().trim() === normalised) return { q, score: 1 }
          if (!words.length) return { q, score: 0 }
          const qw = extractKeywords(q.content)
          const overlap = words.filter(w => qw.includes(w)).length
          return { q, score: overlap / Math.max(words.length, qw.length, 1) }
        })
        .filter(({ score }) => score >= 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ q }) => q)
    },

    // Follows
    async toggleFollow(questionId, userId) {
      const { data: has, error: hasError } = await supabase
        .from("aaq_follows")
        .select("*")
        .eq("question_id", questionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (hasError) throw hasError;
      if (has) {
        const { error } = await supabase
          .from("aaq_follows")
          .delete()
          .eq("question_id", questionId)
          .eq("user_id", userId);
        if (error) throw error;
        return false
      }
      const { error } = await supabase.from("aaq_follows").insert({ question_id: questionId, user_id: userId });
      if (error) throw error;
      return true
    },
    async isFollowing(questionId, userId) {
      const { data, error } = await supabase
        .from("aaq_follows")
        .select("*")
        .eq("question_id", questionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return !!data
    },
    async getFollowers(questionId) {
      const { data, error } = await supabase.from("aaq_follows").select("user_id").eq("question_id", questionId);
      if (error) throw error;
      return (data || []).map(r => r.user_id)
    },
    async getFollowCount(questionId) {
      const { count, error } = await supabase
        .from("aaq_follows")
        .select("*", { count: "exact", head: true })
        .eq("question_id", questionId);
      if (error) throw error;
      return count || 0
    },

    // Votes
    async vote(questionId, userId, value) {
      const { data: ex, error: exError } = await supabase
        .from("aaq_votes")
        .select("value")
        .eq("question_id", questionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (exError) throw exError;
      if (ex) {
        if (ex.value === value) {
          const { error } = await supabase
            .from("aaq_votes")
            .delete()
            .eq("question_id", questionId)
            .eq("user_id", userId);
          if (error) throw error;
          return null
        }
        const { error } = await supabase
          .from("aaq_votes")
          .update({ value })
          .eq("question_id", questionId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("aaq_votes").insert({ question_id: questionId, user_id: userId, value });
        if (error) throw error;
      }
      return value
    },
    async getVotes(questionId) {
      const { data: rows, error } = await supabase.from("aaq_votes").select("value").eq("question_id", questionId);
      if (error) throw error;
      return {
        up:   (rows || []).filter(r => r.value === 1).length,
        down: (rows || []).filter(r => r.value === -1).length,
      }
    },

    // FAQ
    async checkFaqThreshold(content, threshold) {
      const words = extractKeywords(content)
      if (!words.length) return 0
      const { data: rows, error } = await supabase.from("aaq_questions").select("content").eq("guild_id", guildId);
      if (error) throw error;
      const count = (rows || []).filter(q => {
        const qw = extractKeywords(q.content)
        return words.filter(w => qw.includes(w)).length >= Math.ceil(words.length * 0.5)
      }).length
      return count >= threshold ? count : 0
    },
    async getFaqLog(questionId) {
      const { data, error } = await supabase
        .from("aaq_faq_log")
        .select("*")
        .eq("question_id", questionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async createFaqLog(questionId) {
      const { error } = await supabase
        .from("aaq_faq_log")
        .upsert({ question_id: questionId }, { onConflict: "question_id", ignoreDuplicates: true });
      if (error) console.error(`[AAQ] createFaqLog error:`, error.message);
    },
    async updateFaqLog(questionId, fields) {
      const { error } = await supabase.from("aaq_faq_log").update(fields).eq("question_id", questionId);
      if (error) throw error;
    },
  }
}

module.exports = { getConnection, extractKeywords }
