import { motion } from "../../shared/ui";

import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  Award,
  ListChecks,
  TrendingUp,
  DollarSign,
  BarChart2,
  Clock,
  Megaphone,
  Star,
} from "../../shared/ui";

const ICON_MAP = {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  Award,
  ListChecks,
  TrendingUp,
  DollarSign,
  BarChart2,
  Clock,
  Megaphone,
  Star,
};

// Text always shows in full: it wraps onto a new line instead of cutting off with "..."
const FULL_TEXT = {
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  overflow: "visible",
  textOverflow: "clip",
};

function StatCard({ stat }) {
  const Icon =
    typeof stat?.icon === "string"
      ? ICON_MAP[stat.icon] || Users
      : stat?.icon || Users;

  const color = stat?.color || "rgb(79, 110, 247)";
  const hasLightBackground = Boolean(stat?.background || stat?.bg);
  const textColor = stat?.textColor || (hasLightBackground ? "#1f2937" : "#fff");
  const secondaryTextColor = stat?.secondaryTextColor || (hasLightBackground ? "#4b5563" : "rgba(255,255,255,.88)");

  const gradient =
    stat?.gradient ||
    `linear-gradient(135deg, ${color}, ${color})`;

  const displayVal = stat?.value ?? stat?.val ?? "";
  const valueStr = String(displayVal);

  // Shrink long values a little so they fit on one line where possible
  let valueFontSize = 34;

  if (valueStr.length > 18) {
    valueFontSize = 16;
  } else if (valueStr.length > 15) {
    valueFontSize = 18;
  } else if (valueStr.length > 12) {
    valueFontSize = 20;
  } else if (valueStr.length > 9) {
    valueFontSize = 24;
  } else if (valueStr.length > 7) {
    valueFontSize = 28;
  }

  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
      style={{
        minWidth: 0,
        width: "100%",
      }}
    >
      <div
        style={{
          background: stat?.background || stat?.bg || gradient,
          borderRadius: 18,
          padding: "24px",
          display: "flex",
          alignItems: "center",
          gap: 18,
          boxShadow: "0 8px 28px rgba(0,0,0,.18)",
          minHeight: 110,
          position: "relative",
          overflow: "hidden",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Decorative circle */}
        <div
          style={{
            position: "absolute",
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(255,255,255,.08)",
            right: -30,
            top: -30,
          }}
        />

        {/* Icon */}
        <div
          style={{
            width: 52,
            height: 52,
            minWidth: 52,
            borderRadius: 14,
            background: "rgba(255,255,255,.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          <Icon
            size={27}
            color={stat?.iconColor || textColor}
            strokeWidth={2}
          />
        </div>

        {/* Content */}
        <div
          style={{
            zIndex: 1,
            minWidth: 0,
            flex: 1,
          }}
        >
          {/* Value */}
          <div
            style={{
              fontSize: valueFontSize,
              fontWeight: 800,
              color: textColor,
              lineHeight: 1.1,
              letterSpacing: valueStr.length > 12 ? "-0.4px" : "normal",
              transition: "font-size 0.2s ease",
              ...FULL_TEXT,
            }}
          >
            {displayVal}
          </div>

          {/* Label */}
          <div
            style={{
              fontSize: 13.5,
              color: secondaryTextColor,
              marginTop: 7,
              fontWeight: 500,
              ...FULL_TEXT,
            }}
          >
            {stat?.label}
          </div>

          {/* Change / Description (only rendered when provided) */}
          {stat?.change && (
            <div
              style={{
                fontSize: 11.5,
                color: stat?.changeColor || secondaryTextColor,
                marginTop: 4,
                ...FULL_TEXT,
              }}
            >
              {stat.change}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export { StatCard };