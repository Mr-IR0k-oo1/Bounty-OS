import { randomUUID } from "crypto";
import { redactObject } from "./redaction.js";

export interface LogEntry {
  timestamp: string;
  request_id: string;
  actor: string;
  tool: string;
  arguments: any;
  investigation_id?: string;
  job_id?: string;
  duration_ms: number;
  result?: "SUCCESS" | "FAILED" | "DENIED";
  error?: string;
}

export class McpLogger {
  static createRequestId(): string {
    return randomUUID();
  }

  static logOperation(entry: Omit<LogEntry, "timestamp">) {
    const record: LogEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
      arguments: redactObject(entry.arguments),
    };

    // Format structured JSON output to stderr
    process.stderr.write(`[MCP-AUDIT] ${JSON.stringify(record)}\n`);
  }
}
