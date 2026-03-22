import { createApp } from "vue";
import App from "./App.vue";
import "vuetify/styles";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "./styles.css";

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: "runmeter",
    themes: {
      runmeter: {
        dark: false,
        colors: {
          primary: "#0d3b66",
          secondary: "#f4d35e",
          accent: "#ee964b",
          surface: "#fffaf0",
          background: "#f6f9fc",
          success: "#2a9d8f",
          error: "#c1121f"
        }
      }
    }
  }
});

createApp(App).use(vuetify).mount("#app");
