/**
 * Standardized MCP Error Definitions and Codes
 */

export enum McpErrorCode {
  INVALID_TARGET = "INVALID_TARGET",
  SCOPE_DENIED = "SCOPE_DENIED",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  INVESTIGATION_NOT_FOUND = "INVESTIGATION_NOT_FOUND",
  FINDING_NOT_FOUND = "FINDING_NOT_FOUND",
  JOB_NOT_FOUND = "JOB_NOT_FOUND",
  TOOL_UNAVAILABLE = "TOOL_UNAVAILABLE",
  TOOL_FAILED = "TOOL_FAILED",
  TIMEOUT = "TIMEOUT",
  INVALID_ARGUMENT = "INVALID_ARGUMENT",
  POLICY_DENIED = "POLICY_DENIED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export interface McpErrorPayload {
  error: {
    code: McpErrorCode;
    message: string;
    retryable: boolean;
    details?: Record<string, any>;
  };
}

export function createMcpError(
  code: McpErrorCode,
  message: string,
  retryable = false,
  details?: Record<string, any>
): McpErrorPayload {
  return {
    error: {
      code,
      message,
      retryable,
      ...(details ? { details } : {}),
    },
  };
}

export function mcpErrorResponse(
  code: McpErrorCode,
  message: string,
  retryable = false,
  details?: Record<string, any>
) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(createMcpError(code, message, retryable, details), null, 2),
      },
    ],
  };
}

export function mcpSuccessResponse(data: any) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}
