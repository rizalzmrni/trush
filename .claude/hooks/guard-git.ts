// Hook PreToolUse (Bash): teammate tidak boleh mengubah state git/GitHub.
// Exit 2 = perintah diblokir; stderr dikirim ke agent sebagai alasan.
// Lead (sesi utama) tidak membawa agent_type, jadi tidak terpengaruh.
const TEAMMATES = new Set([
  "backend-engineer",
  "frontend-engineer",
  "qa-tester",
]);
const BLOCKED =
  /\b(?:git\s+(?:commit|push|pull|fetch|checkout|switch|stash|reset|rebase|merge|branch|tag|cherry-pick|restore|clean|revert|am|apply)|gh\s+(?:pr|release|repo|api))\b/u;

interface HookInput {
  agent_type?: string;
  tool_input?: { command?: string };
}

const input = (await Bun.stdin.json()) as HookInput;
const agent = input.agent_type ?? "";
const command = input.tool_input?.command ?? "";

if (TEAMMATES.has(agent) && BLOCKED.test(command)) {
  process.stderr.write(
    `Diblokir: ${agent} tidak boleh menjalankan perintah git/gh yang mengubah state. ` +
      "Git dan PR hanya oleh lead (AGENTS.md). Yang boleh: git status, git diff, git log. " +
      "Kirim laporan akhir ke lead.\n"
  );
  process.exitCode = 2;
}
