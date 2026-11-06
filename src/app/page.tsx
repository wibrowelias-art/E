import { AppShell } from "@/components/AppShell";

/** Landing: the channel list on mobile, #general on desktop. */
export default function Home() {
  return <AppShell guildSlug="lounge" channelName="general" initialPane="channels" />;
}
