// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.js";
import fs from "fs";
import path from "path";
var __vite_injected_original_dirname = "/home/project";
function excludeBrokenFiles() {
  return {
    name: "exclude-broken-files",
    generateBundle() {
    },
    buildStart() {
    },
    closeBundle() {
      const target = path.resolve(__vite_injected_original_dirname, "dist/image copy.png");
      if (fs.existsSync(target)) {
        try {
          fs.unlinkSync(target);
        } catch {
        }
      }
    }
  };
}
var vite_config_default = defineConfig({
  plugins: [react(), excludeBrokenFiles()],
  server: {
    port: 5173,
    host: true
  },
  publicDir: "public"
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCB0eXBlIHsgUGx1Z2luIH0gZnJvbSAndml0ZSdcblxuZnVuY3Rpb24gZXhjbHVkZUJyb2tlbkZpbGVzKCk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2V4Y2x1ZGUtYnJva2VuLWZpbGVzJyxcbiAgICBnZW5lcmF0ZUJ1bmRsZSgpIHtcbiAgICAgIC8vIG5vLW9wOyBqdXN0IHByZXZlbnRzIGNvcHkgZXJyb3JzIGZvciBsb2NrZWQgZmlsZXNcbiAgICB9LFxuICAgIGJ1aWxkU3RhcnQoKSB7XG4gICAgICAvLyBuby1vcFxuICAgIH0sXG4gICAgY2xvc2VCdW5kbGUoKSB7XG4gICAgICAvLyBSZW1vdmUgYW55IGFjY2lkZW50YWxseSBjb3BpZWQgbG9ja2VkIGZpbGVcbiAgICAgIGNvbnN0IHRhcmdldCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdkaXN0L2ltYWdlIGNvcHkucG5nJylcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKHRhcmdldCkpIHtcbiAgICAgICAgdHJ5IHsgZnMudW5saW5rU3luYyh0YXJnZXQpIH0gY2F0Y2gge31cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCksIGV4Y2x1ZGVCcm9rZW5GaWxlcygpXSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBob3N0OiB0cnVlXG4gIH0sXG4gIHB1YmxpY0RpcjogJ3B1YmxpYycsXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TixTQUFTLG9CQUFvQjtBQUN0UCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxRQUFRO0FBQ2YsT0FBTyxVQUFVO0FBSGpCLElBQU0sbUNBQW1DO0FBTXpDLFNBQVMscUJBQTZCO0FBQ3BDLFNBQU87QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLGlCQUFpQjtBQUFBLElBRWpCO0FBQUEsSUFDQSxhQUFhO0FBQUEsSUFFYjtBQUFBLElBQ0EsY0FBYztBQUVaLFlBQU0sU0FBUyxLQUFLLFFBQVEsa0NBQVcscUJBQXFCO0FBQzVELFVBQUksR0FBRyxXQUFXLE1BQU0sR0FBRztBQUN6QixZQUFJO0FBQUUsYUFBRyxXQUFXLE1BQU07QUFBQSxRQUFFLFFBQVE7QUFBQSxRQUFDO0FBQUEsTUFDdkM7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGO0FBRUEsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sR0FBRyxtQkFBbUIsQ0FBQztBQUFBLEVBQ3ZDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxXQUFXO0FBQ2IsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
