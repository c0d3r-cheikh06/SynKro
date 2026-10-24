import { signOut } from "@/lib/auth";
import { needsPhoneCompletion } from "@/lib/auth-guards";
import { UserRecord } from "@/lib/data-store";
import { NavbarUserSummary, SynkroNavClient } from "./SynkroNavClient";

interface SynkroNavbarProps {
  user: UserRecord | null;
  dbConnected?: boolean;
}

export function SynkroNavbar({ user, dbConnected = true }: SynkroNavbarProps) {
  const userSummary: NavbarUserSummary | null = user
    ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        image: user.image,
        role: user.role,
        status: user.status,
        emailVerified: Boolean(user.emailVerified),
        needsPhoneCompletion: needsPhoneCompletion(user),
        groupName: user.groupName,
        groupColor: user.groupColor,
      }
    : null;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <SynkroNavClient
      user={userSummary}
      dbConnected={dbConnected}
      signOutAction={handleSignOut}
    />
  );
}
