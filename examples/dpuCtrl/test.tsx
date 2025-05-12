import React from "react";
import ReactDOM from "react-dom/client";
import { TestConfigViewer } from "./components/TestConfigViewer";
import "@xyflow/react/dist/style.css";

// Create a simple styling for the test page
const styles = document.createElement("style");
styles.textContent = `
  body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f9f9f9;
  }
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }
  
  h1 {
    color: #333;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
  }
`;

document.head.appendChild(styles);

// Create container for the app
const container =
  document.getElementById("root") || document.createElement("div");
if (!document.getElementById("root")) {
  container.id = "root";
  document.body.appendChild(container);
}

// Create container div with styling
const appContainer = document.createElement("div");
appContainer.className = "container";
container.appendChild(appContainer);

// Render the test component
const root = ReactDOM.createRoot(appContainer);
root.render(
  <React.StrictMode>
    <TestConfigViewer />
  </React.StrictMode>
);
