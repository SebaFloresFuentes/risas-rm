import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://risas-rm.vercel.app";

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/locales`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/nosotros`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contacto`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/privacidad`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const { data: events, error } = await supabase
    .from("events")
    .select("slug, updated_at")
    .eq("verified", true)
    .order("event_date", { ascending: true });

  if (error) {
    console.error("Error generando sitemap de eventos:", error);
    return staticPages;
  }

  const eventPages: MetadataRoute.Sitemap = (events ?? []).map((event) => ({
    url: `${baseUrl}/eventos/${event.slug}`,
    lastModified: event.updated_at,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticPages, ...eventPages];
}