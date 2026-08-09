export function viteCommandForPlatform(platform = process.platform) {
  return {
    command: platform === "win32" ? "npx.cmd" : "npx",
    args: ["vite", "build"],
    shell: false,
  };
}
