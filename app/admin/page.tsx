import { redirect } from "next/navigation";

export default function AdminRoutePage() {
  // Existing /admin bookmarks must still reach the GSM management tools.
  redirect("/clubs/gsm-padel/legacy#admin");
}
