"use server";

import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateSettingsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const activeProvider = formData.get("activeProvider") as string;
  const providerSettings = formData.get("providerSettings") as string;

  let settingsObj = {};
  try {
    if (providerSettings) {
      settingsObj = JSON.parse(providerSettings);
    }
  } catch {}

  const db = await getDb();
  
  await db.update(users)
    .set({
      activeProvider: activeProvider || "openrouter",
      providerSettings: settingsObj,
    })
    .where(eq(users.id, session.user.id))
    .run();

  revalidatePath("/hub/settings");
}
