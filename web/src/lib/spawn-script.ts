import { spawn } from "child_process";
import path from "path";

const SCRIPTS_DIR = path.resolve(process.cwd(), "..");

export function spawnScript(
  scriptName: string,
  args: string[],
  env?: Record<string, string>
): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    const child = spawn("node", [scriptPath, ...args], {
      env: { ...process.env, ...env },
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

    child.on("close", (code) => {
      if (code !== 0) {
        const errMsg = Buffer.concat(stderr).toString("utf8").trim();
        reject(new Error(errMsg || `Script exited with code ${code}`));
      } else {
        resolve(Buffer.concat(stdout).toString("utf8"));
      }
    });

    child.on("error", (err) => reject(err));
  });
}
