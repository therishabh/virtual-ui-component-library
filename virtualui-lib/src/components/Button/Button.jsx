import React from "react";

const variants = {
  primary: { background: "#2563eb", color: "#fff", border: "1px solid #2563eb" },
  secondary: { background: "#e5e7eb", color: "#111827", border: "1px solid #e5e7eb" },
  outline: { background: "transparent", color: "#2563eb", border: "1px solid #2563eb" },
};

const sizes = {
  sm: { padding: "4px 10px", fontSize: "12px" },
  md: { padding: "8px 16px", fontSize: "14px" },
  lg: { padding: "12px 24px", fontSize: "16px" },
};

const Button = ({
  children = "Button",
  variant = "primary",
  size = "md",
  type = "button",
  disabled = false,
  onClick = () => {},
  style = {},
  ...rest
}) => {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        borderRadius: "6px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        ...variants[variant],
        ...sizes[size],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;
