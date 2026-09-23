import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { exportToCsv, loadExport } from "../lib/export.js";
import { parseInput } from "../lib/validate.js";

const ExportQuery = z.object({ format: z.enum(["json", "csv"]).default("json") });

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);

  app.get("/v1/export", async (request, reply) => {
    const { format } = parseInput(ExportQuery, request.query);
    const data = await loadExport(app.db, request.userId);
    const filename = `tend-export-${new Date(data.exportedAt).toISOString().slice(0, 10)}.${format}`;
    reply.header("content-disposition", `attachment; filename="${filename}"`);
    if (format === "csv") return reply.type("text/csv; charset=utf-8").send(exportToCsv(data));
    return reply.type("application/json; charset=utf-8").send(JSON.stringify(data));
  });
}
