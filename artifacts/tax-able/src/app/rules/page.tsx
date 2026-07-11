import { redirect } from "next/navigation";

/** Legacy alias retained for bookmarks; controlled rules live in one pack. */
export default function RulesRedirect() {
  redirect("/rules-pack");
}
