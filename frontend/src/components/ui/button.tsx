import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2";
  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };
  const variantClasses = {
    primary: "bg-black text-white hover:bg-gray-900 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed",
    outline:
      "border-2 border-black text-black hover:bg-black hover:text-white focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed",
    ghost: "text-black hover:bg-gray-100 focus:ring-gray-300",
  };

  return (
    <button
      className={`${base} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
