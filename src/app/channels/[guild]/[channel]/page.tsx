import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { GUILD_SLUGS, GUILDS } from "@/data/guilds";
import { getSession } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function ChannelPage({ params }: { params: Promise<{ guild: string; channel: string }> }) {
  const { guild, channel } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const g = GUILDS.find((x) => x.id === GUILD_SLUGS[guild]);
  const ch = g?.channels.find((c) => c.name === channel && c.kind === "text");
  if (!g || !ch || (ch.staffOnly && session.role !== "owner")) notFound();
  return <AppShell guildSlug={guild} channelName={channel} initialPane="chat" />;
}
