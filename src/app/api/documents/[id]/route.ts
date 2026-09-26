import { currentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { readStored } from "@/lib/storage";

export async function GET(req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const user = await currentUser();
  if (!user || !can(user.role, "view:documents")) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return new Response("Not found", { status: 404 });
  const file = await readStored(doc.storageKey, doc.fileName);
  if (!file) return new Response("File missing from storage", { status: 404 });
  const inline = new URL(req.url).searchParams.get("download") !== "1" && /^(application\/pdf|image\/)/.test(file.mimeType);
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": doc.mimeType ?? file.mimeType,
      "Content-Length": String(file.body.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${doc.fileName.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=0",
    },
  });
}
