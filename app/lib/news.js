import Parser from "rss-parser";
import { supabase } from "./supabase";

const parser = new Parser({
  timeout: 15000,
});

export async function collectNews() {
  const { data: sources, error } = await supabase
    .from("sources")
    .select("*")
    .eq("active", true);

  if (error) {
    throw new Error(error.message);
  }

  let total = 0;

  for (const source of sources || []) {
    try {
      const feed = await parser.parseURL(source.feed_url);

      for (const item of feed.items || []) {
        if (!item.title || !item.link) continue;

        const { error: insertError } = await supabase
          .from("news_items")
          .upsert(
            {
              source_id: source.id,
              title: item.title.trim(),
              url: item.link.trim(),
              description: item.contentSnippet || item.content || "",
              published_at: item.isoDate || item.pubDate || null,
            },
            {
              onConflict: "url",
              ignoreDuplicates: true,
            }
          );

        if (!insertError) {
          total++;
        }
      }
    } catch (error) {
      console.error(
        `RSS failed: ${source.name}`,
        error?.message || error
      );
    }
  }

  return {
    sources: sources?.length || 0,
    collected: total,
  };
}