export interface OutputOptions {
  quiet?: boolean;
  json?: boolean;
}

export interface OutputSink {
  stdout: (chunk: string) => void;
  stderr: (chunk: string) => void;
}

export interface Output {
  quiet: boolean;
  json: boolean;
  info: (message: string, fields?: Record<string, unknown>) => void;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  error: (message: string, fields?: Record<string, unknown>) => void;
  print: (message: string) => void;
  event: (event: string, fields?: Record<string, unknown>) => void;
}

const defaultSink: OutputSink = {
  stdout: (chunk) => {
    process.stdout.write(chunk);
  },
  stderr: (chunk) => {
    process.stderr.write(chunk);
  },
};

export function createOutput(
  options: OutputOptions = {},
  sink: OutputSink = defaultSink,
): Output {
  const json = Boolean(options.json);
  const quiet = json ? false : Boolean(options.quiet);

  const writeStructured = (
    channel: "stdout" | "stderr",
    payload: Record<string, unknown>,
  ): void => {
    sink[channel](`${JSON.stringify(payload)}\n`);
  };

  const writeText = (channel: "stdout" | "stderr", message: string): void => {
    sink[channel](`${message}\n`);
  };

  const log = (
    level: "info" | "warn" | "error",
    message: string,
    fields?: Record<string, unknown>,
  ): void => {
    const alwaysEmit = level === "error";
    if (!alwaysEmit && quiet) {
      return;
    }

    if (json) {
      writeStructured(level === "error" ? "stderr" : "stdout", {
        level,
        message,
        ...(fields ?? {}),
      });
      return;
    }

    writeText(level === "error" ? "stderr" : "stdout", message);
  };

  return {
    quiet,
    json,
    info(message, fields) {
      log("info", message, fields);
    },
    warn(message, fields) {
      log("warn", message, fields);
    },
    error(message, fields) {
      log("error", message, fields);
    },
    print(message) {
      if (quiet) {
        return;
      }

      if (json) {
        writeStructured("stdout", {
          level: "info",
          message,
        });
        return;
      }

      writeText("stdout", message);
    },
    event(event, fields) {
      if (quiet && !json) {
        return;
      }

      if (json) {
        writeStructured("stdout", {
          event,
          ...(fields ?? {}),
        });
        return;
      }

      if (fields && Object.keys(fields).length > 0) {
        writeText("stdout", `${event}: ${JSON.stringify(fields)}`);
      } else {
        writeText("stdout", event);
      }
    },
  };
}
