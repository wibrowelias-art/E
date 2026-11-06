import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { GUILD_SLUGS, GUILDS } from "@/data/guilds";

export default async function ChannelPage({ params }: { params: Promise<{ guild: string; channel: string }> }) {
  const { guild, channel } = await params;
  const guildId = GUILD_SLUGS[guild];
  const g = GUILDS.find((x) => x.id === guildId);
  if (!g || !g.channels.some((c) => c.name === channel && c.kind === "text")) notFound();
  return <AppShell guildSlug={guild} channelName={channel} initialPane="chat" />;
}

export function generateStaticParams() {
  return Object.entries(GUILD_SLUGS).flatMap(([slug, id]) =>
    GUILDS.find((g) => g.id === id)!.channels.filter((c) => c.kind === "text").map((c) => ({ guild: slug, channel: c.name })),
  );
}
