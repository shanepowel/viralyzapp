import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isClerkEnabled } from "@/lib/env";
import { getClerkIdentity } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    if (isClerkEnabled()) {
      const clerk = await getClerkIdentity();
      if (clerk) redirect("/claim-invite");
    }
    redirect("/login");
  }

  redirect("/discover");
}
