export const buttonStyle = {
  padding: "8px 16px",
  background: "#0066cc",
  color: "white",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "14px",
  transition: "background 0.2s",
};

export const secondaryButtonStyle = {
  ...buttonStyle,
  background: "#f0f0f0",
  color: "#333",
  border: "1px solid #ddd",
};

export const successButtonStyle = {
  ...buttonStyle,
  background: "#00cc66",
};

export const warningButtonStyle = {
  ...buttonStyle,
  background: "#cc6600",
};

export const disabledButtonStyle = {
  ...buttonStyle,
  background: "#cccccc",
  cursor: "not-allowed",
  opacity: 0.7,
};

export const inputStyle = {
  padding: "8px 12px",
  border: "1px solid #ddd",
  borderRadius: 4,
  fontSize: "14px",
  width: "100px",
};
