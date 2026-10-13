import React from "react";

const Card = ({
  title = "Card Title",
  children = null,
  footer = null,
  elevated = true,
  padding = "16px",
  style = {},
  ...rest
}) => {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        background: "#fff",
        padding,
        boxShadow: elevated ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
        ...style,
      }}
      {...rest}
    >
      {title && <h3 style={{ margin: "0 0 8px" }}>{title}</h3>}
      <div>{children}</div>
      {footer && <div style={{ marginTop: "12px" }}>{footer}</div>}
    </div>
  );
};

export default Card;
