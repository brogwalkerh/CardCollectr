import { redirect } from "next/navigation";

// The root path just forwards to the New Job page.
export default function Home() {
  redirect("/new");
}
