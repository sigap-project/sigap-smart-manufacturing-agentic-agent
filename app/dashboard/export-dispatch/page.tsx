import { redirect } from "next/navigation";

export default function ExportDispatchRedirect() {
  redirect("/dashboard/dispatch");
}
