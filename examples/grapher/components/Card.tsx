import React from "react";

interface CardProps {
  title: string;
  children: React.ReactNode;
}

export function Card({ title, children }: CardProps) {
  const cardStyle = {
    background: "white",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    padding: "16px",
    marginBottom: "16px",
    border: "1px solid #eee",
    overflow: "hidden",
  };

  const cardHeaderStyle = {
    fontWeight: 600,
    fontSize: "16px",
    marginBottom: "12px",
    borderBottom: "1px solid #eee",
    paddingBottom: "8px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };

  const cardContentStyle = {
    display: "flex",
    flexDirection: "column" as "column",
    gap: "12px",
  };

  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>{title}</div>
      <div style={cardContentStyle}>{children}</div>
    </div>
  );
}
