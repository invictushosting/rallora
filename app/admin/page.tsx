import { redirect } from "next/navigation";

export default function AdminRoutePage() {
  // The main Rallora dashboard is currently rendered inside the root app.
  // This route gives /admin a real URL and safely opens the Admin dashboard state.
  redirect("/#admin");
}
