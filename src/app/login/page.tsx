import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getSession, ownerConfigured } from "@/server/auth";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · The Lounge" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  const persistence = !!(await db());
  const owner = ownerConfigured();
  return <LoginForm ownerConfigured={owner} demoAllowed={!owner && !persistence} persistence={persistence} />;
}
