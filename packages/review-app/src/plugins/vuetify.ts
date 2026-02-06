import "vuetify/styles";
import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi-svg";

export const vuetify = createVuetify({
  icons: {
    defaultSet: "mdi",
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: "dark",
    themes: {
      dark: {
        dark: true,
        colors: {
          background: "#1a1a2e",
          surface: "#16213e",
          primary: "#e94560",
          secondary: "#53a8b6",
          success: "#2d6a4f",
          warning: "#ffc107",
          error: "#dc3545",
          info: "#6c757d",
        },
      },
    },
  },
});
