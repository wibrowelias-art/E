import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/server/auth";

export const dynamic = "force-dynamic";

/** Landing: the channel list on mobile, #general on desktop. */
export default async function Home() {
  if (!(await getSession())) redirect("/login");
  return <AppShell guildSlug="lounge" channelName="general" initialPane="channels" />;
}
